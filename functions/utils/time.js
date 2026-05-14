/**
 * Utilitário de tempo/fuso horário
 * Centraliza toda a lógica de datas com suporte a DST (hora de verão/inverno)
 * para o fuso Europe/Lisbon.
 */

export function getNowLisboa() {
  // Obtém o offset real de Lisboa neste momento (minutos, inclui DST)
  const now = new Date()
  const lisboaMs = now.getTime() + getOffsetMs(now)
  return new Date(lisboaMs)
}

function getOffsetMs(date) {
  // Compara a hora UTC com a hora de Lisboa para calcular o offset em ms
  const utcStr   = formatInTZ(date, 'UTC')
  const lisboaStr = formatInTZ(date, 'Europe/Lisbon')
  return (new Date(lisboaStr) - new Date(utcStr))
}

function formatInTZ(date, tz) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T')
}
