/**
 * Utilitário de tempo/fuso horário
 * Centraliza toda a lógica de datas com suporte a DST (hora de verão/inverno)
 * para o fuso Europe/Lisbon.
 */

/**
 * Retorna a hora atual no fuso de Lisboa (UTC+0 inverno / UTC+1 verão).
 * Usa Intl para respeitar corretamente o DST, evitando offsets fixos.
 *
 * @returns {Date} instância Date com a hora de Lisboa como se fosse local
 */
export function getNowLisboa() {
  // 'sv-SE' produz ISO-like: "2026-04-07 14:50:00"
  const lisboaStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone:  'Europe/Lisbon',
    year:      'numeric',
    month:     '2-digit',
    day:       '2-digit',
    hour:      '2-digit',
    minute:    '2-digit',
    second:    '2-digit',
    hour12:    false,
  }).format(new Date())

  return new Date(lisboaStr.replace(' ', 'T'))
}

/**
 * Retorna a data de hoje no fuso de Lisboa (formato YYYY-MM-DD).
 * @returns {string}
 */
export function getTodayLisboa() {
  return getNowLisboa().toISOString().slice(0, 10)
}
