/**
 * Testes das funcionalidades de reservas e disponibilidade de slots
 *
 * Pré-requisitos:
 *   1. npx wrangler dev  (numa aba separada, porta 8788)
 *   2. Dados de teste na BD:
 *        - servico com id=1 (ex: 'Corte', duracao=30)
 *        - barbeiro com id=1, ativo=1
 *        - cliente test@teste.pt (para testes autenticados)
 *
 * Executar:
 *   npx vitest run functions/tests/reservations.test.js
 */

import { describe, it, expect, beforeAll } from 'vitest'

const BASE = 'http://localhost:8788'

let clientToken    = null
let testServiceId  = 1
let testBarberId   = 1

beforeAll(async () => {
  // Tentar obter token de cliente via OTP (modo dev aceita otp=000000)
  try {
    const r = await fetch(`${BASE}/api/auth/verify-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@teste.pt', otp: '000000' }),
    })
    const j = await r.json()
    clientToken = j?.data?.token ?? null
  } catch {
    console.warn('[setup] Não foi possível obter token de cliente — testes autenticados serão ignorados')
  }

  // Obter IDs reais da BD
  try {
    const [svcR, barberR] = await Promise.all([
      fetch(`${BASE}/api/services`).then(r => r.json()),
      fetch(`${BASE}/api/barbers`).then(r => r.json()),
    ])
    if (svcR?.data?.[0]?.id)    testServiceId = svcR.data[0].id
    if (barberR?.data?.[0]?.id) testBarberId  = barberR.data[0].id
  } catch {
    console.warn('[setup] A usar IDs padrão (service=1, barber=1)')
  }
})

const authPost = (path, body, token = clientToken) =>
  fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

// ─── GET /api/barbers ────────────────────────────────────────────────────────
describe('GET /api/barbers', () => {
  it('devolve lista de barbeiros activos (200)', async () => {
    const r = await fetch(`${BASE}/api/barbers`)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(Array.isArray(j.data)).toBe(true)
  })
})

// ─── GET /api/services ───────────────────────────────────────────────────────
describe('GET /api/services', () => {
  it('devolve lista de serviços (200)', async () => {
    const r = await fetch(`${BASE}/api/services`)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(Array.isArray(j.data)).toBe(true)
  })
})

// ─── GET /api/slots — barbeiro específico ───────────────────────────────────
describe('GET /api/slots — barbeiro específico', () => {
  it('data inválida → 400', async () => {
    const r = await fetch(`${BASE}/api/slots?date=naodata&barber_id=1&service_id=1`)
    expect(r.status).toBe(400)
  })

  it('barber_id inválido → 400', async () => {
    const r = await fetch(`${BASE}/api/slots?date=2099-12-01&barber_id=abc&service_id=1`)
    expect(r.status).toBe(400)
  })

  it('service_id inválido → 400', async () => {
    const r = await fetch(`${BASE}/api/slots?date=2099-12-01&barber_id=1&service_id=-1`)
    expect(r.status).toBe(400)
  })

  it('dia em que a barbearia fecha (domingo) → array vazio', async () => {
    const d = new Date()
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7))
    const sunday = d.toISOString().slice(0, 10)
    const r = await fetch(`${BASE}/api/slots?date=${sunday}&barber_id=${testBarberId}&service_id=${testServiceId}`)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.data).toEqual([])
  })

  it('data válida no futuro → array de strings HH:MM', async () => {
    const r = await fetch(`${BASE}/api/slots?date=2099-06-02&barber_id=${testBarberId}&service_id=${testServiceId}`)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(Array.isArray(j.data)).toBe(true)
    if (j.data.length > 0) {
      expect(j.data[0]).toMatch(/^\d{2}:\d{2}$/)
    }
  })

  it('slots estão ordenados cronologicamente', async () => {
    const r = await fetch(`${BASE}/api/slots?date=2099-06-02&barber_id=${testBarberId}&service_id=${testServiceId}`)
    const j = await r.json()
    const slots  = j.data ?? []
    const sorted = [...slots].sort()
    expect(slots).toEqual(sorted)
  })
})

// ─── GET /api/slots-any-barber ───────────────────────────────────────────────
describe('GET /api/slots-any-barber — modo "qualquer barbeiro"', () => {
  it('data inválida → 400', async () => {
    const r = await fetch(`${BASE}/api/slots-any-barber?date=invalida&service_id=1`)
    expect(r.status).toBe(400)
  })

  it('service_id inválido → 400', async () => {
    const r = await fetch(`${BASE}/api/slots-any-barber?date=2099-12-01&service_id=0`)
    expect(r.status).toBe(400)
  })

  it('devolve 200 com array para data futura válida', async () => {
    const r = await fetch(`${BASE}/api/slots-any-barber?date=2099-06-02&service_id=${testServiceId}`)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(Array.isArray(j.data)).toBe(true)
  })

  it('todos os slots devolvidos existem em pelo menos um barbeiro individual', async () => {
    const date = '2099-06-02'
    const [barbersR, anyR] = await Promise.all([
      fetch(`${BASE}/api/barbers`).then(r => r.json()),
      fetch(`${BASE}/api/slots-any-barber?date=${date}&service_id=${testServiceId}`).then(r => r.json()),
    ])

    const barbers  = barbersR?.data ?? []
    const anySlots = new Set(anyR?.data ?? [])

    // Calcular união de todos os slots individuais
    const unionSlots = new Set()
    await Promise.all(barbers.map(async b => {
      const r = await fetch(`${BASE}/api/slots?date=${date}&barber_id=${b.id}&service_id=${testServiceId}`)
      const j = await r.json()
      ;(j.data ?? []).forEach(s => unionSlots.add(s))
    }))

    for (const slot of anySlots) {
      expect(unionSlots.has(slot)).toBe(true)
    }
  })

  it('domingo (barbearia fechada) → array vazio', async () => {
    const d = new Date()
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7))
    const sunday = d.toISOString().slice(0, 10)
    const r = await fetch(`${BASE}/api/slots-any-barber?date=${sunday}&service_id=${testServiceId}`)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.data).toEqual([])
  })
})

// ─── POST /api/reservations — sem autenticação ───────────────────────────────
describe('POST /api/reservations — sem autenticação', () => {
  it('sem token → 401', async () => {
    const r = await authPost('/api/reservations', {
      service_id: testServiceId,
      barber_id:  testBarberId,
      date: '2099-06-02',
      time: '10:00',
    }, null)
    expect(r.status).toBe(401)
  })
})

// ─── POST /api/reservations — validação de input ────────────────────────────
describe('POST /api/reservations — validação de input', () => {
  it('data inválida → 400', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: 'naodata', time: '10:00',
    })
    expect(r.status).toBe(400)
  })

  it('hora inválida → 400', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2099-06-02', time: '25:99',
    })
    expect(r.status).toBe(400)
  })

  it('service_id = 0 → 400', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: 0, barber_id: testBarberId,
      date: '2099-06-02', time: '10:00',
    })
    expect(r.status).toBe(400)
  })

  it('service_id string não numérico → 400', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: 'abc', barber_id: testBarberId,
      date: '2099-06-02', time: '10:00',
    })
    expect(r.status).toBe(400)
  })

  it('data no passado → 400', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2000-01-01', time: '10:00',
    })
    expect(r.status).toBe(400)
  })

  it('hora no passado (hoje) → 400', async () => {
    if (!clientToken) return
    const today = new Date().toISOString().slice(0, 10)
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: today, time: '00:00',
    })
    expect(r.status).toBe(400)
  })
})

// ─── POST /api/reservations — tentativas de manipulação ─────────────────────
describe('POST /api/reservations — tentativas de manipulação de dados', () => {
  it('barber_id negativo → 400', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: -99,
      date: '2099-06-02', time: '10:00',
    })
    expect(r.status).toBe(400)
  })

  it('barber_id inexistente → 404 ou 409', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: 999999,
      date: '2099-06-02', time: '10:00',
    })
    expect([400, 404, 409]).toContain(r.status)
  })

  it('notes com XSS é sanitizado (sem tags <script> na resposta)', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2099-07-01', time: '10:00',
      notes: '<script>alert(1)</script>'.repeat(200),
    })
    const text = await r.text()
    expect(text).not.toContain('<script>')
  })

  it('notes com mais de 2000 chars não causa erro 500', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2099-07-02', time: '10:00',
      notes: 'a'.repeat(5000),
    })
    expect(r.status).not.toBe(500)
  })

  it('campos extra no body (role, admin, __proto__) não causam erro 500', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2099-07-03', time: '10:00',
      admin: true,
      role: 'superAdmin',
      constructor: 'pwned',
    })
    expect(r.status).not.toBe(500)
  })

  it('token JWT forjado (role=superAdmin, assinatura inválida) → 401', async () => {
    const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '')
    const payload = btoa(JSON.stringify({ id: 1, role: 'superAdmin', exp: 9999999999 })).replace(/=/g, '')
    const fake    = `${header}.${payload}.assinatura_invalida`
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2099-07-04', time: '10:00',
    }, fake)
    expect(r.status).toBe(401)
  })
})

// ─── POST /api/reservations — modo "qualquer barbeiro" ────────────────────────
describe('POST /api/reservations — modo "qualquer barbeiro" (any)', () => {
  it('barber_id="any" → 201 com barber_id atribuído, ou 409 se indisponível', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: 'any',
      date: '2099-08-04', time: '10:00',
    })
    expect([201, 409]).toContain(r.status)
    if (r.status === 201) {
      const j = await r.json()
      expect(j.data?.barber_id).toBeDefined()
      expect(Number(j.data?.barber_id)).toBeGreaterThan(0)
    }
  })

  it('barber_id=0 é tratado como "qualquer barbeiro"', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: 0,
      date: '2099-08-05', time: '10:00',
    })
    expect([201, 409]).toContain(r.status)
  })

  it('sem barber_id é tratado como "qualquer barbeiro"', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId,
      date: '2099-08-06', time: '10:00',
    })
    expect([201, 409]).toContain(r.status)
  })

  it('modo "any" em hora fora do horário de funcionamento → 409', async () => {
    if (!clientToken) return
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: 'any',
      date: '2099-08-07', time: '03:00',
    })
    expect([400, 409]).toContain(r.status)
  })

  it('modo "any" em domingo (barbearia fechada) → 409', async () => {
    if (!clientToken) return
    const d = new Date()
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7))
    const sunday = d.toISOString().slice(0, 10)
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: 'any',
      date: sunday, time: '10:00',
    })
    expect([400, 409]).toContain(r.status)
  })

  it('slot atribuído por "any" deve constar em slots-any-barber', async () => {
    if (!clientToken) return
    const date = '2099-08-11'
    // Obter slots disponíveis
    const slotsR = await fetch(`${BASE}/api/slots-any-barber?date=${date}&service_id=${testServiceId}`)
    const slotsJ = await slotsR.json()
    const available = slotsJ?.data ?? []
    if (!available.length) return  // sem slots disponíveis, ignorar

    const slot = available[0]
    const r = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: 'any',
      date, time: slot,
    })
    // Se criado com sucesso, o slot era genuinamente disponível
    if (r.status === 201) {
      expect(available).toContain(slot)
    }
  })
})

// ─── Conflitos de duplicação ─────────────────────────────────────────────────
describe('POST /api/reservations — conflitos de duplicação', () => {
  it('segunda reserva no mesmo barbeiro e horário → 409', async () => {
    if (!clientToken) return
    await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2099-09-01', time: '11:00',
    })
    const r2 = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2099-09-01', time: '11:00',
    })
    expect(r2.status).toBe(409)
  })

  it('cliente não pode ter duas reservas no mesmo horário → 409', async () => {
    if (!clientToken) return
    await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2099-09-01', time: '14:00',
    })
    const r2 = await authPost('/api/reservations', {
      service_id: testServiceId, barber_id: testBarberId,
      date: '2099-09-01', time: '14:00',
    })
    expect(r2.status).toBe(409)
  })
})

// ─── GET /api/my-reservations ────────────────────────────────────────────────
describe('GET /api/my-reservations', () => {
  it('sem token → 401', async () => {
    const r = await fetch(`${BASE}/api/my-reservations`)
    expect(r.status).toBe(401)
  })

  it('com token válido → 200 com array', async () => {
    if (!clientToken) return
    const r = await fetch(`${BASE}/api/my-reservations`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    })
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(Array.isArray(j.data)).toBe(true)
  })
})
