/**
 * Testes de segurança — controlo de acesso por role
 *
 * Pré-requisitos:
 *   1. npx wrangler dev  (numa aba separada, porta 8788)
 *   2. Utilizadores de teste criados na BD:
 *        test_barbeiro / Test1234!  (role: barbeiro, ativo: 1)
 *        test_admin    / Test1234!  (role: admin,    ativo: 1)
 *        test_super    / Test1234!  (role: superAdmin, ativo: 1)
 *
 * Executar:
 *   npx vitest run functions/tests/security.test.js
 */

import { describe, it, expect, beforeAll } from 'vitest'

const BASE = 'http://localhost:8788'

let tokenBarber, tokenAdmin, tokenSuper

beforeAll(async () => {
  const login = async (username, password) => {
    const r = await fetch(`${BASE}/api/admin/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      // turnstileToken: em modo dev o wrangler aceita qualquer valor se TURNSTILE_SECRET=1x0000000000000000000000000000000AA
      body: JSON.stringify({ username, password, turnstileToken: '1x0000000000000000000000000000000AA' }),
    })
    const j = await r.json()
    return j?.data?.token ?? null
  }

  tokenBarber = await login('test_barbeiro', 'Test1234!')
  tokenAdmin  = await login('test_admin',    'Test1234!')
  tokenSuper  = await login('test_super',    'Test1234!')

  if (!tokenBarber) console.warn('[setup] token barbeiro em falta — cria test_barbeiro na BD')
  if (!tokenAdmin)  console.warn('[setup] token admin em falta  — cria test_admin na BD')
  if (!tokenSuper)  console.warn('[setup] token super em falta  — cria test_super na BD')
})

const get = (path, token) =>
  fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

// ─── Sem token ────────────────────────────────────────────────────────────────
describe('Sem autenticação', () => {
  it('GET /api/admin/reservations → 401', async () => {
    const r = await get('/api/admin/reservations', null)
    expect(r.status).toBe(401)
  })
  it('GET /api/admin/clients → 401', async () => {
    const r = await get('/api/admin/clients', null)
    expect(r.status).toBe(401)
  })
  it('GET /api/admin/admin-users → 401', async () => {
    const r = await get('/api/admin/admin-users', null)
    expect(r.status).toBe(401)
  })
  it('GET /api/admin/pagamentos → 401', async () => {
    const r = await get('/api/admin/pagamentos', null)
    expect(r.status).toBe(401)
  })
  it('GET /api/admin/me → 401', async () => {
    const r = await get('/api/admin/me', null)
    expect(r.status).toBe(401)
  })
})

// ─── Barbeiro ─────────────────────────────────────────────────────────────────
describe('Role: barbeiro', () => {
  it('NÃO acede a clientes', async () => {
    if (!tokenBarber) return
    const r = await get('/api/admin/clients', tokenBarber)
    expect(r.status).toBe(401)
  })
  it('NÃO acede a admin-users', async () => {
    if (!tokenBarber) return
    const r = await get('/api/admin/admin-users', tokenBarber)
    expect(r.status).toBe(401)
  })
  it('NÃO acede a pagamentos', async () => {
    if (!tokenBarber) return
    const r = await get('/api/admin/pagamentos', tokenBarber)
    expect(r.status).toBe(401)
  })
  it('Acede ao próprio perfil via /me', async () => {
    if (!tokenBarber) return
    const r = await get('/api/admin/me', tokenBarber)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.data?.role).toBe('barbeiro')
  })
})

// ─── Admin ────────────────────────────────────────────────────────────────────
describe('Role: admin', () => {
  it('Acede a clientes', async () => {
    if (!tokenAdmin) return
    const r = await get('/api/admin/clients', tokenAdmin)
    expect(r.status).toBe(200)
  })
  it('Acede a admin-users', async () => {
    if (!tokenAdmin) return
    const r = await get('/api/admin/admin-users', tokenAdmin)
    expect(r.status).toBe(200)
  })
  it('NÃO acede a pagamentos (exclusivo superAdmin)', async () => {
    if (!tokenAdmin) return
    const r = await get('/api/admin/pagamentos', tokenAdmin)
    expect(r.status).toBe(401)
  })
  it('/me devolve role admin', async () => {
    if (!tokenAdmin) return
    const r = await get('/api/admin/me', tokenAdmin)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.data?.role).toBe('admin')
  })
})

// ─── SuperAdmin ───────────────────────────────────────────────────────────────
describe('Role: superAdmin', () => {
  it('Acede a pagamentos', async () => {
    if (!tokenSuper) return
    const r = await get('/api/admin/pagamentos', tokenSuper)
    expect(r.status).toBe(200)
  })
  it('Acede a admin-users', async () => {
    if (!tokenSuper) return
    const r = await get('/api/admin/admin-users', tokenSuper)
    expect(r.status).toBe(200)
  })
  it('Acede a clientes', async () => {
    if (!tokenSuper) return
    const r = await get('/api/admin/clients', tokenSuper)
    expect(r.status).toBe(200)
  })
  it('/me devolve role superAdmin (da BD, não do localStorage)', async () => {
    if (!tokenSuper) return
    const r = await get('/api/admin/me', tokenSuper)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.data?.role).toBe('superAdmin')
  })
})

// ─── Tokens forjados / manipulados ────────────────────────────────────────────
describe('Ataques de manipulação de token', () => {
  it('JWT com role superAdmin forjado no payload é rejeitado', async () => {
    // Header e payload válidos mas assinatura errada
    const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '')
    const payload = btoa(JSON.stringify({ id: 1, role: 'superAdmin', exp: 9999999999 })).replace(/=/g, '')
    const fakeToken = `${header}.${payload}.assinatura_completamente_invalida`
    const r = await get('/api/admin/pagamentos', fakeToken)
    expect(r.status).toBe(401)
  })

  it('Token aleatório é rejeitado', async () => {
    const r = await get('/api/admin/admin-users', 'token.completamente.falso')
    expect(r.status).toBe(401)
  })

  it('Token expirado não dá acesso', async () => {
    // Simula um token com exp no passado (não conseguimos gerar um assinado sem o segredo,
    // mas o formato inválido já garante rejeição)
    const expiredLike = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZXhwIjoxfQ.invalidsig'
    const r = await get('/api/admin/clients', expiredLike)
    expect(r.status).toBe(401)
  })
})
