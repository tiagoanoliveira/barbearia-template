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
import type { Unavailable, UnavailableTipo } from '@/types'

const TYPE_LABELS: Record<UnavailableTipo, string> = {
  folga:    'Folga',
  almoco:   'Almoço',
  ferias:   'Férias',
  ausencia: 'Ausência',
  outro:    'Outro',
}

const TYPE_COLORS: Record<UnavailableTipo, string> = {
  folga:    'bg-blue-100 text-blue-700',
  almoco:   'bg-yellow-100 text-yellow-700',
  ferias:   'bg-emerald-100 text-emerald-700',
  ausencia: 'bg-red-100 text-red-700',
  outro:    'bg-gray-100 text-gray-600',
}

interface UnavailableForm {
  barbeiro_id: number
  data_hora_inicio: string
  data_hora_fim: string
  tipo: UnavailableTipo
  motivo: string
  is_all_day: number
}

const EMPTY_FORM: UnavailableForm = {
  barbeiro_id: 0,
  data_hora_inicio: '',
  data_hora_fim: '',
  tipo: 'folga',
  motivo: '',
  is_all_day: 1,
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

  const barbers     = barbersRes?.data ?? []
  const unavailable = unavailRes?.data ?? []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Constrói ISO datetime a partir das datas/horas do form
    const inicio = form.is_all_day
      ? `${form.data_hora_inicio}T00:00:00`
      : form.data_hora_inicio
    const fim = form.is_all_day
      ? `${form.data_hora_fim || form.data_hora_inicio}T23:59:00`
      : form.data_hora_fim

    create.mutate({
      barbeiro_id: form.barbeiro_id,
      data_hora_inicio: inicio,
      data_hora_fim:    fim,
      tipo:             form.tipo,
      motivo:           form.motivo || undefined,
      is_all_day:       form.is_all_day,
      recurrence_type:  'none',
    })
  }

  const update = (field: keyof UnavailableForm, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }))

  // Extrai data legível de um ISO datetime
  const fmtDate = (iso: string) => {
    try { return format(parseISO(iso), "d 'de' MMM", { locale: pt }) }
    catch { return iso }
  }
  const fmtTime = (iso: string) => {
    try { return format(parseISO(iso), 'HH:mm') }
    catch { return '' }
  }

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
                  <p className="text-sm font-semibold text-gray-900">{u.barbeiro_nome}</p>
                  <span className={`badge text-xs mt-1 ${TYPE_COLORS[u.tipo]}`}>
                    {TYPE_LABELS[u.tipo]}
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
                {fmtDate(u.data_hora_inicio)}
                {u.data_hora_fim !== u.data_hora_inicio && (
                  <> — {fmtDate(u.data_hora_fim)}</>
                )}
              </p>
              {!u.is_all_day && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {fmtTime(u.data_hora_inicio)} — {fmtTime(u.data_hora_fim)}
                </p>
              )}
              {u.motivo && (
                <p className="text-xs text-gray-500 mt-2 italic">{u.motivo}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
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
            <select required className="input"
                    value={form.barbeiro_id || ''}
                    onChange={e => update('barbeiro_id', Number(e.target.value))}>
              <option value="">Selecionar barbeiro</option>
              {barbers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Dia inteiro?</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="allday" value="1" checked={form.is_all_day === 1}
                       onChange={() => update('is_all_day', 1)} /> Sim
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="allday" value="0" checked={form.is_all_day === 0}
                       onChange={() => update('is_all_day', 0)} /> Não
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data início</label>
              <input type="date" required className="input"
                     value={form.data_hora_inicio.substring(0, 10)}
                     onChange={e => update('data_hora_inicio', e.target.value)} />
            </div>
            <div>
              <label className="label">Data fim</label>
              <input type="date" className="input"
                     value={form.data_hora_fim.substring(0, 10)}
                     min={form.data_hora_inicio.substring(0, 10)}
                     onChange={e => update('data_hora_fim', e.target.value)} />
            </div>
          </div>

          {form.is_all_day === 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Hora início</label>
                <input type="time" className="input"
                       value={form.data_hora_inicio.substring(11, 16)}
                       onChange={e => update('data_hora_inicio', `${form.data_hora_inicio.substring(0, 10)}T${e.target.value}:00`)} />
              </div>
              <div>
                <label className="label">Hora fim</label>
                <input type="time" className="input"
                       value={form.data_hora_fim.substring(11, 16)}
                       onChange={e => update('data_hora_fim', `${form.data_hora_fim.substring(0, 10)}T${e.target.value}:00`)} />
              </div>
            </div>
          )}

          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.tipo}
                    onChange={e => update('tipo', e.target.value as UnavailableTipo)}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Motivo <span className="text-gray-400">(opcional)</span></label>
            <input type="text" className="input" placeholder="Ex: Consulta médica..."
                   value={form.motivo}
                   onChange={e => update('motivo', e.target.value)} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
