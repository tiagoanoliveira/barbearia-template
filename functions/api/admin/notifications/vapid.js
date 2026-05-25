import { ok, serverError, corsOptions } from '../utils/response.js'

export async function onRequest(context) {
    const { env } = context
    if (context.request.method === 'OPTIONS') return corsOptions()

    const key = env.VAPID_PUBLIC_KEY
    if (!key) return serverError('VAPID_PUBLIC_KEY não configurada')

    return ok({ vapidPublicKey: key })
}