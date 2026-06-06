/**
 * /api/discounts — rota raiz pública (não usada diretamente).
 *
 * As sub-rotas reais estão em ficheiros próprios:
 *   functions/api/discounts/general.js       → GET /api/discounts/general
 *   functions/api/discounts/client/[id].js   → GET /api/discounts/client/:id
 */

import { corsOptions } from '../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}
