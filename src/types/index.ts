// ─── Barbeiro ───────────────────────────────────────────────────────────────────────────────
export interface Barber {
  id: number
  name: string
  foto?: string
  especialidades?: string
  color?: string
  active: boolean
}

// ─── Serviço ──────────────────────────────────────────────────────────────────────────────
export interface Service {
  id: number
  name: string
  duration: number
  price: number
  min_price?: number | null
  has_price_variation?: boolean
  min_duration?: number | null
  has_duration_variation?: boolean
  barber_overrides?: BarberServiceOverride[]
  svg?: string
  abreviacao?: string
  color?: string
}


interface BarberServiceOverride {
  barbeiro_id: number
  barber_name: string
  preco:       number | null
  duracao:     number | null
  ativo:       boolean
}

// ─── Desconto ─────────────────────────────────────────────────────────────────────────────
export interface Discount {
  id: number

  /**
   * null  → desconto geral (aplicável a todos os clientes)
   * number → desconto exclusivo desse cliente
   */
  client_id: number | null

  name: string
  description?: string | null

  /**
   * Tipo livre — não usar union para permitir extensão em runtime.
   * Valores conhecidos: 'fidelizacao' | 'mensal' | 'vitalicio' | 'ocasional' | 'campanha' | 'quantidade' | 'servico'
   */
  type: string

  /** Origem: 'manual' | 'trigger_fidelizacao' | 'campanha' | ... */
  origin?: string | null

  /** Percentagem de desconto (0–100). null se usar valor fixo. */
  value_percent?: number | null

  /** Valor fixo em cêntimos (ex: 500 = 5,00€). null se usar percentagem. */
  value_fixed?: number | null

  /** Data de início de validade (ISO 8601) */
  valid_from?: string | null

  /** Data de fim de validade (ISO 8601) */
  valid_to?: string | null

  /**
   * Número mínimo de reservas concluídas/confirmadas no período indicado.
   * null = sem requisito de quantidade.
   */
  min_reservations?: number | null

  /**
   * Período para cálculo de min_reservations.
   * Exemplos: 'semana', 'quinzena', 'mes', 'trimestre', 'semestre', 'ano'.
   * null = sem requisito de período.
   */
  min_reservations_period?: string | null

  /**
   * Identificador de grupo de "programa" (descontos escalonados).
   * Ex.: 'frequencia-mensal' → apenas o melhor desconto desse grupo é usado.
   * null = desconto isolado (não pertence a nenhum programa).
   */
  group?: string | null

  /**
   * Tipo de regra avançada para descontos baseados em serviços.
   * Exemplos: 'bogo', 'percent_x_servicos'.
   */
  rule_type?: string | null

  /**
   * Detalhe da regra em JSON serializado.
   * Ex.: '{"trigger_service_id":1,"free_service_id":2}'.
   */
  rule_detail?: string | null

  /**
   * Número máximo de vezes que o desconto pode ser usado.
   * null = ilimitado (vitalício); 1 = ocasional (one-shot).
   */
  max_uses?: number | null

  /** Quantidade de vezes que já foi usado */
  used_count: number

  /** Última vez que foi usado (ISO 8601) */
  last_used_at?: string | null

  /** ID da reserva onde foi usado pela última vez */
  last_used_reservation_id?: number | null

  /** Comentário sobre o uso (onde/quando) — preenchido automaticamente no checkout */
  usage_comment?: string | null

  active: boolean

  created_by_admin_id?: number | null
  created_at: string
  updated_at: string
}

/**
 * Helper: verifica se um desconto está efetivamente aplicável
 * (ativo, dentro da validade, e ainda tem usos disponíveis).
 * Nota: a verificação de min_reservations é feita na API, que já
 * devolve apenas os descontos cujos critérios de quantidade estão cumpridos.
 */
export function isDiscountUsable(d: Discount): boolean {
  if (!d.active) return false
  const now = new Date()
  if (d.valid_from && new Date(d.valid_from) > now) return false
  if (d.valid_to   && new Date(d.valid_to)   < now) return false
  if (d.max_uses != null && d.used_count >= d.max_uses) return false
  return true
}

// ─── Cliente ─────────────────────────────────────────────────────────────────────────────
export interface Client {
  id: number
  name: string
  email?: string
  phone?: string
  photo_url?: string
  notes?: string
  nif?: number
  created_at: string
  reservas_concluidas?: number
  /**
   * @deprecated Usar tabela descontos (tipo='fidelizacao') em vez deste campo.
   * Mantido temporariamente por compatibilidade com triggers existentes.
   */
  reservas_gratuitas_disponiveis?: number
  next_appointment_date?: string
  last_appointment_date?: string
  /**
   * Descontos exclusivos associados a este cliente.
   * Populado nas respostas da API quando solicitado (ex: perfil, checkout).
   */
  discounts?: Discount[]
  /** Indica se o cliente está bloqueado para criar novas reservas. */
  blocked?: boolean
  /** Motivo de bloqueio (texto guardado pelo admin). */
  blocked_reason?: string | null
}

// ─── Histórico de edições de uma reserva ─────────────────────────────────────────────────
export interface ReservationHistoricoItem {
  /** ISO 8601 da edição */
  timestamp: string
  /** Nome do utilizador que fez a alteração (admin, barbeiro ou 'Sistema') */
  editado_por?: string
  /** Campos alterados: chave = nome do campo, valor = { de, para } */
  alteracoes: Record<string, { de: unknown; para: unknown }>
}

// ─── Reserva ─────────────────────────────────────────────────────────────────────────────
export type ReservationStatus = 'confirmada' | 'concluida' | 'cancelada' | 'faltou'
export type MeioPagamento = 'multibanco' | 'dinheiro' | 'outro'

export interface Reservation {
  id: number
  client_id: number
  client_name: string
  client_phone?: string
  client_email?: string
  client_photo_url?: string
  client_free_reservations?: number
  barber_id: number | undefined
  barber_name: string
  barber_color?: string
  service_id: number | undefined
  service_name: string
  service_duration: number
  service_price: number
  data_hora: string
  status: ReservationStatus
  comentario?: string
  nota_privada?: string
  created_by?: 'online' | 'admin' | 'barbeiro'
  criado_em?: string
  /** Enviado apenas na criação: true = enviar email de confirmação ao cliente */
  send_email?: boolean
  meio_pagamento?: MeioPagamento
  valor_pago?: number
  gorjeta?: number
  meio_gorjeta?: MeioPagamento
  comentario_pagamento?: string
  /** Campos de oferta (desconto/gratuidade gerido pela barbearia) */
  oferta_valor?: number
  oferta_tipo?: string
  /**
   * ID do desconto (linha da tabela descontos) aplicado nesta reserva.
   * Preenchido pelo barbeiro no checkout.
   */
  desconto_id?: number | null
  /**
   * Campos do desconto desnormalizados (populados pela view v_reservas_complete).
   * Só estão presentes em respostas de leitura, nunca no payload de escrita.
   */
  desconto_nome?: string | null
  desconto_tipo?: string | null
  desconto_percentagem?: number | null
  desconto_fixo_centimos?: number | null
  /**
   * Histórico de edições guardado no campo historico_edicoes da tabela reservas.
   * Array de entradas com timestamp, quem editou e os campos alterados.
   * Pode vir como string JSON (parse feito no componente) ou já como array.
   */
  historico_edicoes?: ReservationHistoricoItem[] | string | null
}

// ─── Cópia recorrente de reservas ─────────────────────────────────────────
export type RecurrenceInterval = 'none' | 'weekly' | 'biweekly' | 'every3weeks' | 'every4weeks'

export interface CopyOccurrence {
  date: string            // 'yyyy-MM-dd'
  time: string            // 'HH:mm'
  conflict: 'reservation' | 'unavailable' | null
}

// ─── Indisponibilidade ───────────────────────────────────────────────────────────────────
export type UnavailableTipo = 'folga' | 'almoco' | 'ferias' | 'ausencia' | 'outro'
export type RecurrenceType  = 'none' | 'daily' | 'weekly'

export interface Unavailable {
  id: number
  barbeiro_id: number
  barbeiro_nome?: string
  data_hora_inicio: string
  data_hora_fim: string
  tipo: UnavailableTipo
  motivo?: string
  is_all_day: number
  recurrence_type: RecurrenceType
  recurrence_end_date?: string
  recurrence_group_id?: string
  created_at: string
}

// ─── Conflito de reserva ──────────────────────────────────────────────────────────────
export interface ConflictReservation {
  id: number
  client_name: string
  data_hora: string
  service_name: string
  duracao_minutos: number
}

// ─── Dashboard stats ───────────────────────────────────────────────────────────────────
export interface DashboardStats {
  today: number
  week: number
  month: number
  total_clients: number
  unread_notifications: number
}

export interface TodayBarberStats {
  barbeiro_id:    number
  barbeiro_nome:  string
  barbeiro_color: string
  confirmadas:    number
  concluidas:     number
  canceladas:     number
  faltas:         number
}

export interface StatsComparison {
  periodo:     'A' | 'B'
  data:        string
  confirmadas: number
  concluidas:  number
  canceladas:  number
  faltas:      number
}

// ─── API ────────────────────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}
