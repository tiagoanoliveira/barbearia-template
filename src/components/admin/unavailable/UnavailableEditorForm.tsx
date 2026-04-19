import type { Barber, Unavailable, UnavailableTipo } from '@/types'

const TIPO_OPTIONS: UnavailableTipo[] = ['folga', 'ferias', 'almoco', 'ausencia', 'outro']
const TIPO_ICON: Record<UnavailableTipo, string> = {
  folga: '✈️', ferias: '🏖️', almoco: '🍴', ausencia: '🚫', outro: '📌',
}
const TIPO_LABEL: Record<UnavailableTipo, string> = {
  folga: 'Folga', ferias: 'Férias', almoco: 'Almoço', ausencia: 'Ausência', outro: 'Outro',
}

export interface UnavailableEditorFormProps {
  form: Partial<Unavailable> & { recurrence_end_date?: string }
  barbers: Barber[]
  isNew: boolean
  showRecurrenceFields?: boolean
  error?: string | null
  saving?: boolean
  disableBarberSelection?: boolean
  onChange: (k: string, v: unknown) => void
  onSave: () => void
  onCancel: () => void
}

export function UnavailableEditorForm({
  form,
  barbers,
  isNew,
  showRecurrenceFields,
  error,
  saving,
  disableBarberSelection,
  onChange,
  onSave,
  onCancel,
}: UnavailableEditorFormProps) {
  const fmtLocal = (iso?: string) => iso ? iso.substring(0, 16) : ''
  const shouldShowRecurrence = isNew || !!showRecurrenceFields

  return (
    <div className="space-y-3">
      {isNew && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
          <select
            value={form.barbeiro_id ?? ''}
            onChange={e => onChange('barbeiro_id', Number(e.target.value))}
            className="input text-sm w-full"
            disabled={disableBarberSelection}
          >
            <option value="">Selecionar barbeiro</option>
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
        <select value={form.tipo ?? 'folga'} onChange={e => onChange('tipo', e.target.value)} className="input text-sm w-full">
          {TIPO_OPTIONS.map(t => <option key={t} value={t}>{TIPO_ICON[t]} {TIPO_LABEL[t]}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Motivo (opcional)</label>
        <input type="text" value={form.motivo ?? ''} onChange={e => onChange('motivo', e.target.value)} placeholder="Ex.: consulta médica" className="input text-sm w-full" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="iad" checked={!!form.is_all_day} onChange={e => onChange('is_all_day', e.target.checked ? 1 : 0)} />
        <label htmlFor="iad" className="text-xs text-gray-600">Dia inteiro</label>
      </div>
      {form.is_all_day ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data início</label>
            <input type="date" value={form.data_hora_inicio?.substring(0,10) ?? ''} onChange={e => onChange('data_hora_inicio', `${e.target.value}T00:00:00`)} className="input text-xs w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data fim</label>
            <input type="date" value={form.data_hora_fim?.substring(0,10) ?? ''} onChange={e => onChange('data_hora_fim', `${e.target.value}T23:59:00`)} className="input text-xs w-full" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Início</label>
            <input type="datetime-local" value={fmtLocal(form.data_hora_inicio)} onChange={e => onChange('data_hora_inicio', `${e.target.value}:00`)} className="input text-xs w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fim</label>
            <input type="datetime-local" value={fmtLocal(form.data_hora_fim)} onChange={e => onChange('data_hora_fim', `${e.target.value}:00`)} className="input text-xs w-full" />
          </div>
        </div>
      )}
      {shouldShowRecurrence && (
        <>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Recorrência</label>
            <select value={form.recurrence_type ?? 'none'} onChange={e => onChange('recurrence_type', e.target.value)} className="input text-sm w-full">
              <option value="none">Sem recorrência</option>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
          {form.recurrence_type && form.recurrence_type !== 'none' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Até à data</label>
              <input type="date" value={form.recurrence_end_date ?? ''} onChange={e => onChange('recurrence_end_date', e.target.value)} className="input text-xs w-full" />
            </div>
          )}
        </>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary text-xs">Cancelar</button>
        <button onClick={onSave} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
