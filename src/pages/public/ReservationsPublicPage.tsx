import { useState, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CheckCircle, Calendar, X } from 'lucide-react'
import { api } from '@/api/client'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ROUTES } from '@/config/routes'
import type { Reservation, Service, Barber } from '@/types'

export default function ReservationsPublicPage() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const confirmed = params.get('confirmed') === '1'

  const [editing, setEditing]             = useState<Reservation | null>(null)
  const [editDate, setEditDate]           = useState('')
  const [editTime, setEditTime]           = useState('')
  const [editNotes, setEditNotes]         = useState('')
  const [editServiceId, setEditServiceId] = useState<number | null>(null)
  const [editBarberId, setEditBarberId]   = useState<number | null>(null)
  const [editError, setEditError]         = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Ref para fechar o modal de edição ao clicar fora
  const editDialogRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['my-reservations'],
    queryFn:  () => api.get<Reservation[]>('/api/my-reservations'),
    retry:    false,
  })

  const { data: servicesRes } = useQuery({
    queryKey: ['public-services'],
    queryFn:  () => api.get<Service[]>('/api/services'),
  })

  const { data: barbersRes } = useQuery({
    queryKey: ['public-barbers'],
    queryFn:  () => api.get<Barber[]>('/api/barbers'),
  })

  const { data: editBarberServicesRes } = useQuery({
    queryKey: ['barber-services-edit', editBarberId],
    queryFn:  () => editBarberId
        ? api.get<Service[]>(`/api/barbers/${editBarberId}/services`)
        : api.get<Service[]>('/api/services'),
    enabled: !!editing,
  })
  const editServices = editBarberServicesRes?.data ?? []

  const { data: slotsRes } = useQuery({
    queryKey: ['edit-slots', editBarberId, editDate, editServiceId],
    queryFn:  () =>
      api.get<string[]>(
        `/api/slots?barber_id=${editBarberId}&date=${editDate}&service_id=${editServiceId}`
      ),
    enabled: !!editing && !!editBarberId && !!editDate && !!editServiceId,
  })

  const services = servicesRes?.data ?? []
  const barbers  = barbersRes?.data ?? []
  const slots    = slotsRes?.data ?? []

  const cancel = useMutation({
    mutationFn: (id: number) => api.delete(`/api/reservations/${id}`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['my-reservations'] })
      setEditing(null)
      setShowCancelConfirm(false)
    },
  })

  const edit = useMutation({
    mutationFn: async ({ id, date, time, notes, service_id, barber_id }: {
      id: number; date: string; time: string
      notes?: string; service_id?: number; barber_id?: number
    }) => {
      const res = await api.put(`/api/reservations/${id}`, {
        date, time, notes: notes || undefined, service_id, barber_id,
      })
      if (!res.success) throw new Error(res.error ?? 'Erro ao atualizar reserva.')
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-reservations'] })
      setEditing(null)
    },
    onError: (e: Error) => setEditError(e.message),
  })

  const reservations = data?.data ?? []
  const now = new Date()

  const upcoming = reservations.filter(r => {
    const dt = parseISO(r.data_hora)
    return dt >= now && r.status !== 'cancelada'
  })

  const past = reservations.filter(r => {
    const dt = parseISO(r.data_hora)
    return dt < now || r.status === 'cancelada'
  })

  const openEdit = (r: Reservation) => {
    const dt = parseISO(r.data_hora)
    setEditDate(format(dt, 'yyyy-MM-dd'))
    setEditTime(format(dt, 'HH:mm'))
    setEditNotes(r.comentario ?? '')
    setEditServiceId((r as any).service_id ?? null)
    setEditBarberId((r as any).barber_id ?? null)
    setEditing(r)
    setEditError(null)
    setShowCancelConfirm(false)
  }

  const closeEdit = () => {
    if (!edit.isPending && !cancel.isPending) setEditing(null)
  }

  const handleSaveEdit = () => {
    if (!editing) return
    if (!editDate || !editTime || !editServiceId || !editBarberId) {
      setEditError('Serviço, barbeiro, data e hora são obrigatórios.')
      return
    }
    edit.mutate({
      id: editing.id, date: editDate, time: editTime,
      notes: editNotes, service_id: editServiceId, barber_id: editBarberId,
    })
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editDialogRef.current && !editDialogRef.current.contains(e.target as Node)) {
      closeEdit()
    }
  }

  if (isLoading) {
    return (
      <div className="pt-24 flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="pt-24 pb-16 min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {confirmed && (
          <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/30
                          rounded-2xl px-5 py-4">
            <CheckCircle size={24} className="text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-400">Reserva confirmada!</p>
              <p className="text-sm text-emerald-300/70">Recebes um email de confirmação em breve.</p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-black">As minhas reservas</h1>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Próximas</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-8 text-center">
              <Calendar size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">Ainda não tens reservas futuras.</p>
              <Link
                to={ROUTES.BOOKING}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500
                           text-white font-semibold rounded-xl hover:bg-brand-600 transition-all"
              >
                Reservar agora
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(r => (
                <ReservationCard key={r.id} r={r} onEdit={() => openEdit(r)} />
              ))}
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Histórico</h2>
            <div className="space-y-3">
              {past.map(r => (
                <ReservationCard key={r.id} r={r} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de edição ───────────────────────────────────────────────── */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onMouseDown={handleOverlayClick}
        >
          <div
            ref={editDialogRef}
            className="bg-gray-900 rounded-2xl p-5 w-full max-w-md border border-white/10 space-y-4"
          >
            {/* Header do modal de edição */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Editar reserva</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {editing.service_name} · {editing.barber_name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                disabled={edit.isPending || cancel.isPending}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-white/10 hover:text-gray-300
                           transition-colors disabled:opacity-40"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Campos de edição */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Serviço</label>
                <select
                  value={editServiceId ?? ''}
                  onChange={e => { setEditServiceId(Number(e.target.value) || null); setEditTime('') }}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Selecionar serviço</option>
                  {editServices.map(s => (
                      <option key={s.id} value={s.id}>{s.name} — {s.price}€</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Barbeiro</label>
                <select
                  value={editBarberId ?? ''}
                  onChange={e => { setEditBarberId(Number(e.target.value) || null); setEditServiceId(null); setEditTime('') }}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Selecionar barbeiro</option>
                  {barbers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Data</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => { setEditDate(e.target.value); setEditTime('') }}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Hora</label>
                {(!editBarberId || !editServiceId || !editDate) ? (
                  <p className="text-xs text-gray-500">Seleciona primeiro serviço, barbeiro e data.</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-gray-500">Sem horários disponíveis para esta combinação.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {slots.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setEditTime(slot)}
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${
                          editTime === slot
                            ? 'bg-brand-500 text-white'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Notas (opcional)</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>

            {editError && (
              <p className="text-sm text-red-400 bg-red-950/50 border border-red-800/50 rounded-xl px-3 py-2">
                {editError}
              </p>
            )}

            {/*
              Footer de 3 zonas:
                esquerda  → Cancelar reserva (botão destrutivo discreto)
                direita   → Fechar · Guardar alterações
            */}
            <div className="flex items-center justify-between gap-2 pt-2">
              {/* Cancelar reserva — à esquerda, pouco saliente */}
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                disabled={edit.isPending || cancel.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400/60
                           hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors
                           disabled:opacity-40"
              >
                Cancelar reserva
              </button>

              {/* Fechar + Guardar — à direita */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={edit.isPending}
                  className="px-4 py-2 text-xs text-gray-300 bg-white/5 rounded-xl
                             hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={edit.isPending}
                  className="px-4 py-2 text-xs bg-brand-500 text-white rounded-xl
                             hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {edit.isPending ? 'A guardar...' : 'Guardar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmação de cancelamento (z-index acima do modal de edição) ── */}
      <ConfirmDialog
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => editing && cancel.mutate(editing.id)}
        variant="danger"
        title="Cancelar reserva"
        description="Tens a certeza que queres cancelar esta reserva? Esta ação não pode ser desfeita."
        confirmLabel="Sim, cancelar"
        cancelLabel="Não, voltar"
        loading={cancel.isPending}
      />
    </div>
  )
}

function ReservationCard({ r, onEdit }: { r: Reservation; onEdit?: () => void }) {
  const canEdit = r.status === 'confirmada'
  const dt = parseISO(r.data_hora)

  return (
    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex-shrink-0 w-12 h-12 bg-brand-500/20 rounded-2xl flex flex-col
                      items-center justify-center">
        <span className="text-brand-400 font-black text-lg leading-none">{dt.getDate()}</span>
        <span className="text-brand-400/60 text-xs uppercase">
          {format(dt, 'MMM', { locale: pt })}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold">{r.service_name}</p>
        <p className="text-sm text-gray-500">
          {r.barber_name} · {format(dt, 'HH:mm')}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StatusBadge status={r.status} />
        {canEdit && onEdit && (
          <button
            onClick={onEdit}
            className="mt-1 px-3 py-1 rounded-full text-xs font-medium bg-brand-500/20 text-brand-200
                       hover:bg-brand-500/30 transition-colors"
          >
            Editar
          </button>
        )}
      </div>
    </div>
  )
}
