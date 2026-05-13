/**
 * Security tests for the API endpoints.
 *
 * Covers:
 *  - JWT tampering (tampered, expired, wrong-secret tokens)
 *  - Privilege escalation (client token → admin endpoints)
 *  - IDOR — barbeiro accessing client records or another barbeiro's reservations
 *  - Body injection (cliente_id in POST body must be ignored)
 *  - Mass assignment (role / reservas_concluidas / reservas_gratuitas_disponiveis in PUT /api/me must be ignored)
 *  - SQL injection (all inputs use parameterised bind — confirmed by inspecting DB calls)
 *  - Login security (Turnstile verification enforced)
 *
 * Política de acesso a clientes por role:
 *  - admin / superAdmin : GET (lista + pesquisa), GET/:id, POST, PATCH/:id, DELETE/:id
 *  - barbeiro           : GET (lista + pesquisa) ✓ — necessário para pesquisar clientes em reservas
 *                         POST                   ✓ — necessário para criar um novo cliente ao criar uma reserva
 *                         GET/:id                ✗ — 401 (dados completos do cliente só para admin)
 *                         PATCH / DELETE         ✗ — 401
 *  - não autenticado    : todos os métodos      ✗ — 401
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock auth utilities BEFORE importing handlers ──────────────────────────
vi.mock('../functions/utils/auth.js', () => ({
  authenticateClient: vi.fn(),
  authenticateAdmin: vi.fn(),
}))

// ── Mock external-I/O utilities ────────────────────────────────────────────
vi.mock('../functions/utils/email.js', () => ({
  sendEmail: vi.fn(),
  buildEmailChangeEmail: vi.fn().mockReturnValue({ html: '<p>email</p>' }),
  buildVerificationEmail: vi.fn().mockReturnValue({ html: '<p>verify</p>' }),
  isPlaceholderEmail: vi.fn().mockReturnValue(false),
}))

vi.mock('../functions/utils/reservationEmails.js', () => ({
  sendReservationConfirmation: vi.fn(),
  cancelScheduledReminder: vi.fn().mockResolvedValue(undefined),
  rescheduleReminder: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../functions/utils/turnstile.js', () => ({
  verifyTurnstile: vi.fn(),
}))

// ── Import handlers ────────────────────────────────────────────────────────
import { onRequest as handleReservations }      from '../functions/api/reservations.js'
import { onRequest as handleMe }                 from '../functions/api/me.js'
import { onRequest as handleMyReservations }     from '../functions/api/my-reservations.js'
import { onRequest as handleAdminClients }        from '../functions/api/admin/clients.js'
import { onRequest as handleAdminClientsById }    from '../functions/api/admin/clients/[id].js'
import { onRequest as handleAdminReservationsById } from '../functions/api/admin/reservations/[id].js'
import { onRequest as handleAuthLogin }           from '../functions/api/auth/login.js'

import { authenticateClient, authenticateAdmin } from '../functions/utils/auth.js'
import { verifyTurnstile }                        from '../functions/utils/turnstile.js'
import { signJWT, verifyJWT }                     from '../functions/utils/jwt.js'

// ── Test helpers ───────────────────────────────────────────────────────────

function makeRequest(
  method: string,
  url: string,
  opts?: { body?: Record<string, unknown>; cookie?: string; bearer?: string },
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (opts?.cookie)  headers.set('Cookie', opts.cookie)
  if (opts?.bearer)  headers.set('Authorization', `Bearer ${opts.bearer}`)
  return new Request(url, {
    method,
    headers,
    body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
  })
}

/** Creates a bound DB statement mock with configurable per-method results. */
function makeBound(first: unknown = null, results: unknown[] = []) {
  return {
    first: vi.fn().mockResolvedValue(first),
    all:   vi.fn().mockResolvedValue({ results }),
    run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } }),
  }
}

/**
 * Creates a DB mock where every `prepare` call returns the same bound statement.
 * Pass a factory to customise per-call behaviour.
 */
function makeDB(factory?: () => ReturnType<typeof makeBound>) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => (factory ? factory() : makeBound())),
    })),
  }
}

/**
 * Creates a DB mock where each `prepare(sql)` call is routed to different
 * bound statement mocks based on the SQL string. Useful when a single handler
 * issues multiple DB calls with different shapes.
 *
 * `routes` is an array of [substring, bound] pairs checked in order.
 * Falls back to a generic `makeBound()` when no substring matches.
 */
function makeDBRouted(routes: [string, ReturnType<typeof makeBound>][]) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => {
        const match = routes.find(([sub]) => sql.includes(sub))
        return match ? match[1] : makeBound()
      }),
    })),
  }
}

function makeEnv(db?: ReturnType<typeof makeDB> | ReturnType<typeof makeDBRouted>) {
  return {
    DB:               db ?? makeDB(),
    JWT_SECRET:       'test-secret',
    JWT_ADMIN_SECRET: 'test-admin-secret',
  }
}

function makeContext(
  request: Request,
  env: ReturnType<typeof makeEnv>,
  params: Record<string, string> = {},
) {
  return { request, env, params, waitUntil: vi.fn() }
}

// Common auth result fixtures
const CLIENT_AUTH  = { success: true,  clientId: 1, role: 'client', payload: { id: 1 } }
const ADMIN_AUTH   = { success: true,  adminId: 1, user: { id: 1, role: 'admin',      barbeiro_id: null, ativo: 1 } }
const BARBER_AUTH  = { success: true,  adminId: 2, user: { id: 2, role: 'barbeiro',   barbeiro_id: 5,    ativo: 1 } }
const AUTH_FAIL    = { success: false }

beforeEach(() => vi.clearAllMocks())

// ════════════════════════════════════════════════════════════════════════════
// 1. JWT TAMPERING
// ════════════════════════════════════════════════════════════════════════════
describe('JWT tampering', () => {
  const secret = 'test-secret'

  it('accepts a valid JWT', async () => {
    const token   = await signJWT({ id: 1, email: 'a@test.com' }, secret)
    const payload = await verifyJWT(token, secret)
    expect(payload.id).toBe(1)
  })

  it('rejects a JWT signed with a different secret', async () => {
    const token = await signJWT({ id: 1 }, 'wrong-secret')
    await expect(verifyJWT(token, secret)).rejects.toThrow()
  })

  it('rejects a JWT with a tampered signature', async () => {
    const token  = await signJWT({ id: 1 }, secret)
    const parts  = token.split('.')
    parts[2]     = parts[2].split('').reverse().join('')   // corrupt the signature
    const tampered = parts.join('.')
    await expect(verifyJWT(tampered, secret)).rejects.toThrow()
  })

  it('rejects a JWT with a tampered payload', async () => {
    const token  = await signJWT({ id: 1, role: 'client' }, secret)
    const parts  = token.split('.')
    // Elevate role to admin in the payload — signature will no longer match
    parts[1]     = btoa(JSON.stringify({ id: 1, role: 'admin', iat: 0, exp: 9999999999 }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const tampered = parts.join('.')
    await expect(verifyJWT(tampered, secret)).rejects.toThrow()
  })

  it('rejects a token with a past exp claim', async () => {
    // expiresInSeconds = -10 → exp is already in the past
    const token = await signJWT({ id: 1 }, secret, -10)
    await expect(verifyJWT(token, secret)).rejects.toThrow(/expirado/i)
  })

  it('rejects a malformed token (not three parts)', async () => {
    await expect(verifyJWT('not.a.token', secret)).rejects.toThrow()
    await expect(verifyJWT('onlyone',     secret)).rejects.toThrow()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 2. PRIVILEGE ESCALATION — unauthenticated / client token on admin endpoints
// ════════════════════════════════════════════════════════════════════════════
describe('Privilege escalation — unauthenticated access to admin endpoints', () => {
  it('GET /api/admin/clients → 401 when no token', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(AUTH_FAIL)
    const req = makeRequest('GET', 'https://example.com/api/admin/clients')
    const res = await handleAdminClients(makeContext(req, makeEnv()))
    expect(res.status).toBe(401)
  })

  it('GET /api/admin/clients/:id → 401 when no token', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(AUTH_FAIL)
    const req = makeRequest('GET', 'https://example.com/api/admin/clients/1')
    const res = await handleAdminClientsById(makeContext(req, makeEnv(), { id: '1' }))
    expect(res.status).toBe(401)
  })

  it('GET /api/admin/reservations/:id → 401 when no token', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(AUTH_FAIL)
    const req = makeRequest('GET', 'https://example.com/api/admin/reservations/1')
    const res = await handleAdminReservationsById(makeContext(req, makeEnv(), { id: '1' }))
    expect(res.status).toBe(401)
  })

  it('GET /api/me → 401 when no client token', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(AUTH_FAIL)
    const req = makeRequest('GET', 'https://example.com/api/me')
    const res = await handleMe(makeContext(req, makeEnv()))
    expect(res.status).toBe(401)
  })

  it('GET /api/my-reservations → 401 when no client token', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(AUTH_FAIL)
    const req = makeRequest('GET', 'https://example.com/api/my-reservations')
    const res = await handleMyReservations(makeContext(req, makeEnv()))
    expect(res.status).toBe(401)
  })

  it('POST /api/reservations → 401 when no client token', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(AUTH_FAIL)
    const req = makeRequest('POST', 'https://example.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: '2030-01-01', time: '10:00' },
    })
    const res = await handleReservations(makeContext(req, makeEnv()))
    expect(res.status).toBe(401)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 3. BARBEIRO IDOR — barbeiro accessing data that belongs to another barber
//    (relies on the fixes applied to admin/clients/[id].js and
//     admin/reservations/[id].js)
//
// Política de acesso a clientes:
//   GET /api/admin/clients (lista)  → barbeiros PODEM (200)
//   POST /api/admin/clients         → barbeiros PODEM (201) — criar cliente ao criar reserva
//   GET /api/admin/clients/:id      → barbeiros NÃO PODEM (401)
//   PATCH / DELETE                  → barbeiros NÃO PODEM (401)
// ════════════════════════════════════════════════════════════════════════════
describe('Barbeiro IDOR — barbeiro cannot access forbidden records', () => {
  // ── Clientes: lista (GET) ────────────────────────────────────────────────
  it('GET /api/admin/clients → 200 for barbeiro role (pesquisa de clientes em reservas)', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(BARBER_AUTH)
    const db = makeDB(() => makeBound({ count: 0 }, []))
    const req = makeRequest('GET', 'https://example.com/api/admin/clients')
    const res = await handleAdminClients(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(200)
  })

  // ── Clientes: criar (POST) ───────────────────────────────────────────────
  it('POST /api/admin/clients → 201 for barbeiro role (criar cliente ao criar reserva)', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(BARBER_AUTH)

    // O handler POST faz duas queries:
    //   1. INSERT INTO clientes → run() com last_row_id
    //   2. SELECT ... FROM clientes WHERE c.id = ? → first() com o cliente criado
    const newClient = {
      id: 99, name: 'Novo Cliente', email: '912345678@withoutcontact.pt',
      phone: '912345678', nif: null, photo_url: null,
      reservas_concluidas: 0, next_appointment_date: null,
      last_appointment_date: null, notes: null, created_at: '2030-01-01',
    }

    const db = makeDBRouted([
      // Segunda query — SELECT para obter o cliente reciém-criado
      ['FROM clientes', makeBound(newClient)],
      // Primeira query — INSERT (cai no fallback makeBound() que tem run() com last_row_id: 1)
    ])
    // O INSERT não contém 'FROM clientes', por isso usa o fallback com run().meta.last_row_id = 1

    const req = makeRequest('POST', 'https://example.com/api/admin/clients', {
      body: { name: 'Novo Cliente', phone: '912345678' },
    })
    const res = await handleAdminClients(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(201)
  })

  // ── Clientes: detalhe (GET /:id) ──────────────────────────────────────────
  it('GET /api/admin/clients/:id → 401 for barbeiro role', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(BARBER_AUTH)
    const req = makeRequest('GET', 'https://example.com/api/admin/clients/1')
    const res = await handleAdminClientsById(makeContext(req, makeEnv(), { id: '1' }))
    expect(res.status).toBe(401)
  })

  it('PATCH /api/admin/clients/:id → 401 for barbeiro role', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(BARBER_AUTH)
    const req = makeRequest('PATCH', 'https://example.com/api/admin/clients/1', {
      body: { name: 'Hacker' },
    })
    const res = await handleAdminClientsById(makeContext(req, makeEnv(), { id: '1' }))
    expect(res.status).toBe(401)
  })

  it('DELETE /api/admin/clients/:id → 401 for barbeiro role', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(BARBER_AUTH)
    const req = makeRequest('DELETE', 'https://example.com/api/admin/clients/1')
    const res = await handleAdminClientsById(makeContext(req, makeEnv(), { id: '1' }))
    expect(res.status).toBe(401)
  })

  // ── Reservas: IDOR entre barbeiros ─────────────────────────────────────
  it('GET /api/admin/reservations/:id → 401 when reservation belongs to another barber', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(BARBER_AUTH)
    const reserva = {
      id: 1, status: 'confirmada', data_hora: '2030-01-01T10:00:00',
      comentario: null, nota_privada: null, resend_lembrete_id: null,
      cliente_id: 10, barbeiro_id: 99, servico_id: 1,
      meio_pagamento: null, valor_pago: null, gorjeta: null,
      meio_gorjeta: null, comentario_pagamento: null,
      cliente_nome: 'Cliente X', cliente_email: 'x@example.com',
      client_photo_url: null, barbeiro_nome: 'Outro Barbeiro',
      servico_nome: 'Corte', duracao_efetiva: 30, servico_preco: 10,
      client_free_reservations: 0,
    }
    const db = makeDB(() => makeBound(reserva))
    const req = makeRequest('GET', 'https://example.com/api/admin/reservations/1')
    const res = await handleAdminReservationsById(makeContext(req, makeEnv(db), { id: '1' }))
    expect(res.status).toBe(401)
  })

  it('PATCH /api/admin/reservations/:id → 401 when reservation belongs to another barber', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(BARBER_AUTH)
    const reserva = {
      id: 1, status: 'confirmada', data_hora: '2030-01-01T10:00:00',
      comentario: null, nota_privada: null, resend_lembrete_id: null,
      cliente_id: 10, barbeiro_id: 99, servico_id: 1,
      meio_pagamento: null, valor_pago: null, gorjeta: null,
      meio_gorjeta: null, comentario_pagamento: null,
      cliente_nome: 'Cliente X', cliente_email: 'x@example.com',
      client_photo_url: null, barbeiro_nome: 'Outro Barbeiro',
      servico_nome: 'Corte', duracao_efetiva: 30, servico_preco: 10,
      client_free_reservations: 0,
    }
    const db = makeDB(() => makeBound(reserva))
    const req = makeRequest('PATCH', 'https://example.com/api/admin/reservations/1', {
      body: { status: 'cancelada' },
    })
    const res = await handleAdminReservationsById(makeContext(req, makeEnv(db), { id: '1' }))
    expect(res.status).toBe(401)
  })

  it('DELETE /api/admin/reservations/:id → 401 when reservation belongs to another barber', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(BARBER_AUTH)
    const reserva = {
      id: 1, status: 'confirmada', data_hora: '2030-01-01T10:00:00',
      comentario: null, nota_privada: null, resend_lembrete_id: null,
      cliente_id: 10, barbeiro_id: 99, servico_id: 1,
      meio_pagamento: null, valor_pago: null, gorjeta: null,
      meio_gorjeta: null, comentario_pagamento: null,
      cliente_nome: 'Cliente X', cliente_email: 'x@example.com',
      client_photo_url: null, barbeiro_nome: 'Outro Barbeiro',
      servico_nome: 'Corte', duracao_efetiva: 30, servico_preco: 10,
      client_free_reservations: 0,
    }
    const db = makeDB(() => makeBound(reserva))
    const req = makeRequest('DELETE', 'https://example.com/api/admin/reservations/1')
    const res = await handleAdminReservationsById(makeContext(req, makeEnv(db), { id: '1' }))
    expect(res.status).toBe(401)
  })

  it('GET /api/admin/reservations/:id → 200 when reservation belongs to the authenticated barber', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(BARBER_AUTH)  // barbeiro_id = 5
    const reserva = {
      id: 2, status: 'confirmada', data_hora: '2030-01-01T10:00:00',
      comentario: null, nota_privada: null, resend_lembrete_id: null,
      cliente_id: 10, barbeiro_id: 5, servico_id: 1,
      meio_pagamento: null, valor_pago: null, gorjeta: null,
      meio_gorjeta: null, comentario_pagamento: null,
      cliente_nome: 'Cliente Y', cliente_email: 'y@example.com',
      client_photo_url: null, barbeiro_nome: 'Barber Five',
      servico_nome: 'Corte', duracao_efetiva: 30, servico_preco: 10,
      client_free_reservations: 0,
    }
    const db = makeDB(() => makeBound(reserva))
    const req = makeRequest('GET', 'https://example.com/api/admin/reservations/2')
    const res = await handleAdminReservationsById(makeContext(req, makeEnv(db), { id: '2' }))
    expect(res.status).toBe(200)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 4. BODY INJECTION — cliente_id in POST body must be ignored
// ════════════════════════════════════════════════════════════════════════════
describe('Body injection — cliente_id in POST /api/reservations body is ignored', () => {
  it('uses auth.clientId from JWT, not the injected cliente_id from body', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)  // clientId = 1

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente Test', email: 'c@test.com' }

    let insertBindArgs: unknown[] = []
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...args: unknown[]) => {
          if (sql.includes('INSERT INTO reservas')) insertBindArgs = args
          return makeBound(
            sql.includes('FROM servicos') ? service
              : sql.includes('FROM barbeiros') && sql.includes('ativo') ? barber
              : sql.includes('FROM clientes') ? client
              : null,
          )
        }),
      })),
    }

    const req = makeRequest('POST', 'https://example.com/api/reservations', {
      body: {
        service_id:  1,
        barber_id:   1,
        date:        '2030-06-01',
        time:        '10:00',
        cliente_id:  999,
      },
    })

    await handleReservations(makeContext(req, makeEnv(db as ReturnType<typeof makeDB>)))

    expect(insertBindArgs[0]).toBe(1)
    expect(insertBindArgs[0]).not.toBe(999)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 5. MASS ASSIGNMENT — sensitive fields in PUT /api/me body must be ignored
// ════════════════════════════════════════════════════════════════════════════
describe('Mass assignment — forbidden fields in PUT /api/me are ignored', () => {
  it('does not update role, reservas_concluidas or reservas_gratuitas_disponiveis', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)

    const currentClient = { nome: 'Test', email: 'test@test.com' }

    let updateSql = ''
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn(() => {
          if (sql.toUpperCase().startsWith('UPDATE')) updateSql = sql
          return makeBound(currentClient)
        }),
      })),
    }

    const req = makeRequest('PUT', 'https://example.com/api/me', {
      body: {
        name:                           'Test User',
        phone:                          '912345678',
        role:                           'admin',
        reservas_concluidas:            999,
        reservas_gratuitas_disponiveis: 50,
      },
    })

    const res = await handleMe(makeContext(req, makeEnv(db as ReturnType<typeof makeDB>)))
    expect(res.status).toBe(200)

    expect(updateSql).not.toMatch(/role/i)
    expect(updateSql).not.toMatch(/reservas_concluidas/i)
    expect(updateSql).not.toMatch(/reservas_gratuitas_disponiveis/i)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 6. SQL INJECTION — all user inputs reach the DB via parameterised bind only
// ════════════════════════════════════════════════════════════════════════════
describe('SQL injection — inputs are passed as bind parameters', () => {
  it('GET /api/admin/clients: search value is a bind parameter, never concatenated into SQL', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(ADMIN_AUTH)

    const capturedBindArgs: unknown[][] = []
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: unknown[]) => {
          capturedBindArgs.push(args)
          return makeBound(null, [])
        }),
      })),
    }

    const malicious = "' OR 1=1 --"
    const req = makeRequest(
      'GET',
      `https://example.com/api/admin/clients?search=${encodeURIComponent(malicious)}`,
    )
    await handleAdminClients(makeContext(req, makeEnv(db as ReturnType<typeof makeDB>)))

    const preparedSqlCalls: string[] = db.prepare.mock.calls.map((c: unknown[]) => c[0] as string)
    for (const sql of preparedSqlCalls) {
      expect(sql).not.toContain(malicious)
    }

    const allBindArgs = capturedBindArgs.flat()
    const hasInjectionAsBind = allBindArgs.some(
      (a) => typeof a === 'string' && a.includes(malicious),
    )
    expect(hasInjectionAsBind).toBe(true)
  })

  it('POST /api/reservations: notes field with SQL payload is passed as a bind parameter', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente Test', email: 'c@test.com' }
    const capturedBindArgs: unknown[][] = []

    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...args: unknown[]) => {
          capturedBindArgs.push(args)
          return makeBound(
            sql.includes('FROM servicos') ? service
              : sql.includes('FROM barbeiros') && sql.includes('ativo') ? barber
              : sql.includes('FROM clientes') ? client
              : null,
          )
        }),
      })),
    }

    const sqlPayload = "'; DROP TABLE reservas; --"
    const req = makeRequest('POST', 'https://example.com/api/reservations', {
      body: {
        service_id: 1,
        barber_id:  1,
        date:       '2030-06-01',
        time:       '10:00',
        notes:      sqlPayload,
      },
    })

    await handleReservations(makeContext(req, makeEnv(db as ReturnType<typeof makeDB>)))

    const preparedSqlCalls: string[] = db.prepare.mock.calls.map((c: unknown[]) => c[0] as string)
    for (const sql of preparedSqlCalls) {
      expect(sql).not.toContain(sqlPayload)
    }

    const allBindArgs = capturedBindArgs.flat()
    const hasPayloadAsBind = allBindArgs.some(
      (a) => typeof a === 'string' && a.includes("'; DROP TABLE reservas; --"),
    )
    expect(hasPayloadAsBind).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 7. LOGIN SECURITY — Turnstile (CAPTCHA) is enforced
// ════════════════════════════════════════════════════════════════════════════
describe('Login security — Turnstile verification is enforced', () => {
  it('rejects login when Turnstile verification fails', async () => {
    vi.mocked(verifyTurnstile).mockResolvedValue({ success: false })

    const db = makeDB(() => makeBound({
      id: 1, nome: 'Test', email: 'test@test.com', telefone: null,
      password_hash: 'irrelevant', foto_perfil: null, email_verificado: 1,
    }))

    const req = makeRequest('POST', 'https://example.com/api/auth/login', {
      body: { email: 'test@test.com', password: 'password123', turnstileToken: 'bad-token' },
    })
    const res = await handleAuthLogin(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(400)

    const body = await res.json() as { success: boolean; error?: string }
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/verificação de segurança/i)
  })

  it('proceeds with login when Turnstile verification passes', async () => {
    vi.mocked(verifyTurnstile).mockResolvedValue({ success: true })

    const db = makeDB(() => makeBound(null))

    const req = makeRequest('POST', 'https://example.com/api/auth/login', {
      body: { email: 'notfound@test.com', password: 'password123', turnstileToken: 'good-token' },
    })
    const res = await handleAuthLogin(makeContext(req, makeEnv(db)))

    expect(res.status).toBe(400)
    const body = await res.json() as { success: boolean; error?: string }
    expect(body.error).toMatch(/credenciais/i)
  })
})
