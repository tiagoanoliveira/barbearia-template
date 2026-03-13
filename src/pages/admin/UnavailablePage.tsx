import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, CalendarOff } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { barbersApi } from '@/api/barbers'
import { Card } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Unavailable, UnavailableType } from '@/types'

const TYPE_LABELS: Record<UnavailableType, string> = {
  day_off:  'Folga',
  vacation: 'Férias',
  sick:     'Doença',
  other:    'Outro',
}

const TYPE_COLORS: Record<UnavailableType, string> = {
  day_off:  'bg-blue-100 text-blue-700',
  vacation: 'bg-emerald-100 text-emerald-700',
  sick:     'bg-red-100 text-red-700',
  other:    'bg-gray-100 text-gray-600',
}

interface UnavailableForm {
  barber_id: number
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  type: UnavailableType
  reason: string
}

const EMPTY_FORM: UnavailableForm = {
  barber_id: 0,
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  type: 'day_off',
  reason: '',
}

export default function UnavailablePage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<UnavailableForm>(EMPTY_FORM)

  const { data: barbersRes } = useQuery({
    queryKey: ['barbers'],
    queryFn: () => barbersApi.list(),
  })

  const { data: unavailRes, isLoading } = useQuery({
    queryKey: ['unavailable'],
    queryFn: () => barbersApi.listUnavailable(),
  })

  const create = useMutation({
    mutationFn: (data: Partial<Unavailable>) => barbersApi.createUnavailable(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unavailable'] })
      setModal(false)
      setForm(EMPTY_FORM)
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => barbersApi.deleteUnavailable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unavailable'] }),
  })

  const barbers = barbersRes?.data ?? []
  const unavailable = unavailRes?.data ?? []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    create.mutate({
      barber_id: form.barber_id,
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      start_time: form.start_time || undefined,
      end_time: form.end_time || undefined,
      type: form.type,
      reason: form.reason || undefined,
    })
  }

  const update = (field: keyof UnavailableForm, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }))

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal(true)}>
          <Plus size={16} /> Nova indisponibilidade
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : unavailable.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarOff}
            title="Sem indisponibilidades registadas"
            description="Regista folgas, férias ou ausências dos barbeiros."
            action={
              <button className="btn-primary" onClick={() => setModal(true)}>
                <Plus size={16} /> Adicionar
              </button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {unavailable.map((u) => (
            <Card key={u.id} padding="md">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{u.barber_name}</p>
                  <span className={`badge text-xs mt-1 ${TYPE_COLORS[u.type]}`}>
                    {TYPE_LABELS[u.type]}
                  </span>
                </div>
                <button
                  onClick={() => remove.mutate(u.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <p className="text-xs text-gray-600">
                {format(parseISO(u.start_date), "d 'de' MMM", { locale: pt })}
                {u.end_date !== u.start_date && (
                  <> — {format(parseISO(u.end_date), "d 'de' MMM", { locale: pt })}</>
                )}
              </p>
              {(u.start_time || u.end_time) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {u.start_time} — {u.end_time}
                </p>
              )}
              {u.reason && (
                <p className="text-xs text-gray-500 mt-2 italic">{u.reason}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal — nova indisponibilidade */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setForm(EMPTY_FORM) }}
        title="Nova indisponibilidade"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" form="unavail-form" type="submit"
                    disabled={create.isPending}>
              {create.isPending ? 'A guardar...' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="unavail-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Barbeiro</label>
            <select
              required
              className="input"
              value={form.barber_id || ''}
              onChange={e => update('barber_id', Number(e.target.value))}
            >
              <option value="">Selecionar barbeiro</option>
              {barbers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data início</label>
              <input type="date" required className="input"
                     value={form.start_date}
                     onChange={e => update('start_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Data fim</label>
              <input type="date" className="input"
                     value={form.end_date}
                     min={form.start_date}
                     onChange={e => update('end_date', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hora início <span className="text-gray-400">(opcional)</span></label>
              <input type="time" className="input"
                     value={form.start_time}
                     onChange={e => update('start_time', e.target.value)} />
            </div>
            <div>
              <label className="label">Hora fim</label>
              <input type="time" className="input"
                     value={form.end_time}
                     onChange={e => update('end_time', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.type}
                    onChange={e => update('type', e.target.value as UnavailableType)}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Motivo <span className="text-gray-400">(opcional)</span></label>
            <input type="text" className="input" placeholder="Ex: Consulta médica..."
                   value={form.reason}
                   onChange={e => update('reason', e.target.value)} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
