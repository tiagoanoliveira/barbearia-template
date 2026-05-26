// ─── Barbeiro ─────────────────────────────────────────────────────────────────
export interface Barber {
  id: number
  name: string
  foto?: string
  especialidades?: string
  color?: string
  active: boolean
}

// ─── Serviço ─────────────────────────────────────────────────────────────────
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

// ─── Cliente ─────────────────────────────────────────────────────────────────
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
  /** Cortes gratuitos acumulados ainda por usar (gerido por triggers SQL) */
  reservas_gratuitas_disponiveis?: number
  next_appointment_date?: string
  last_appointment_date?: string
}

// ─── Reserva ─────────────────────────────────────────────────────────────────
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
}

// ─── Indisponibilidade ───────────────────────────────────────────────────────
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

// ─── Conflito de reserva ─────────────────────────────────────────────────────
export interface ConflictReservation {
  id: number
  client_name: string
  data_hora: string
  service_name: string
  duracao_minutos: number
}

// ─── Dashboard stats ─────────────────────────────────────────────────────────
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

// ─── API ─────────────────────────────────────────────────────────────────────
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
