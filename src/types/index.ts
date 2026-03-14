// ─── Barbeiro ─────────────────────────────────────────────────────────────────
export interface Barber {
  id: number
  name: string
  photo_url?: string
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
  svg?: string
  abreviacao?: string
  color?: string
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
  next_appointment_date?: string
  last_appointment_date?: string
}

// ─── Reserva ─────────────────────────────────────────────────────────────────
export type ReservationStatus = 'confirmada' | 'concluida' | 'cancelada' | 'faltou'

export interface Reservation {
  id: number
  client_id: number
  client_name: string
  client_phone?: string
  client_email?: string
  barber_id: number
  barber_name: string
  barber_color?: string
  service_id: number
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

// ─── Dashboard stats ─────────────────────────────────────────────────────────
export interface DashboardStats {
  today: number
  week: number
  month: number
  total_clients: number
  unread_notifications: number
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
