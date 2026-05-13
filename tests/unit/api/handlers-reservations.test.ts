/**
 * Testes dos handlers de reservas e slots-any-barber.
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(
  method: string,
  url: string,
  opts?: { body?: Record<string, unknown> },
): Request {
  return new Request(url, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
  })
}

/**
 * Cria um statement mock que expõe:
 *  - .bind(...) → devolve um bound com .first(), .all(), .run()
 *  - .first()   → directamente no statement (para queries sem parâmetros)
 *  - .all()     → directamente no statement (para queries sem parâmetros)
 *  - .run()     → directamente no statement
 */
function makeStmt(
  firstVal: unknown = null,
  allResults: unknown[] = [],
) {
  const bound = {
    first: vi.fn().mockResolvedValue(firstVal),
    all:   vi.fn().mockResolvedValue({ results: allResults }),
    run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 42 } }),
  }
  return {
    bind: vi.fn(() => bound),
    // acesso directo sem .bind() (ex: barbeiros WHERE ativo=1 em slots-any-barber)
    first: vi.fn().mockResolvedValue(firstVal),
    all:   vi.fn().mockResolvedValue({ results: allResults }),
    run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 42 } }),
  }
}

/**
 * DB simples: todas as queries devolvem o mesmo firstVal / allResults.
 */
function makeDB(
  firstVal: unknown = null,
  allResults: unknown[] = [],
) {
  return { prepare: vi.fn(() => makeStmt(firstVal, allResults)) }
}

/**
 * DB roteado por substring do SQL.
 *
 * routes: array de [substring, { firstVal, allResults }] em ordem de prioridade.
 *
 * Para cada .prepare(sql), encontra a primeira entrada cujo substring
 * está contido no sql e devolve o statement correspondente.
 * Se não encontrar, devolve um statement neutro.
 *
 * NOTA: como .bind() pode ser chamado com argumentos diferentes para a
 * mesma query (ex: dois barbeiros), o bind devolve sempre o mesmo bound
 * configurado na rota — suficiente para testar o comportamento do handler.
 */
type Route = [string, { firstVal?: unknown; allResults?: unknown[] }]

function makeDBRouted(routes: Route[]) {
  return {
    prepare: vi.fn((sql: string) => {
      const match = routes.find(([sub]) => sql.includes(sub))
      const firstVal    = match?.[1].firstVal  ?? null
      const allResults  = match?.[1].allResults ?? []
      return makeStmt(firstVal, allResults)
    }),
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

// Fixtures
const FUTURE_DATE = '2040-01-02'   // segunda-feira
const FUTURE_TIME = '10:00'
const SUNDAY_DATE = '2040-01-01'   // domingo → getOpenClose(0) = null
const CLIENT_AUTH = { success: true, clientId: 1, role: 'client', payload: { id: 1 } }
const AUTH_FAIL   = { success: false }

beforeEach(() => vi.clearAllMocks())

// ══════════════════════════════════════════════════════════════════════════════
// 1. VALIDAÇÃO DE INPUT
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — validação de input', () => {
  it('sem autenticação → 401', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(AUTH_FAIL)
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    expect((await handleReservations(makeContext(req, makeEnv()))).status).toBe(401)
  })

  it('service_id = 0 → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 0, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    expect((await handleReservations(makeContext(req, makeEnv()))).status).toBe(400)
  })

  it('barber_id negativo → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: -5, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    expect((await handleReservations(makeContext(req, makeEnv()))).status).toBe(400)
  })

  it('data inválida → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: 'nao-data', time: FUTURE_TIME },
    })
    expect((await handleReservations(makeContext(req, makeEnv()))).status).toBe(400)
  })

  it('hora inválida → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: '25:99' },
    })
    expect((await handleReservations(makeContext(req, makeEnv()))).status).toBe(400)
  })

  it('data no passado → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: '2000-01-01', time: '10:00' },
    })
    expect((await handleReservations(makeContext(req, makeEnv()))).status).toBe(400)
  })

  it('serviço inexistente → 404', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    // Todas as queries devolvem null / [] → SELECT servico devolve null
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 99, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    expect((await handleReservations(makeContext(req, makeEnv(makeDB(null))))).status).toBe(404)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. CONFLITOS DE HORÁRIO
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — conflitos de horário', () => {
  it('barbeiro já tem reserva no mesmo slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    /**
     * Handler faz:
     *   1. SELECT servico           → service
     *   2. Promise.all([
     *        SELECT FROM reservas WHERE barbeiro_id  → { id: 77 }  ← conflito
     *        SELECT FROM reservas WHERE cliente_id   → null
     *        SELECT FROM barbeiros WHERE id          → barber
     *      ])
     *
     * Todos os .prepare() para queries de reservas barbeiro devolvem { id: 77 }.
     * O makeDBRouted usa o primeiro match por substring — a ordem das rotas importa.
     */
    const db = makeDBRouted([
      ['FROM servicos',             { firstVal: service }],
      ['WHERE barbeiro_id',         { firstVal: { id: 77 } }],   // conflito barbeiro
      ['WHERE cliente_id',          { firstVal: null }],
      ['FROM barbeiros WHERE id',   { firstVal: { id: 1, nome: 'B' } }],
    ])
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    expect((await handleReservations(makeContext(req, makeEnv(db)))).status).toBe(409)
  })

  it('cliente já tem reserva no mesmo slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const db = makeDBRouted([
      ['FROM servicos',             { firstVal: service }],
      ['WHERE barbeiro_id',         { firstVal: null }],           // sem conflito barbeiro
      ['WHERE cliente_id',          { firstVal: { id: 88 } }],    // conflito cliente
      ['FROM barbeiros WHERE id',   { firstVal: { id: 1, nome: 'B' } }],
    ])
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    expect((await handleReservations(makeContext(req, makeEnv(db)))).status).toBe(409)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. CRIAÇÃO COM SUCESSO — barbeiro específico
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — criação com sucesso', () => {
  it('barbeiro específico válido → 201 com id e barber_id', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }
    /**
     * Fluxo do handler (barbeiro específico):
     *  1. SELECT servico
     *  2. Promise.all([conflictBarber, conflictClient, barber])
     *  3. SELECT client
     *  4. INSERT reservas → last_row_id = 42
     *  5. INSERT notifications (catch ignorado)
     */
    const db = makeDBRouted([
      ['FROM servicos',           { firstVal: service }],
      ['WHERE barbeiro_id',       { firstVal: null }],
      ['WHERE cliente_id',        { firstVal: null }],
      ['FROM barbeiros WHERE id', { firstVal: barber }],
      ['FROM clientes WHERE id',  { firstVal: client }],
      // INSERT reservas e notifications ficam no fallback (makeStmt neutro)
    ])
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { id: number; barber_id: number } }
    expect(body.data.barber_id).toBe(1)
    expect(body.data.id).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. MODO ANY BARBER
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — modo anyBarber', () => {
  /**
   * DB para happy-path do modo anyBarber.
   *
   * Fluxo do handler:
   *  1. SELECT servico
   *  2. pickBarber:
   *       a. SELECT barbeiros WHERE ativo=1  → .all() (sem bind)
   *       b. Para cada barbeiro:
   *            - SELECT v_reservas_duracao   → .bind().all()
   *            - SELECT horarios_indisponiveis → .bind().all()
   *       c. SELECT COUNT(*) cnt hoje        → .bind().first()
   *       d. SELECT COUNT(*) cnt ontem       → .bind().first()  (se empate)
   *  3. Promise.all([conflictBarber, conflictClient, barber])
   *  4. SELECT client
   *  5. INSERT reservas + notifications
   *
   * Para as queries .all() sem bind (passo 2a), o makeStmt expõe
   * .all() directamente no statement além de dentro do .bind().
   */
  function makeAnyDB() {
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }
    return makeDBRouted([
      ['FROM servicos',            { firstVal: service }],
      // barbeiros WHERE ativo=1 — acedido via .all() directo
      ['WHERE ativo = 1',          { allResults: [{ id: 1 }, { id: 2 }] }],
      // reservas e indisponibilidades de cada barbeiro
      ['v_reservas_duracao',       { allResults: [] }],
      ['horarios_indisponiveis',   { allResults: [] }],
      // COUNT hoje / ontem
      ['COUNT(*) as cnt',          { firstVal: { cnt: 0 } }],
      // conflitos e lookup pós-pickBarber
      ['WHERE barbeiro_id',        { firstVal: null }],
      ['WHERE cliente_id',         { firstVal: null }],
      ['FROM barbeiros WHERE id',  { firstVal: barber }],
      ['FROM clientes WHERE id',   { firstVal: client }],
    ])
  }

  it('barber_id="any" com barbeiro disponível → 201 com barber_id atribuído', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME, '11:00'])
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 'any', date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(makeAnyDB())))
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { barber_id: number } }
    expect(body.data.barber_id).toBeGreaterThan(0)
  })

  it('barber_id=0 é tratado como anyBarber → não retorna 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 0, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(makeAnyDB())))
    expect(res.status).not.toBe(400)
  })

  it('sem barber_id é tratado como anyBarber → não retorna 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeContext(req, makeEnv(makeAnyDB())))
    expect(res.status).not.toBe(400)
  })

  it('anyBarber sem nenhum slot disponível para o horário pedido → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    // computeSlots nunca inclui 10:00
    vi.mocked(computeSlots).mockReturnValue(['14:00', '15:00'])
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const db = makeDBRouted([
      ['FROM servicos',          { firstVal: service }],
      ['WHERE ativo = 1',        { allResults: [{ id: 1 }, { id: 2 }] }],
      ['v_reservas_duracao',     { allResults: [] }],
      ['horarios_indisponiveis', { allResults: [] }],
    ])
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 'any', date: FUTURE_DATE, time: FUTURE_TIME },
    })
    expect((await handleReservations(makeContext(req, makeEnv(db)))).status).toBe(409)
  })

  it('anyBarber em dia fechado (getOpenClose=null) → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(getOpenClose).mockReturnValueOnce(null)
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const db = makeDBRouted([
      ['FROM servicos',   { firstVal: service }],
      ['WHERE ativo = 1', { allResults: [{ id: 1 }] }],
    ])
    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, barber_id: 'any', date: FUTURE_DATE, time: FUTURE_TIME },
    })
    expect((await handleReservations(makeContext(req, makeEnv(db)))).status).toBe(409)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. pickBarber — menos reservas no dia
// ══════════════════════════════════════════════════════════════════════════════
describe('pickBarber — selecção por menos reservas no dia', () => {
  it('escolhe barbeiro com menos reservas quando dois candidatos estão disponíveis', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber1 = { id: 1, nome: 'B1' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }

    /**
     * COUNT(*) as cnt: barbeiro 1 → 1 reserva; barbeiro 2 → 3 reservas
     * O handler chama .bind(barberId, date).first() — o primeiro argumento
     * de .bind() identifica o barbeiro.
     */
    const db = {
      prepare: vi.fn((sql: string) => {
        const stmt = makeStmt()
        if (sql.includes('FROM servicos')) {
          stmt.bind = vi.fn(() => ({ ...makeStmt(service), first: vi.fn().mockResolvedValue(service) }))
          return stmt
        }
        if (sql.includes('WHERE ativo = 1')) {
          // .all() directo (sem bind) — para pickBarber
          stmt.all = vi.fn().mockResolvedValue({ results: [{ id: 1 }, { id: 2 }] })
          stmt.bind = vi.fn(() => ({
            first: vi.fn().mockResolvedValue(null),
            all:   vi.fn().mockResolvedValue({ results: [{ id: 1 }, { id: 2 }] }),
            run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 42 } }),
          }))
          return stmt
        }
        if (sql.includes('v_reservas_duracao') || sql.includes('horarios_indisponiveis')) {
          stmt.bind = vi.fn(() => ({
            first: vi.fn().mockResolvedValue(null),
            all:   vi.fn().mockResolvedValue({ results: [] }),
            run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 42 } }),
          }))
          return stmt
        }
        if (sql.includes('COUNT(*) as cnt')) {
          let callIdx = 0
          stmt.bind = vi.fn((...args: unknown[]) => {
            const barberId = args[0] as number
            const cnt = barberId === 1 ? 1 : 3
            return {
              first: vi.fn().mockResolvedValue({ cnt }),
              all:   vi.fn().mockResolvedValue({ results: [] }),
              run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 42 } }),
            }
          })
          return stmt
        }
        if (sql.includes('FROM barbeiros WHERE id')) {
          stmt.bind = vi.fn(() => ({ ...makeStmt(barber1), first: vi.fn().mockResolvedValue(barber1) }))
          return stmt
        }
        if (sql.includes('FROM clientes WHERE id')) {
          stmt.bind = vi.fn(() => ({ ...makeStmt(client), first: vi.fn().mockResolvedValue(client) }))
          return stmt
        }
        if (sql.includes('WHERE barbeiro_id') || sql.includes('WHERE cliente_id')) {
          stmt.bind = vi.fn(() => ({
            first: vi.fn().mockResolvedValue(null),
            all:   vi.fn().mockResolvedValue({ results: [] }),
            run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 42 } }),
          }))
          return stmt
        }
        // fallback: INSERT reservas, notifications, etc.
        stmt.bind = vi.fn(() => ({
          first: vi.fn().mockResolvedValue(null),
          all:   vi.fn().mockResolvedValue({ results: [] }),
          run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 42 } }),
        }))
        return stmt
      }),
    }

    const req = makeRequest('POST', 'https://x/api/reservations', {
      body: { service_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(
      makeContext(req, makeEnv(db as ReturnType<typeof makeDB>)),
    )
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { barber_id: number } }
    expect(body.data.barber_id).toBe(1)  // barbeiro com menos reservas
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. GET /api/slots-any-barber
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/slots-any-barber', () => {
  /**
   * slots-any-barber.js faz:
   *  1. Promise.all([
   *       SELECT FROM servicos          → .bind(serviceId).first()
   *       SELECT FROM barbeiros WHERE ativo=1 → .all() DIRECTO (sem bind!)
   *     ])
   *  2. Para cada barbeiro:
   *       SELECT v_reservas_duracao     → .bind().all()
   *       SELECT horarios_indisponiveis → .bind().all()
   *
   * O makeStmt expõe .all() tanto no statement como dentro do .bind(),
   * cobrindo ambos os padrões de acesso.
   */
  function makeSlotsAnyDB(opts: {
    service?: unknown
    barbers?: unknown[]
    reservations?: unknown[]
    unavailabilities?: unknown[]
  } = {}) {
    const service       = opts.service       ?? { id: 1, duracao: 30 }
    const barbers       = opts.barbers       ?? [{ id: 1 }, { id: 2 }]
    const reservations  = opts.reservations  ?? []
    const unavails      = opts.unavailabilities ?? []
    return makeDBRouted([
      ['FROM servicos',          { firstVal: service }],
      ['WHERE ativo = 1',        { allResults: barbers }],
      ['v_reservas_duracao',     { allResults: reservations }],
      ['horarios_indisponiveis', { allResults: unavails }],
    ])
  }

  it('data inválida → 400', async () => {
    const req = makeRequest('GET', 'https://x/api/slots-any-barber?date=nao-data&service_id=1')
    expect((await handleSlotsAny(makeContext(req, makeEnv()))).status).toBe(400)
  })

  it('service_id=0 → 400', async () => {
    const req = makeRequest('GET', `https://x/api/slots-any-barber?date=${FUTURE_DATE}&service_id=0`)
    expect((await handleSlotsAny(makeContext(req, makeEnv()))).status).toBe(400)
  })

  it('service_id negativo → 400', async () => {
    const req = makeRequest('GET', `https://x/api/slots-any-barber?date=${FUTURE_DATE}&service_id=-1`)
    expect((await handleSlotsAny(makeContext(req, makeEnv()))).status).toBe(400)
  })

  it('dia fechado (domingo 2040-01-01) → 200 array vazio', async () => {
    // getOpenClose(0) = null pelo mock global → retorna ok([])
    const req = makeRequest('GET', `https://x/api/slots-any-barber?date=${SUNDAY_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeContext(req, makeEnv()))
    expect(res.status).toBe(200)
    expect((await res.json() as { data: string[] }).data).toEqual([])
  })

  it('nenhum barbeiro activo → 200 array vazio', async () => {
    const db = makeSlotsAnyDB({ barbers: [] })
    const req = makeRequest('GET', `https://x/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(200)
    expect((await res.json() as { data: string[] }).data).toEqual([])
  })

  it('devolve união dos slots de todos os barbeiros', async () => {
    const db = makeSlotsAnyDB()
    vi.mocked(computeSlots)
      .mockReturnValueOnce(['10:00', '11:00'])  // barbeiro 1
      .mockReturnValueOnce(['10:00'])           // barbeiro 2
    const req = makeRequest('GET', `https://x/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toContain('10:00')
    expect(body.data).toContain('11:00')
    expect(body.data).toHaveLength(2)
  })

  it('slots estão ordenados cronologicamente', async () => {
    const db = makeSlotsAnyDB()
    vi.mocked(computeSlots)
      .mockReturnValueOnce(['14:00', '10:00', '12:00'])
      .mockReturnValueOnce(['11:00', '09:00'])
    const req = makeRequest('GET', `https://x/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeContext(req, makeEnv(db)))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toEqual([...body.data].sort())
  })
})
