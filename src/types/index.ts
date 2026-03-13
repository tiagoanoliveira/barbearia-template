// ─── Barbeiro / Perfil ───────────────────────────────────────────────────────
export interface Barber {
  id: number
  name: string
  email: string
  phone?: string
  photo_url?: string
  active: boolean
  created_at: string
}

// ─── Serviço ─────────────────────────────────────────────────────────────────
export interface Service {
  id: number
  name: string
  duration: number  // minutos
  price: number     // cêntimos
  active: boolean
}

// ─── Cliente ─────────────────────────────────────────────────────────────────
export interface Client {
  id: number
  name: string
  email?: string
  phone?: string
  photo_url?: string
  notes?: string
  created_at: string
  total_visits?: number
  last_visit?: string
}

// ─── Reserva ─────────────────────────────────────────────────────────────────
export type ReservationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface Reservation {
  id: number
  client_id: number
  client_name: string
  client_phone?: string
  barber_id: number
  barber_name: string
  service_id: number
  service_name: string
  service_duration: number
  service_price: number
  date: string        // YYYY-MM-DD
  time: string        // HH:MM
  status: ReservationStatus
  notes?: string
  created_at: string
}

// ─── Indisponibilidade ───────────────────────────────────────────────────────
export type UnavailableType = 'day_off' | 'vacation' | 'sick' | 'other'

export interface Unavailable {
  id: number
  barber_id: number
  barber_name?: string
  start_date: string   // YYYY-MM-DD
  end_date: string     // YYYY-MM-DD
  start_time?: string  // HH:MM (null = dia inteiro)
  end_time?: string    // HH:MM
  type: UnavailableType
  reason?: string
  created_at: string
}

// ─── Dashboard stats ─────────────────────────────────────────────────────────
export interface DashboardStats {
  todayReservations: number
  weekReservations: number
  monthReservations: number
  totalClients: number
  completionRate: number
  topService: string
  revenueThisMonth: number
  reservationsByDay: { date: string; count: number }[]
  reservationsByBarber: { barber: string; count: number }[]
  reservationsByStatus: { status: ReservationStatus; count: number }[]
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
