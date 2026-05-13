/**
 * Testes dos handlers de reservas.
 *
 * Cobre:
 *  - Validação de input (service_id, barber_id, data, hora)
 *  - Rejeição de datas passadas
 *  - Serviço inexistente → 404
 *  - Conflito de horário (barbeiro) → 409
 *  - Conflito de horário (cliente) → 409
 *  - Criação com sucesso (barbeiro específico) → 201
 *  - Modo anyBarber: barber_id ausente / "any" / 0 não retorna 400
 *  - anyBarber sem nenhum slot disponível → 409
 *  - anyBarber em dia fechado (getOpenClose=null) → 409
 *  - pickBarber escolhe o barbeiro com menos reservas no dia
 *  - GET /api/slots-any-barber: validação e lógica de união de slots
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (antes dos imports dos handlers) ──────────────────────────────────
vi.mock('../../../functions/utils/auth.js', () => ({
  authenticateClient: vi.fn(),
  authenticateAdmin:  vi.fn(),
}))
vi.mock('../../../functions/utils/email.js', () => ({
  sendEmail:              vi.fn(),
  buildEmailChangeEmail:  vi.fn().mockReturnValue({ html: '' }),
  buildVerificationEmail: vi.fn().mockReturnValue({ html: '' }),
  isPlaceholderEmail:     vi.fn().mockReturnValue(false),
}))
vi.mock('../../../functions/utils/reservationEmails.js', () => ({
  sendReservationConfirmation: vi.fn(),
  cancelScheduledReminder:     vi.fn().mockResolvedValue(undefined),
  rescheduleReminder:          vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../../functions/utils/turnstile.js', () => ({
  verifyTurnstile: vi.fn(),
}))

/**
 * computeSlots: por omissão devolve todos os slots de 30 em 30 min entre open e close.
 * getOpenClose: seg–sáb abertos (09:00–19:00); domingo (0) fechado.
 * Cada teste pode sobrescrever com mockReturnValueOnce.
 */
vi.mock('../../../functions/utils/slots.js', () => ({
  computeSlots: vi.fn(({ openHour = '09:00', closeHour = '19:00' }: { openHour?: string; closeHour?: string } = {}) => {
    const slots: string[] = []
    const [oh, om] = openHour.split(':').map(Number)
    const [ch, cm] = closeHour.split(':').map(Number)
    let cur = oh * 60 + om
    const end = ch * 60 + cm
    while (cur < end) {
      slots.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`)
      cur += 30
    }
    return slots
  }),
  getOpenClose: vi.fn((day: number) =>
    day === 0 ? null : { open: '09:00', close: '19:00' }
  ),
}))

import { onRequest as handleReservations } from '../../../functions/api/reservations.js'
import { onRequest as handleSlotsAny }     from '../../../functions/api/slots-any-barber.js'
import { authenticateClient }              from '../../../functions/utils/auth.js'
import { computeSlots, getOpenClose }      from '../../../functions/utils/slots.js'

// ── Helpers (mesmos de security.test.ts) ───────────────────────────────────────────
function makeRequest(
  method: string,
  url: string,
  opts?: { body?: Record<string, unknown> },
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  return new Request(url, {
    method,
    headers,
    body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
  })
}

function makeBound(first: unknown = null, results: unknown[] = []) {
  return {
    first: vi.fn().mockResolvedValue(first),
    all:   vi.fn().mockResolvedValue({ results }),
    run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 42 } }),
  }
}

function makeDB(factory?: () => ReturnType<typeof makeBound>) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => (factory ? factory() : makeBound())),
    })),
  }
}

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
  return { DB: db ?? makeDB(), JWT_SECRET: 'test-secret', JWT_ADMIN_SECRET: 'test-admin-secret' }
}

function makeContext(
  request: Request,
  env: ReturnType<typeof makeEnv>,
  params: Record<string, string> = {},
) {
  return { request, env, params, waitUntil: vi.fn() }
}

// Fixtures
const FUTURE_DATE = '2099-06-02'  // segunda-feira
const FUTURE_TIME = '10:00'
const CLIENT_AUTH = { success: true, clientId: 1, role: 'client', payload: { id: 1 } }
const AUTH_FAIL   = { success: false }

beforeEach(() => vi.clearAllMocks())

// ══ 1. VALIDAÇÃO DE INPUT ═══════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — validação de input', () => {
  it('sem autenticação → 401', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(AUTH_FAIL)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv()))
    expect(res.status).toBe(401)
  })

  it('service_id = 0 → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 0, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('barber_id negativo → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: -5, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('data inválida → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: 'nao-data', time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('hora inválida → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: '25:99' },
    })
    const res = await handleReservations(makeContext(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('data no passado → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: '2000-01-01', time: '10:00' },
    })
    const res = await handleReservations(makeContext(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('serviço inexistente → 404', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    // DB.first() devolve null em todas as queries → servico não encontrado
    const db = makeDB(() => makeBound(null))
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 99, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(404)
  })
})

// ══ 2. CONFLITOS DE HORÁRIO ═══════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — conflitos de horário', () => {
  it('barbeiro já tem reserva no mesmo slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const db = makeDBRouted([
      // primeiro: servico
      ['FROM servicos',                                          makeBound(service)],
      // Promise.all([conflictBarber, conflictClient, barber]):
      // conflictBarber — query "FROM reservas WHERE barbeiro_id" retorna conflito
      ['FROM reservas WHERE barbeiro_id',                        makeBound({ id: 77 })],
    ])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(409)
  })

  it('cliente já tem reserva no mesmo slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const db = makeDBRouted([
      ['FROM servicos',                makeBound(service)],
      ['FROM reservas WHERE barbeiro_id', makeBound(null)],        // sem conflito no barbeiro
      ['FROM reservas WHERE cliente_id',  makeBound({ id: 88 })],  // conflito no cliente
      ['FROM barbeiros WHERE id',         makeBound(barber)],
    ])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(409)
  })
})

// ══ 3. CRIAÇÃO COM SUCESSO ═══════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — criação com sucesso', () => {
  it('barbeiro específico válido → 201 com id e barber_id', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }
    const db = makeDBRouted([
      ['FROM servicos',                   makeBound(service)],
      ['FROM reservas WHERE barbeiro_id', makeBound(null)],
      ['FROM reservas WHERE cliente_id',  makeBound(null)],
      ['FROM barbeiros WHERE id',         makeBound(barber)],
      ['FROM clientes WHERE id',          makeBound(client)],
    ])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { id: number; barber_id: number } }
    expect(body.data.barber_id).toBe(1)
    expect(body.data.id).toBeGreaterThan(0)
  })
})

// ══ 4. MODO ANY BARBER ═══════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — modo anyBarber', () => {
  // Happy-path DB: servico + barbeiros activos + reservas/indisponibilidades
  // para o pickBarber + sem conflitos + barber/client para o INSERT
  function makeAnyBarberDB(barberId = 1) {
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: barberId, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }
    return makeDBRouted([
      ['FROM servicos',                   makeBound(service)],
      ['WHERE ativo = 1',                 makeBound(null, [{ id: 1 }, { id: 2 }])],
      ['v_reservas_duracao',              makeBound(null, [])],
      ['horarios_indisponiveis',          makeBound(null, [])],
      ['COUNT(*) as cnt',                 makeBound({ cnt: 0 })],
      ['FROM barbeiros WHERE id',         makeBound(barber)],
      ['FROM clientes WHERE id',          makeBound(client)],
      ['FROM reservas WHERE barbeiro_id', makeBound(null)],
      ['FROM reservas WHERE cliente_id',  makeBound(null)],
    ])
  }

  it('barber_id="any" com barbeiro disponível → 201 com barber_id atribuído', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME, '11:00'])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 'any', date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(makeAnyBarberDB())))
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { barber_id: number } }
    expect(body.data.barber_id).toBeGreaterThan(0)
  })

  it('barber_id=0 é tratado como anyBarber → não retorna 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 0, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(makeAnyBarberDB())))
    expect(res.status).not.toBe(400)
  })

  it('sem barber_id é tratado como anyBarber → não retorna 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(makeAnyBarberDB())))
    expect(res.status).not.toBe(400)
  })

  it('anyBarber sem nenhum slot disponível → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    // computeSlots nunca inclui o slot pedido (10:00)
    vi.mocked(computeSlots).mockReturnValue(['14:00', '15:00'])
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const db = makeDBRouted([
      ['FROM servicos',          makeBound(service)],
      ['WHERE ativo = 1',        makeBound(null, [{ id: 1 }, { id: 2 }])],
      ['v_reservas_duracao',     makeBound(null, [])],
      ['horarios_indisponiveis', makeBound(null, [])],
    ])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 'any', date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(409)
  })

  it('anyBarber em dia fechado (getOpenClose=null) → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(getOpenClose).mockReturnValueOnce(null)
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const db = makeDBRouted([
      ['FROM servicos',   makeBound(service)],
      ['WHERE ativo = 1', makeBound(null, [{ id: 1 }])],
    ])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 'any', date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(409)
  })
})

// ══ 5. pickBarber — menos reservas no dia ══════════════════════════════════════════════════════════════════
describe('pickBarber — selecção por menos reservas no dia', () => {
  it('escolhe o barbeiro com menos reservas quando existem dois candidatos', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber1 = { id: 1, nome: 'B1' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }

    // Barbeiro 1 → 1 reserva hoje; barbeiro 2 → 3 reservas → deve escolher B1
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...args: unknown[]) => {
          if (sql.includes('FROM servicos'))                   return makeBound(service)
          if (sql.includes('WHERE ativo = 1'))                 return makeBound(null, [{ id: 1 }, { id: 2 }])
          if (sql.includes('v_reservas_duracao'))              return makeBound(null, [])
          if (sql.includes('horarios_indisponiveis'))          return makeBound(null, [])
          if (sql.includes('COUNT(*) as cnt')) {
            const bid = args[0] as number
            return makeBound({ cnt: bid === 1 ? 1 : 3 })
          }
          if (sql.includes('FROM barbeiros WHERE id'))         return makeBound(barber1)
          if (sql.includes('FROM clientes WHERE id'))         return makeBound(client)
          if (sql.includes('FROM reservas WHERE barbeiro_id')) return makeBound(null)
          if (sql.includes('FROM reservas WHERE cliente_id'))  return makeBound(null)
          return makeBound()
        }),
      })),
    }

    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(
      makeContext(req, makeEnv(db as ReturnType<typeof makeDB>)),
    )
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { barber_id: number } }
    expect(body.data.barber_id).toBe(1)
  })
})

// ══ 6. GET /api/slots-any-barber ═══════════════════════════════════════════════════════════════════════
describe('GET /api/slots-any-barber', () => {
  it('data inválida → 400', async () => {
    const req = makeRequest('GET', 'https://x.com/api/slots-any-barber?date=nao-data&service_id=1')
    const res = await handleSlotsAny(makeContext(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('service_id=0 → 400', async () => {
    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=0`)
    const res = await handleSlotsAny(makeContext(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('service_id negativo → 400', async () => {
    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=-1`)
    const res = await handleSlotsAny(makeContext(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('dia fechado (domingo 2099-06-01) → 200 array vazio', async () => {
    // 2099-06-01 = domingo → getOpenClose(0) = null (mock global)
    const req = makeRequest('GET', 'https://x.com/api/slots-any-barber?date=2099-06-01&service_id=1')
    const res = await handleSlotsAny(makeContext(req, makeEnv()))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toEqual([])
  })

  it('serviço inexistente → 400', async () => {
    const db = makeDBRouted([
      ['FROM servicos',   makeBound(null)],  // servico = null
      ['WHERE ativo = 1', makeBound(null, [])],
    ])
    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=99`)
    const res = await handleSlotsAny(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(400)
  })

  it('nenhum barbeiro activo → 200 array vazio', async () => {
    const service = { id: 1, duracao: 30 }
    const db = makeDBRouted([
      ['FROM servicos',   makeBound(service)],
      ['WHERE ativo = 1', makeBound(null, [])],  // sem barbeiros
    ])
    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toEqual([])
  })

  it('devolve união dos slots de todos os barbeiros', async () => {
    const service = { id: 1, duracao: 30 }
    const db = makeDBRouted([
      ['FROM servicos',          makeBound(service)],
      ['WHERE ativo = 1',        makeBound(null, [{ id: 1 }, { id: 2 }])],
      ['v_reservas_duracao',     makeBound(null, [])],
      ['horarios_indisponiveis', makeBound(null, [])],
    ])
    // Barbeiro 1: ['10:00','11:00'];  barbeiro 2: ['10:00']
    vi.mocked(computeSlots)
      .mockReturnValueOnce(['10:00', '11:00'])
      .mockReturnValueOnce(['10:00'])
    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toContain('10:00')
    expect(body.data).toContain('11:00')
    expect(body.data).toHaveLength(2)
  })

  it('slots estão ordenados cronologicamente', async () => {
    const service = { id: 1, duracao: 30 }
    const db = makeDBRouted([
      ['FROM servicos',          makeBound(service)],
      ['WHERE ativo = 1',        makeBound(null, [{ id: 1 }, { id: 2 }])],
      ['v_reservas_duracao',     makeBound(null, [])],
      ['horarios_indisponiveis', makeBound(null, [])],
    ])
    vi.mocked(computeSlots)
      .mockReturnValueOnce(['14:00', '10:00', '12:00'])
      .mockReturnValueOnce(['11:00', '09:00'])
    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toEqual([...body.data].sort())
  })
})
