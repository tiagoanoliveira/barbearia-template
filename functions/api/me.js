import { authenticateClient } from '../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../utils/response.js'
import { hashPassword, verifyPassword } from '../utils/crypto.js'
import { sanitize } from '../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  // GET — perfil
  if (request.method === 'GET') {
    try {
      const client = await env.DB.prepare(
        'SELECT id, nome, email, telefone, nif, photo_url, created_at FROM clientes WHERE id = ?'
      ).bind(auth.clientId).first()

      if (!client) return notFound('Cliente não encontrado')

      return ok({
        id: client.id,
        name: client.nome,
        email: client.email,
        phone: client.telefone,
        nif: client.nif,
        photo_url: client.photo_url,
        created_at: client.created_at,
      })
    } catch (e) {
      return serverError('Erro ao carregar perfil', e.message)
    }
  }

  // PUT — actualizar perfil
  if (request.method === 'PUT') {
    try {
      const body = await request.json()
      const { name, email, phone, nif, current_password, new_password } = body

      if (!name) return badRequest('Nome é obrigatório')

      // Alterar password opcionalmente
      if (new_password) {
        if (!current_password) return badRequest('Password atual é necessária')
        if (new_password.length < 8) return badRequest('Nova password mínimo 8 caracteres')

        const client = await env.DB.prepare(
          'SELECT password_hash FROM clientes WHERE id = ?'
        ).bind(auth.clientId).first()

        const valid = await verifyPassword(current_password, client.password_hash)
        if (!valid) return badRequest('Password atual incorreta')

        const newHash = await hashPassword(new_password)
        await env.DB.prepare(
          'UPDATE clientes SET password_hash = ? WHERE id = ?'
        ).bind(newHash, auth.clientId).run()
      }

      await env.DB.prepare(
        'UPDATE clientes SET nome = ?, email = ?, telefone = ?, nif = ? WHERE id = ?'
      ).bind(
        sanitize(name, 100),
        sanitize(email ?? '', 200).toLowerCase(),
        sanitize(phone ?? '', 30),
        sanitize(nif ?? '', 20),
        auth.clientId
      ).run()

      return ok({ message: 'Perfil atualizado' })
    } catch (e) {
      return serverError('Erro ao atualizar perfil', e.message)
    }
  }

  return badRequest('Método não suportado')
}
