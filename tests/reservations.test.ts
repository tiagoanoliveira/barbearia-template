/**
 * Testes de reservas — mocks puros (vi.mock), sem servidor real.
 *
 * Cobre:
 *  - Validação de input (data, hora, service_id, barber_id)
 *  - Rejeição de datas passadas
 *  - Conflitos de horário (barbeiro e cliente)
 *  - Modo anyBarber: pickBarber selecciona por disponibilidade real (computeSlots)
 *  - pickBarber: ordena por nº de reservas crescente
 *  - pickBarber: devolve null quando barbearia está fechada
 *  - pickBarber: devolve null quando nenhum barbeiro tem o slot disponível
 *  - Manipulação: barber_id negativo
 *  - Manipulação: cliente_id no body é ignorado (coberto também em security.test.ts)
 *  - slots-any-barber: data inválida → 400
 *  - slots-any-barber: service_id inválido → 400
 *  - slots-any-barber: barbearia fechada → array vazio
 *  - slots-any-barber: devolve união dos slots de todos os barbeiros
 *  - slots-any-barber: slot só aparece se pelo menos 1 barbeiro o tem disponível
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ANTES de importar os handlers ────────────────────────────────────
vi.mock('../functions/utils/auth.js', () => ({
  authenticateClient: vi.fn(),
  authenticateAdmin:  vi.fn(),
}))

vi.mock('../functions/utils/email.js', () => ({
  sendEmail:               vi.fn(),
  buildEmailChangeEmail:   vi.fn().mockReturnValue({ html: '' }),
  buildVerificationEmail:  vi.fn().mockReturnValue({ html: '' }),
  isPlaceholderEmail:      vi.fn().mockReturnValue(false),
}))

vi.mock('../functions/utils/reservationEmails.js', () => ({
  sendReservationConfirmation: vi.fn(),
  cancelScheduledReminder:     vi.fn().mockResolvedValue(undefined),
  rescheduleReminder:          vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../functions/utils/turnstile.js', () => ({
  verifyTurnstile: vi.fn(),
}))

/**
 * Mock de computeSlots: por omissão devolve todos os slots possíveis.
 * Cada teste pode usar vi.mocked(computeSlots).mockReturnValue([...]) para
 * controlar o que cada barbeiro tem disponível.
 */
vi.mock('../functions/utils/slots.js', () => ({
  computeSlots: vi.fn(({ openHour = '09:00', closeHour = '19:00' } = {}) => {
    // Gera slots de 30 em 30 minutos entre open e close
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
  getOpenClose: vi.fn((day: number) => {
    // Segunda (1) a Sábado (6) abertas; Domingo (0) fechado
    if (day === 0) return null
    return { open: '09:00', close: '19:00' }
  }),
}))

import { onRequest as handleReservations }  from '../functions/api/reservations.js'
import { onRequest as handleSlotsAny }      from '../functions/api/slots-any-barber.js'

import { authenticateClient }  from '../functions/utils/auth.js'
import { computeSlots, getOpenClose } from '../functions/utils/slots.js'

// ── Helpers ────────────────────────────────────────────────────────────────

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

function makeCtx(
  req: Request,
  env: ReturnType<typeof makeEnv>,
  params: Record<string, string> = {},
) {
  return { request: req, env, params, waitUntil: vi.fn() }
}

// Data futura garantida (ano 2099) e hora fora de possível conflito com "now"
const FUTURE_DATE = '2099-06-02'  // segunda-feira
const FUTURE_TIME = '10:00'

const CLIENT_AUTH = { success: true, clientId: 1, role: 'client', payload: { id: 1 } }
const AUTH_FAIL   = { success: false }

beforeEach(() => vi.clearAllMocks())

// ════════════════════════════════════════════════════════════════════════════
// 1. VALIDAÇÃO DE INPUT — POST /api/reservations
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — validação de input', () => {
  it('sem autenticação → 401', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(AUTH_FAIL)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeCtx(req, makeEnv()))
    expect(res.status).toBe(401)
  })

  it('service_id = 0 → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 0, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeCtx(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('barber_id negativo → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: -5, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeCtx(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('data inválida → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: 'nao-data', time: FUTURE_TIME },
    })
    const res = await handleReservations(makeCtx(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('hora inválida → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: '25:99' },
    })
    const res = await handleReservations(makeCtx(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('data no passado → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: '2000-01-01', time: '10:00' },
    })
    const res = await handleReservations(makeCtx(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('serviço inexistente → 404', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    // DB.first() devolve null → serviço não encontrado
    const db = makeDB(() => makeBound(null))
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 99, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(404)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 2. CONFLITOS DE HORÁRIO
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — conflitos de horário', () => {
  it('barbeiro já tem reserva no mesmo slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const db = makeDBRouted([
      // Serviço existe
      ['FROM servicos', makeBound(service)],
      // Conflito no barbeiro: devolve uma reserva
      ['barbeiro_id = ?', makeBound({ id: 77 })],
    ])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(409)
  })

  it('cliente já tem reserva no mesmo slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const db = makeDBRouted([
      ['FROM servicos',  makeBound(service)],
      // Sem conflito no barbeiro
      ['barbeiro_id = ?', makeBound(null)],
      // Conflito no cliente
      ['cliente_id = ?',  makeBound({ id: 88 })],
    ])
    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(409)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 3. CRIAÇÃO COM SUCESSO — barbeiro específico
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — criação com sucesso', () => {
  it('barbeiro específico válido → 201 com id e barber_id', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }

    const db = makeDBRouted([
      ['FROM servicos',                       makeBound(service)],
      ['FROM barbeiros WHERE id = ?',          makeBound(barber)],
      ['FROM clientes',                        makeBound(client)],
      // Sem conflitos → null
      ['barbeiro_id = ?',                     makeBound(null)],
      ['cliente_id = ?',                      makeBound(null)],
    ])

    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(201)
    const body = await res.json() as { success: boolean; data: { id: number; barber_id: number } }
    expect(body.data.barber_id).toBe(1)
    expect(body.data.id).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 4. MODO ANY BARBER — pickBarber
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — modo anyBarber (barber_id ausente/"any"/0)', () => {
  const makeAnyReq = (barber_id?: unknown) =>
    makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, date: FUTURE_DATE, time: FUTURE_TIME, ...(barber_id !== undefined && { barber_id }) },
    })

  it('barber_id="any" com barbeiro disponível → 201', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barbers = [{ id: 1 }, { id: 2 }]
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }

    // computeSlots devolve o slot pedido para ambos os barbeiros
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME, '11:00', '12:00'])

    const db = makeDBRouted([
      ['FROM servicos',                     makeBound(service)],
      ['WHERE ativo = 1',                   makeBound(null, barbers)],
      // reservas existentes de cada barbeiro (all)
      ['v_reservas_duracao',                makeBound(null, [])],
      // indisponibilidades (all)
      ['horarios_indisponiveis',            makeBound(null, [])],
      // contagem de reservas no dia para desempate
      ['COUNT(*)',                          makeBound({ cnt: 0 })],
      // barbeiro final
      ['FROM barbeiros WHERE id = ?',       makeBound(barber)],
      ['FROM clientes',                     makeBound(client)],
      ['barbeiro_id = ?',                   makeBound(null)],
      ['cliente_id = ?',                    makeBound(null)],
    ])

    const req = makeAnyReq('any')
    const res = await handleReservations(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { barber_id: number } }
    expect(body.data.barber_id).toBeGreaterThan(0)
  })

  it('barber_id=0 é tratado como anyBarber → não retorna 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barbers = [{ id: 1 }]
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }

    const db = makeDBRouted([
      ['FROM servicos',              makeBound(service)],
      ['WHERE ativo = 1',            makeBound(null, barbers)],
      ['v_reservas_duracao',         makeBound(null, [])],
      ['horarios_indisponiveis',     makeBound(null, [])],
      ['FROM barbeiros WHERE id = ?', makeBound(barber)],
      ['FROM clientes',              makeBound(client)],
      ['barbeiro_id = ?',            makeBound(null)],
      ['cliente_id = ?',             makeBound(null)],
    ])

    const req = makeAnyReq(0)
    const res = await handleReservations(makeCtx(req, makeEnv(db)))
    // 201 se tudo ok, nunca deve ser 400 por barber_id=0
    expect(res.status).not.toBe(400)
  })

  it('sem barber_id é tratado como anyBarber → não retorna 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barbers = [{ id: 1 }]
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }

    const db = makeDBRouted([
      ['FROM servicos',              makeBound(service)],
      ['WHERE ativo = 1',            makeBound(null, barbers)],
      ['v_reservas_duracao',         makeBound(null, [])],
      ['horarios_indisponiveis',     makeBound(null, [])],
      ['FROM barbeiros WHERE id = ?', makeBound(barber)],
      ['FROM clientes',              makeBound(client)],
      ['barbeiro_id = ?',            makeBound(null)],
      ['cliente_id = ?',             makeBound(null)],
    ])

    const req = makeAnyReq()  // sem barber_id
    const res = await handleReservations(makeCtx(req, makeEnv(db)))
    expect(res.status).not.toBe(400)
  })

  it('anyBarber sem nenhum barbeiro disponível no slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    // computeSlots NÃO inclui o slot pedido → nenhum barbeiro disponível
    vi.mocked(computeSlots).mockReturnValue(['14:00', '15:00'])

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barbers = [{ id: 1 }, { id: 2 }]

    const db = makeDBRouted([
      ['FROM servicos',           makeBound(service)],
      ['WHERE ativo = 1',         makeBound(null, barbers)],
      ['v_reservas_duracao',      makeBound(null, [])],
      ['horarios_indisponiveis',  makeBound(null, [])],
    ])

    const req = makeAnyReq('any')
    const res = await handleReservations(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(409)
  })

  it('anyBarber em dia fechado (getOpenClose=null) → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    // Simular barbearia fechada neste dia
    vi.mocked(getOpenClose).mockReturnValueOnce(null)

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barbers = [{ id: 1 }]

    const db = makeDBRouted([
      ['FROM servicos',    makeBound(service)],
      ['WHERE ativo = 1',  makeBound(null, barbers)],
    ])

    const req = makeAnyReq('any')
    const res = await handleReservations(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(409)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 5. pickBarber — selecção por menos reservas no dia
// ════════════════════════════════════════════════════════════════════════════
describe('pickBarber — selecção por menos reservas', () => {
  it('escolhe o barbeiro com menos reservas no dia', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    // 2 barbeiros disponíveis; barbeiro 2 tem mais reservas hoje
    const barbers = [{ id: 1 }, { id: 2 }]
    const client  = { nome: 'Cliente', email: 'c@test.com' }

    const countCalls: number[] = []
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...args: unknown[]) => {
          if (sql.includes('FROM servicos'))            return makeBound(service)
          if (sql.includes('WHERE ativo = 1'))          return makeBound(null, barbers)
          if (sql.includes('v_reservas_duracao'))       return makeBound(null, [])
          if (sql.includes('horarios_indisponiveis'))   return makeBound(null, [])
          if (sql.includes('COUNT(*)')) {
            // barbeiro 1 → 1 reserva; barbeiro 2 → 3 reservas
            const barbId = args[0] as number
            countCalls.push(barbId)
            return makeBound({ cnt: barbId === 1 ? 1 : 3 })
          }
          if (sql.includes('FROM barbeiros WHERE id = ?')) return makeBound({ id: 1, nome: 'B1' })
          if (sql.includes('FROM clientes'))              return makeBound(client)
          return makeBound(null)
        }),
      })),
    }

    const req = makeRequest('POST', 'https://x.com/api/reservations', {
      body: { service_id: 1, date: FUTURE_DATE, time: FUTURE_TIME },
    })
    const res = await handleReservations(makeCtx(req, makeEnv(db as ReturnType<typeof makeDB>)))
    // Deve ser 201 e escolher o barbeiro 1 (menos reservas)
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { barber_id: number } }
    expect(body.data.barber_id).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 6. GET /api/slots-any-barber — validação e lógica
// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/slots-any-barber', () => {
  it('data inválida → 400', async () => {
    const req = makeRequest('GET', 'https://x.com/api/slots-any-barber?date=nao-data&service_id=1')
    const res = await handleSlotsAny(makeCtx(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('service_id=0 → 400', async () => {
    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=0`)
    const res = await handleSlotsAny(makeCtx(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('service_id negativo → 400', async () => {
    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=-1`)
    const res = await handleSlotsAny(makeCtx(req, makeEnv()))
    expect(res.status).toBe(400)
  })

  it('dia fechado (domingo) → 200 com array vazio', async () => {
    // getOpenClose mock devolve null para domingo (day=0)
    // 2099-06-01 = domingo
    const req = makeRequest('GET', 'https://x.com/api/slots-any-barber?date=2099-06-01&service_id=1')
    const res = await handleSlotsAny(makeCtx(req, makeEnv()))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toEqual([])
  })

  it('devolve slots em que pelo menos 1 barbeiro está disponível', async () => {
    const service = { id: 1, duracao: 30 }
    const barbers = [{ id: 1 }, { id: 2 }]

    // Barbeiro 1 tem slot 10:00; barbeiro 2 tem 10:00 e 11:00
    vi.mocked(computeSlots)
      .mockReturnValueOnce(['10:00', '11:00'])  // barbeiro 1
      .mockReturnValueOnce(['10:00'])            // barbeiro 2 — só 10:00

    const db = makeDBRouted([
      ['FROM servicos',           makeBound(service)],
      ['WHERE ativo = 1',         makeBound(null, barbers)],
      ['v_reservas_duracao',      makeBound(null, [])],
      ['horarios_indisponiveis',  makeBound(null, [])],
    ])

    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    // União: 10:00 (ambos) e 11:00 (só barbeiro 1)
    expect(body.data).toContain('10:00')
    expect(body.data).toContain('11:00')
    expect(body.data).toHaveLength(2)
  })

  it('slots estão ordenados cronologicamente', async () => {
    const service = { id: 1, duracao: 30 }
    const barbers = [{ id: 1 }, { id: 2 }]

    vi.mocked(computeSlots)
      .mockReturnValueOnce(['14:00', '10:00', '12:00'])
      .mockReturnValueOnce(['11:00', '09:00'])

    const db = makeDBRouted([
      ['FROM servicos',           makeBound(service)],
      ['WHERE ativo = 1',         makeBound(null, barbers)],
      ['v_reservas_duracao',      makeBound(null, [])],
      ['horarios_indisponiveis',  makeBound(null, [])],
    ])

    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeCtx(req, makeEnv(db)))
    const body = await res.json() as { data: string[] }
    const sorted = [...body.data].sort()
    expect(body.data).toEqual(sorted)
  })

  it('nenhum barbeiro activo → 200 com array vazio', async () => {
    const service = { id: 1, duracao: 30 }

    const db = makeDBRouted([
      ['FROM servicos',   makeBound(service)],
      ['WHERE ativo = 1', makeBound(null, [])],  // sem barbeiros
    ])

    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`)
    const res = await handleSlotsAny(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toEqual([])
  })

  it('serviço inexistente → 400', async () => {
    const db = makeDBRouted([
      ['FROM servicos',   makeBound(null)],       // serviço não encontrado
      ['WHERE ativo = 1', makeBound(null, [])],
    ])

    const req = makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=99`)
    const res = await handleSlotsAny(makeCtx(req, makeEnv(db)))
    expect(res.status).toBe(400)
  })
})
