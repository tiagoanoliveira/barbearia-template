/**
 * Testes de reservas — mocks puros (vi.mock + vi.fn), sem servidor real.
 *
 * Cobre:
 *  - Validação de input (data, hora, service_id, barber_id)
 *  - Rejeição de datas passadas
 *  - Conflitos de horário (barbeiro e cliente)
 *  - Criação com sucesso — barbeiro específico
 *  - Modo anyBarber: pickBarber selecciona por disponibilidade real (computeSlots)
 *  - pickBarber: ordena por nº de reservas crescente
 *  - pickBarber: devolve null quando barbearia está fechada
 *  - pickBarber: devolve null quando nenhum barbeiro tem o slot disponível
 *  - Manipulação: barber_id negativo
 *  - GET /api/slots-any-barber: validação e lógica de união de slots
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks globais ───────────────────────────────────────────────────────────────────────
vi.mock('../functions/utils/auth.js', () => ({
  authenticateClient: vi.fn(),
  authenticateAdmin:  vi.fn(),
}))
vi.mock('../functions/utils/email.js', () => ({
  sendEmail:              vi.fn(),
  buildEmailChangeEmail:  vi.fn().mockReturnValue({ html: '' }),
  buildVerificationEmail: vi.fn().mockReturnValue({ html: '' }),
  isPlaceholderEmail:     vi.fn().mockReturnValue(false),
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
 * computeSlots: por omissão devolve slots de 30 em 30 entre open e close.
 * Cada teste pode sobrescrever com mockReturnValueOnce/mockReturnValue.
 *
 * getOpenClose: segâ–sáb abertos (09:00–19:00); domingo fechado.
 */
vi.mock('../functions/utils/slots.js', () => ({
  computeSlots: vi.fn(({ openHour = '09:00', closeHour = '19:00' } = {}) => {
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

import { onRequest as handleReservations } from '../functions/api/reservations.js'
import { onRequest as handleSlotsAny }     from '../functions/api/slots-any-barber.js'
import { authenticateClient }              from '../functions/utils/auth.js'
import { computeSlots, getOpenClose }      from '../functions/utils/slots.js'

// ── Constantes ───────────────────────────────────────────────────────────────────────────
const FUTURE_DATE  = '2099-06-02'   // segunda-feira
const FUTURE_TIME  = '10:00'
const CLIENT_AUTH  = { success: true, clientId: 1, role: 'client', payload: { id: 1 } }
const AUTH_FAIL    = { success: false }

// ── Helpers ───────────────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: Record<string, unknown>): Request {
  return new Request(url, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: body != null ? JSON.stringify(body) : undefined,
  })
}

/** Cria um stub de prepared statement que devolve first/all/run fixos */
function stub(first: unknown = null, results: unknown[] = []) {
  return {
    first: vi.fn().mockResolvedValue(first),
    all:   vi.fn().mockResolvedValue({ results }),
    run:   vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 42 } }),
  }
}

/**
 * Cria um mock de env.DB onde prepare(sql).bind(...) delega para um handler
 * recebido como argumento. O handler recebe (sql, args) e devolve um stub.
 */
function makeEnv(handler: (sql: string, args: unknown[]) => ReturnType<typeof stub>) {
  return {
    DB: {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...args: unknown[]) => handler(sql, args)),
      })),
    },
    JWT_SECRET: 'test-secret',
    JWT_ADMIN_SECRET: 'test-admin-secret',
  }
}

function makeCtx(req: Request, env: ReturnType<typeof makeEnv>) {
  return { request: req, env, params: {}, waitUntil: vi.fn() }
}

beforeEach(() => vi.clearAllMocks())

// ══ 1. VALIDAÇÃO DE INPUT ═══════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — validação de input', () => {
  it('sem autenticação → 401', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(AUTH_FAIL)
    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME }),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(401)
  })

  it('service_id = 0 → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 0, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME }),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(400)
  })

  it('barber_id negativo → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: -5, date: FUTURE_DATE, time: FUTURE_TIME }),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(400)
  })

  it('data inválida → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 1, date: 'nao-data', time: FUTURE_TIME }),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(400)
  })

  it('hora inválida → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: '25:99' }),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(400)
  })

  it('data no passado → 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 1, date: '2000-01-01', time: '10:00' }),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(400)
  })

  it('serviço inexistente → 404', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    // Todas as queries devolvem null/vazio → servico.first() = null
    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 99, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME }),
      makeEnv(() => stub(null)),
    ))
    expect(res.status).toBe(404)
  })
})

// ══ 2. CONFLITOS DE HORÁRIO ═══════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — conflitos de horário', () => {
  it('barbeiro já tem reserva no mesmo slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const env = makeEnv((sql) => {
      if (sql.includes('FROM servicos'))   return stub(service)
      // conflictBarber, conflictClient, barber — via Promise.all
      // A primeira query de reservas (barbeiro) devolve conflito
      if (sql.includes('FROM reservas WHERE barbeiro_id')) return stub({ id: 77 })
      return stub(null)
    })

    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME }),
      env,
    ))
    expect(res.status).toBe(409)
  })

  it('cliente já tem reserva no mesmo slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: 1, nome: 'Barbeiro A' }
    const env = makeEnv((sql) => {
      if (sql.includes('FROM servicos'))                    return stub(service)
      if (sql.includes('FROM reservas WHERE barbeiro_id'))  return stub(null)       // sem conflito barbeiro
      if (sql.includes('FROM reservas WHERE cliente_id'))   return stub({ id: 88 }) // conflito cliente
      if (sql.includes('FROM barbeiros WHERE id'))          return stub(barber)
      return stub(null)
    })

    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME }),
      env,
    ))
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

    const env = makeEnv((sql) => {
      if (sql.includes('FROM servicos'))                   return stub(service)
      if (sql.includes('FROM reservas WHERE barbeiro_id')) return stub(null)
      if (sql.includes('FROM reservas WHERE cliente_id'))  return stub(null)
      if (sql.includes('FROM barbeiros WHERE id'))         return stub(barber)
      if (sql.includes('FROM clientes'))                  return stub(client)
      if (sql.includes('INSERT INTO reservas'))           return stub(null, [], { meta: { changes: 1, last_row_id: 42 } })
      if (sql.includes('INSERT INTO notifications'))      return stub()
      return stub()
    })

    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 1, date: FUTURE_DATE, time: FUTURE_TIME }),
      env,
    ))
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { id: number; barber_id: number } }
    expect(body.data.barber_id).toBe(1)
    expect(body.data.id).toBeGreaterThan(0)
  })
})

// ══ 4. MODO ANY BARBER ═══════════════════════════════════════════════════════════════════════
describe('POST /api/reservations — modo anyBarber', () => {
  /**
   * Cria um env completo para o fluxo anyBarber happy path.
   * computeSlots é controlado externamente via vi.mocked().
   */
  function makeAnyBarberEnv(barbers: { id: number }[], barberId: number = 1) {
    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber  = { id: barberId, nome: 'Barbeiro A' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }

    return makeEnv((sql) => {
      if (sql.includes('FROM servicos'))                   return stub(service)
      if (sql.includes('WHERE ativo = 1'))                 return stub(null, barbers)
      if (sql.includes('v_reservas_duracao'))              return stub(null, [])
      if (sql.includes('horarios_indisponiveis'))          return stub(null, [])
      if (sql.includes('COUNT(*) as cnt'))                 return stub({ cnt: 0 })
      if (sql.includes('FROM barbeiros WHERE id'))         return stub(barber)
      if (sql.includes('FROM clientes'))                  return stub(client)
      if (sql.includes('FROM reservas WHERE barbeiro_id')) return stub(null)
      if (sql.includes('FROM reservas WHERE cliente_id'))  return stub(null)
      if (sql.includes('INSERT INTO notifications'))       return stub()
      return stub()
    })
  }

  it('barber_id="any" com barbeiro disponível → 201 com barber_id atribuído', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME, '11:00'])

    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 'any', date: FUTURE_DATE, time: FUTURE_TIME }),
      makeAnyBarberEnv([{ id: 1 }, { id: 2 }]),
    ))
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { barber_id: number } }
    expect(body.data.barber_id).toBeGreaterThan(0)
  })

  it('barber_id=0 é tratado como anyBarber → não retorna 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])

    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 0, date: FUTURE_DATE, time: FUTURE_TIME }),
      makeAnyBarberEnv([{ id: 1 }]),
    ))
    expect(res.status).not.toBe(400)
  })

  it('sem barber_id é tratado como anyBarber → não retorna 400', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])

    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, date: FUTURE_DATE, time: FUTURE_TIME }),
      makeAnyBarberEnv([{ id: 1 }]),
    ))
    expect(res.status).not.toBe(400)
  })

  it('anyBarber sem nenhum barbeiro disponível no slot → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    // computeSlots não inclui o slot pedido
    vi.mocked(computeSlots).mockReturnValue(['14:00', '15:00'])

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const env = makeEnv((sql) => {
      if (sql.includes('FROM servicos'))          return stub(service)
      if (sql.includes('WHERE ativo = 1'))        return stub(null, [{ id: 1 }, { id: 2 }])
      if (sql.includes('v_reservas_duracao'))     return stub(null, [])
      if (sql.includes('horarios_indisponiveis')) return stub(null, [])
      return stub(null)
    })

    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 'any', date: FUTURE_DATE, time: FUTURE_TIME }),
      env,
    ))
    expect(res.status).toBe(409)
  })

  it('anyBarber em dia fechado (getOpenClose=null) → 409', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(getOpenClose).mockReturnValueOnce(null)

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const env = makeEnv((sql) => {
      if (sql.includes('FROM servicos'))   return stub(service)
      if (sql.includes('WHERE ativo = 1')) return stub(null, [{ id: 1 }])
      return stub(null)
    })

    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, barber_id: 'any', date: FUTURE_DATE, time: FUTURE_TIME }),
      env,
    ))
    expect(res.status).toBe(409)
  })
})

// ══ 5. pickBarber — selecção por menos reservas ═══════════════════════════════════════════════════════
describe('pickBarber — selecção por menos reservas no dia', () => {
  it('escolhe o barbeiro com menos reservas', async () => {
    vi.mocked(authenticateClient).mockResolvedValue(CLIENT_AUTH)
    vi.mocked(computeSlots).mockReturnValue([FUTURE_TIME])

    const service = { id: 1, nome: 'Corte', duracao: 30 }
    const barber1 = { id: 1, nome: 'B1' }
    const client  = { nome: 'Cliente', email: 'c@test.com' }

    // Barbeiro 1: 1 reserva hoje; barbeiro 2: 3 reservas hoje → deve escolher B1
    const env = makeEnv((sql, args) => {
      if (sql.includes('FROM servicos'))                   return stub(service)
      if (sql.includes('WHERE ativo = 1'))                 return stub(null, [{ id: 1 }, { id: 2 }])
      if (sql.includes('v_reservas_duracao'))              return stub(null, [])
      if (sql.includes('horarios_indisponiveis'))          return stub(null, [])
      if (sql.includes('COUNT(*) as cnt')) {
        // args[0] é o barbeiro_id
        const bid = args[0] as number
        return stub({ cnt: bid === 1 ? 1 : 3 })
      }
      if (sql.includes('FROM barbeiros WHERE id'))         return stub(barber1)
      if (sql.includes('FROM clientes'))                  return stub(client)
      if (sql.includes('FROM reservas WHERE barbeiro_id')) return stub(null)
      if (sql.includes('FROM reservas WHERE cliente_id'))  return stub(null)
      if (sql.includes('INSERT INTO notifications'))       return stub()
      return stub()
    })

    const res = await handleReservations(makeCtx(
      makeRequest('POST', 'https://x.com/api/reservations',
        { service_id: 1, date: FUTURE_DATE, time: FUTURE_TIME }),
      env,
    ))
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { barber_id: number } }
    expect(body.data.barber_id).toBe(1)
  })
})

// ══ 6. GET /api/slots-any-barber ═══════════════════════════════════════════════════════════════════════
describe('GET /api/slots-any-barber', () => {
  function makeSlotsEnv(service: unknown, barbers: unknown[]) {
    return makeEnv((sql) => {
      if (sql.includes('FROM servicos'))         return stub(service)
      if (sql.includes('WHERE ativo = 1'))       return stub(null, barbers)
      if (sql.includes('v_reservas_duracao'))    return stub(null, [])
      if (sql.includes('horarios_indisponiveis')) return stub(null, [])
      return stub(null)
    })
  }

  it('data inválida → 400', async () => {
    const res = await handleSlotsAny(makeCtx(
      makeRequest('GET', 'https://x.com/api/slots-any-barber?date=nao-data&service_id=1'),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(400)
  })

  it('service_id=0 → 400', async () => {
    const res = await handleSlotsAny(makeCtx(
      makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=0`),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(400)
  })

  it('service_id negativo → 400', async () => {
    const res = await handleSlotsAny(makeCtx(
      makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=-1`),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(400)
  })

  it('dia fechado (domingo 2099-06-01) → 200 com array vazio', async () => {
    // 2099-06-01 = domingo → getOpenClose(0) = null (definido no mock global)
    const res = await handleSlotsAny(makeCtx(
      makeRequest('GET', 'https://x.com/api/slots-any-barber?date=2099-06-01&service_id=1'),
      makeEnv(() => stub()),
    ))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toEqual([])
  })

  it('serviço inexistente → 400', async () => {
    const res = await handleSlotsAny(makeCtx(
      makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=99`),
      makeSlotsEnv(null, []),  // service = null
    ))
    expect(res.status).toBe(400)
  })

  it('nenhum barbeiro activo → 200 com array vazio', async () => {
    const service = { id: 1, duracao: 30 }
    const res = await handleSlotsAny(makeCtx(
      makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`),
      makeSlotsEnv(service, []),  // barbers = []
    ))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    expect(body.data).toEqual([])
  })

  it('devolve união dos slots de todos os barbeiros', async () => {
    const service = { id: 1, duracao: 30 }
    const barbers = [{ id: 1 }, { id: 2 }]

    // Barbeiro 1: ['10:00', '11:00']; barbeiro 2: ['10:00']
    vi.mocked(computeSlots)
      .mockReturnValueOnce(['10:00', '11:00'])
      .mockReturnValueOnce(['10:00'])

    const res = await handleSlotsAny(makeCtx(
      makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`),
      makeSlotsEnv(service, barbers),
    ))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
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

    const res = await handleSlotsAny(makeCtx(
      makeRequest('GET', `https://x.com/api/slots-any-barber?date=${FUTURE_DATE}&service_id=1`),
      makeSlotsEnv(service, barbers),
    ))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: string[] }
    const sorted = [...body.data].sort()
    expect(body.data).toEqual(sorted)
  })
})
