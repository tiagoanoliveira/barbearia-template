// ─── Barbeiro ─────────────────────────────────────────────────────────────────
export interface Barber {
  id: number
  name: string         // nome
  photo_url?: string   // foto
  especialidades?: string
  color?: string
  active: boolean      // ativo
}

// ─── Serviço ─────────────────────────────────────────────────────────────────
export interface Service {
  id: number
  name: string         // nome
  duration: number     // duracao (minutos)
  price: number        // preco (cêntimos)
  svg?: string
  abreviacao?: string
  color?: string
}

// ─── Cliente ─────────────────────────────────────────────────────────────────
export interface Client {
  id: number
  name: string         // nome
  email?: string
  phone?: string       // telefone
  photo_url?: string   // foto_perfil
  notes?: string       // notas
  nif?: number
  created_at: string   // criado_em
  reservas_concluidas?: number
  next_appointment_date?: string
  last_appointment_date?: string
}

// ─── Reserva ─────────────────────────────────────────────────────────────────
// status em PT para corresponder ao schema original
export type ReservationStatus = 'pendente' | 'confirmada' | 'concluida' | 'cancelada' | 'faltou'

export interface Reservation {
  id: number
  client_id: number
  client_name: string       // cliente_nome (via v_reservas_complete)
  client_phone?: string     // cliente_telefone
  client_email?: string     // cliente_email
  barber_id: number
  barber_name: string       // barbeiro_nome
  barber_color?: string     // barbeiro_color
  service_id: number
  service_name: string      // servico_nome
  service_duration: number  // servico_duracao / duracao_efetiva
  service_price: number     // servico_preco
  data_hora: string         // ISO datetime — campo directo do schema
  status: ReservationStatus
  comentario?: string       // notes públicas
  nota_privada?: string     // notas admin
  created_by?: 'online' | 'admin' | 'barbeiro'
  criado_em?: string
}

// ─── Indisponibilidade ───────────────────────────────────────────────────────
export type UnavailableTipo = 'folga' | 'almoco' | 'ferias' | 'ausencia' | 'outro'

export interface Unavailable {
  id: number
  barbeiro_id: number
  barbeiro_nome?: string
  data_hora_inicio: string
  data_hora_fim: string
  tipo: UnavailableTipo
  motivo?: string
  is_all_day: number
  recurrence_type: 'none' | 'daily' | 'weekly'
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
