import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/client'
import { clientsApi } from '@/api/clients'
import { reservationsApi } from '@/api/reservations'
import type { Barber, Reservation, Service } from '@/types'
import { ClientSearchInput } from '@/components/admin/ClientSearchInput'

const DEFAULT_SERVICE_DURATION = 60
const PHONE_LIKE_PATTERN = /^\+?[\d\s\-()]*\d[\d\s\-()]{5,}$/
const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PLACEHOLDER_EMAIL_SUFFIX = '@withoutcontact.pt'

function isPlaceholderEmail(email?: string | null): boolean {
  if (!email) return false
  return email.trim().toLowerCase().endsWith(PLACEHOLDER_EMAIL_SUFFIX)
}

function slotToISO(dateStr: string, slot: number, startH: number) {
  const t = startH * 60 + slot * 15
  return `${dateStr}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '00')}:00`
}

function inferClientDraft(input: string) {
  const value = input.trim()
  if (!value) return { name: '', email: '', phone: '' }
  if (EMAIL_LIKE_PATTERN.test(value)) return { name: '', email: value, phone: '' }
  if (PHONE_LIKE_PATTERN.test(value)) return { name: '', email: '', phone: value }
  return { name: value, email: '', phone: '' }
}

// ─── Modal inline: email placeholder detectado ───────────────────────────────────────────────
type EmailModalState =
  | { step: 'confirm' }                  // mostrar aviso + dois botões
  | { step: 'update'; value: string }    // campo de novo email

function PlaceholderEmailModal({
  onUpdateEmail,
  onSkipEmail,
}: {
  onUpdateEmail: (newEmail: string) => void
  onSkipEmail: () => void
}) {
  const [state, setState] = useState<EmailModalState>({ step: 'confirm' })
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleSaveEmail = () => {
    if (state.step !== 'update') return
    const email = state.value.trim().toLowerCase()
    if (!EMAIL_LIKE_PATTERN.test(email)) {
      setEmailError('Formato de email inválido.')
      return
    }
    if (isPlaceholderEmail(email)) {
      setEmailError('O novo email não pode terminar em @withoutcontact.pt.')
      return
    }
    onUpdateEmail(email)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">

        {state.step === 'confirm' && (
          <>
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                  Este cliente não possui email atualizado
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Pretende atualizar o email ou prefere não enviar quaisquer
                  mensagem de confirmação e posteriores lembretes?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                className="btn-primary w-full text-sm"
                onClick={() => setState({ step: 'update', value: '' })}
              >
                ✏️ Atualizar Email
              </button>
              <button
                className="btn-secondary w-full text-sm"
                onClick={onSkipEmail}
              >
                Confirmar reserva sem enviar emails
              </button>
            </div>
          </>
        )}

        {state.step === 'update' && (
          <>
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">📧</span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                  Novo email do cliente
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Ao guardar, o email do cliente será atualizado e a reserva
                  será criada com confirmação e lembretes automáticos.
                </p>
              </div>
            </div>
            <input
              type="email"
              autoFocus
              placeholder="novo@email.com"
              className={`input text-sm w-full ${emailError ? 'border-red-400' : ''}`}
              value={state.value}
              onChange={e => { setState({ step: 'update', value: e.target.value }); setEmailError(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSaveEmail()}
            />
            {emailError && (
              <p className="text-xs text-red-500">{emailError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                className="btn-secondary flex-1 text-sm"
                onClick={() => { setState({ step: 'confirm' }); setEmailError(null) }}
              >
                Voltar
              </button>
              <button
                className="btn-primary flex-1 text-sm"
                onClick={handleSaveEmail}
                disabled={!state.value.trim()}
              >
                Guardar e avançar
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ─── Utilitário: calcular datas recorrentes ───────────────────────────────────────────────────
const RECURRENCE_LABELS: Record<string, string> = {
  none:        'Sem recorrência',
  weekly:      'Semanal (cada 7 dias)',
  biweekly:    'Quinzenal (cada 14 dias)',
  every3weeks: 'De 3 em 3 semanas',
  every4weeks: 'De 4 em 4 semanas',
}
const RECURRENCE_DAYS: Record<string, number> = {
  weekly: 7, biweekly: 14, every3weeks: 21, every4weeks: 28,
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildOccurrences(
    startDate: string,
    time: string,
    interval: string,
    count: number,
    reservations: { data_hora: string; status: string }[],
    unavailabilities: { data_hora_inicio: string; data_hora_fim: string; barbeiro_id: number }[],
    barberId: number,
): import('@/types').CopyOccurrence[] {
  if (interval === 'none' || count <= 1) {
    return [{ date: startDate, time, conflict: null }]
  }
  const step = RECURRENCE_DAYS[interval] ?? 7
  const result: import('@/types').CopyOccurrence[] = []
  let cur = startDate
  for (let i = 0; i < count; i++) {
    const isoHour = `${cur}T${time}:00`
    const hasRes = reservations.some(
        r => r.status !== 'cancelada' && r.data_hora.slice(0, 16) === isoHour.slice(0, 16)
    )
    const hasUnavail = unavailabilities.some(
        u => u.barbeiro_id === barberId && u.data_hora_inicio <= isoHour && u.data_hora_fim > isoHour
    )
    result.push({
      date: cur,
      time,
      conflict: hasRes ? 'reservation' : hasUnavail ? 'unavailable' : null,
    })
    cur = addDays(cur, step)
  }
  return result
}

export function ReservationCopyContent({
  clientName,
  serviceName,
  barberName,
  barberId,
  copyDate,
  copyTime,
  recurrenceInterval,
  recurrenceCount,
  reservations,
  unavailabilities,
  onChange,
}: {
  clientName: string
  serviceName: string
  barberName: string
  barberId: number
  copyDate: string
  copyTime: string
  recurrenceInterval: string
  recurrenceCount: number
  reservations: { data_hora: string; status: string }[]
  unavailabilities: { data_hora_inicio: string; data_hora_fim: string; barbeiro_id: number }[]
  onChange: (
      field: 'copyDate' | 'copyTime' | 'recurrenceInterval' | 'recurrenceCount',
      value: string | boolean | number
  ) => void
}) {
  const occurrences = buildOccurrences(
      copyDate, copyTime, recurrenceInterval, recurrenceCount,
      reservations, unavailabilities, barberId,
  )
  const hasConflicts = occurrences.some(o => o.conflict !== null)

  return (
      <div className="space-y-4 text-sm">
        {/* Resumo da reserva de origem */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
          <p><span className="text-gray-500">Cliente:</span> <strong>{clientName}</strong></p>
          <p><span className="text-gray-500">Serviço:</span> <strong>{serviceName}</strong></p>
          <p><span className="text-gray-500">Barbeiro:</span> <strong>{barberName}</strong></p>
        </div>

        {/* Data e hora de início */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data de início</label>
            <input
                type="date"
                value={copyDate}
                onChange={e => onChange('copyDate', e.target.value)}
                className="input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hora</label>
            <input
                type="time"
                value={copyTime}
                onChange={e => onChange('copyTime', e.target.value)}
                className="input text-sm w-full"
            />
          </div>
        </div>

        {/* Recorrência */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Recorrência</label>
            <select
                value={recurrenceInterval}
                onChange={e => onChange('recurrenceInterval', e.target.value)}
                className="input text-sm w-full"
            >
              {Object.entries(RECURRENCE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          {recurrenceInterval !== 'none' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nº de cópias</label>
                <input
                    type="number"
                    min={2}
                    max={52}
                    value={recurrenceCount}
                    onChange={e => onChange('recurrenceCount', Number(e.target.value))}
                    className="input text-sm w-full"
                />
              </div>
          )}
        </div>

        {/* Preview das ocorrências */}
        {occurrences.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5 font-medium">
                {recurrenceInterval === 'none' ? 'Reserva a criar:' : `${occurrences.length} reservas a criar:`}
              </p>
              <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {occurrences.map((o, i) => (
                    <li key={i} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-xs ${
                        o.conflict === 'reservation'  ? 'bg-red-50 text-red-700 border border-red-200' :
                            o.conflict === 'unavailable'  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                'bg-green-50 text-green-800 border border-green-200'
                    }`}>
                <span className="font-medium">
                  {new Date(o.date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} — {o.time}
                </span>
                      {o.conflict === 'reservation'  && <span>⛔ Reserva existente</span>}
                      {o.conflict === 'unavailable'  && <span>⚠️ Indisponibilidade</span>}
                      {o.conflict === null           && <span>✅ Disponível</span>}
                    </li>
                ))}
              </ul>
              {hasConflicts && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                    ⚠️ As reservas assinaladas serão criadas na mesma mas podem sobrepor-se a entradas existentes. Verifica o calendário após criar.
                  </p>
              )}
            </div>
        )}
      </div>
  )
}

export function NewReservationForm({
  barberId,
  slot,
  selectedDate,
  startH,
  barbers,
  services,
  form,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  barberId: number
  slot: number
  selectedDate: string
  startH: number
  barbers: Barber[]
  services: Service[]
  form: Partial<Reservation & { sendEmail: boolean; nota_privada: string }>
  saving: boolean
  onChange: (k: string, v: unknown) => void
  onSave: (extraFields?: { update_email?: string; send_email?: boolean }) => void
  onCancel: () => void
}) {
  const iso = slotToISO(selectedDate, slot, startH)
  const [newClientMode, setNewClientMode] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClientError, setNewClientError] = useState<string | null>(null)

  // Email do cliente seleccionado (guardado quando o cliente é escolhido)
  const [selectedClientEmail, setSelectedClientEmail] = useState<string | undefined>(undefined)

  // Estado do modal de email placeholder
  const [showEmailModal, setShowEmailModal] = useState(false)

  // Serviços disponíveis para o barbeiro seleccionado
  const selectedBarberId = (form.barber_id ?? barberId) as number
  const { data: barberSvcRes } = useQuery({
    queryKey: ['barber-services-new', selectedBarberId],
    queryFn:  () => adminApi.get<Service[]>(`/api/barbers/${selectedBarberId}/services`),
    enabled:  !!selectedBarberId,
  })
  const barberServices = (barberSvcRes?.data as unknown as Service[]) ?? services

  const canCreateNewClient = newClientName.trim().length > 0 && newClientPhone.trim().length > 0
  const selectedService = services.find(s => s.id === (form.service_id ?? 0))

  const handleCreateClient = async () => {
    if (!canCreateNewClient) {
      setNewClientError(!newClientName.trim() ? 'Nome do cliente é obrigatório.' : 'Telefone do cliente é obrigatório.')
      return
    }
    setCreatingClient(true)
    setNewClientError(null)
    try {
      const res = await clientsApi.create({
        name: newClientName.trim(),
        email: newClientEmail.trim() || undefined,
        phone: newClientPhone.trim(),
      })
      if (!res.success || !res.data) throw new Error(res.error ?? 'Não foi possível criar o cliente.')
      onChange('client_id', res.data.id)
      onChange('client_name', res.data.name)
      setSelectedClientEmail(res.data.email ?? undefined)
      setNewClientMode(false)
      setNewClientName('')
      setNewClientEmail('')
      setNewClientPhone('')
    } catch (e: unknown) {
      setNewClientError(e instanceof Error ? e.message : 'Não foi possível criar o cliente.')
    } finally {
      setCreatingClient(false)
    }
  }

  const handleSaveClick = () => {
    if (form.sendEmail && isPlaceholderEmail(selectedClientEmail)) {
      setShowEmailModal(true)
      return
    }
    onSave()
  }

  const handleUpdateEmail = (newEmail: string) => {
    setShowEmailModal(false)
    onSave({ update_email: newEmail, send_email: true })
  }

  const handleSkipEmail = () => {
    setShowEmailModal(false)
    onSave({ send_email: false })
  }

  return (
    <>
      {showEmailModal && (
        <PlaceholderEmailModal
          onUpdateEmail={handleUpdateEmail}
          onSkipEmail={handleSkipEmail}
        />
      )}

      <div className="space-y-3 text-sm">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-gray-500">Cliente <span className="text-red-400">*</span></label>
            <button type="button" onClick={() => setNewClientMode(v => !v)} className="text-[11px] text-brand-700 hover:text-brand-800">
              {newClientMode ? 'Escolher existente' : 'Criar novo'}
            </button>
          </div>
          {newClientMode ? (
            <div className="space-y-2 border rounded-xl p-3 bg-gray-50">
              <input
                type="text"
                placeholder="Nome do cliente *"
                className="input text-sm w-full"
                value={newClientName}
                onChange={e => { setNewClientName(e.target.value); setNewClientError(null) }}
                required
                aria-required="true"
              />
              <input type="email" placeholder="Email (opcional)" className="input text-sm w-full" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
              <input
                type="tel"
                placeholder="Telefone *"
                className="input text-sm w-full"
                value={newClientPhone}
                onChange={e => { setNewClientPhone(e.target.value); setNewClientError(null) }}
                required
                aria-required="true"
              />
              {newClientError && <p className="text-xs text-red-500">{newClientError}</p>}
              <button type="button" onClick={handleCreateClient} disabled={creatingClient || !canCreateNewClient} className="btn-primary w-full text-xs mt-1 disabled:opacity-50">
                {creatingClient ? 'A criar cliente...' : 'Criar e associar cliente'}
              </button>
            </div>
          ) : (
            // ─ Componente partilhado ClientSearchInput ─
            <ClientSearchInput
              selected={form.client_id && form.client_name
                ? { id: form.client_id as number, name: form.client_name as string, created_at: '' }
                : null
              }
              onSelect={c => {
                onChange('client_id', c.id)
                onChange('client_name', c.name)
                setSelectedClientEmail(c.email ?? undefined)
              }}
              onClear={() => {
                onChange('client_id', undefined)
                onChange('client_name', '')
                setSelectedClientEmail(undefined)
              }}
            />
          )}
        </div>

        {/* Aviso visual quando o email do cliente é placeholder */}
        {isPlaceholderEmail(selectedClientEmail) && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <span>Este cliente não tem email atualizado.</span>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
          <select
              value={selectedBarberId}
              onChange={e => {
                const newBarberId = Number(e.target.value)
                onChange('barber_id', newBarberId)
                onChange('service_id', undefined)
                onChange('service_duration', undefined)
              }}
              className="input text-sm w-full"
          >
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Serviço <span className="text-red-400">*</span></label>
          <select
              value={form.service_id ?? ''}
              onChange={e => {
                const serviceId = Number(e.target.value)
                const service = barberServices.find(s => s.id === serviceId)
                onChange('service_id', serviceId)
                if (service) onChange('service_duration', service.duration)
              }}
              className="input text-sm w-full"
          >
            <option value="">Selecionar serviço</option>
            {barberServices.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Duração (min)</label>
          <input
            type="number"
            min={5}
            step={5}
            className="input text-sm w-full"
            value={form.service_duration ?? selectedService?.duration ?? DEFAULT_SERVICE_DURATION}
            onChange={e => onChange('service_duration', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data e hora</label>
          <input type="datetime-local" value={(form.data_hora ?? iso).substring(0, 16)} onChange={e => onChange('data_hora', `${e.target.value}:00`)} className="input text-sm w-full" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nota privada do barbeiro (não visível ao cliente)</label>
          <textarea rows={2} value={form.nota_privada ?? ''} onChange={e => onChange('nota_privada', e.target.value)} placeholder="Apenas visível internamente..." className="input text-sm w-full resize-none" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!form.sendEmail} onChange={e => onChange('sendEmail', e.target.checked)} />
          <span>Enviar email de confirmação ao cliente</span>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="btn-secondary text-xs">Cancelar</button>
          <button
            onClick={handleSaveClick}
            disabled={saving || !form.client_id || !form.service_id}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {saving ? 'A criar...' : 'Criar reserva'}
          </button>
        </div>
      </div>
    </>
  )
}
