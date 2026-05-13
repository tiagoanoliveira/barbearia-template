import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { clientsApi } from '@/api/clients'
import { reservationsApi } from '@/api/reservations'
import type { Barber, Reservation, Service } from '@/types'

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

function ClientSearch({
  value,
  onChange,
  onCreateNew,
}: {
  value?: string
  onChange: (id: number, name: string, email?: string) => void
  onCreateNew: (draft: { name: string; email: string; phone: string }) => void
}) {
  const [q, setQ] = useState(value ?? '')
  const [dq, setDq] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (value) setQ(value)
  }, [value])

  const onType = (v: string) => {
    setQ(v)
    setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDq(v), 350)
  }

  const { data, isFetching } = useQuery({
    queryKey: ['client-search', dq],
    queryFn: () => clientsApi.list({ search: dq, page: 1, perPage: 8 }),
    enabled: dq.length >= 1,
  })

  const results = data?.data?.items ?? []
  const noResults = dq.trim().length > 0 && !isFetching && results.length === 0

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Pesquisar cliente por nome / email / telefone"
        value={q}
        onChange={e => onType(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="input text-sm w-full"
      />
      {open && dq.trim().length > 0 && (results.length > 0 || noResults) && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {results.map(c => (
            <li
              key={c.id}
              className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex justify-between"
              onMouseDown={() => {
                onChange(c.id, c.name, c.email ?? undefined)
                setQ(c.name)
                setOpen(false)
              }}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-gray-400">{c.phone ?? c.email ?? ''}</span>
            </li>
          ))}
          {noResults && (
            <li
              className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              onMouseDown={() => {
                onCreateNew(inferClientDraft(q))
                setOpen(false)
              }}
            >
              <span className="font-medium text-brand-700">Criar novo cliente</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

// ─── Modal inline: email placeholder detectado ─────────────────────────────
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

export function ReservationCopyContent({
  clientName,
  serviceName,
  barberName,
  copyDate,
  copyTime,
  copyEmail,
  onChange,
}: {
  clientName: string
  serviceName: string
  barberName: string
  copyDate: string
  copyTime: string
  copyEmail: boolean
  onChange: (field: 'copyDate' | 'copyTime' | 'copyEmail', value: string | boolean) => void
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
        <p><span className="text-gray-500">Cliente:</span> <strong>{clientName}</strong></p>
        <p><span className="text-gray-500">Serviço:</span> <strong>{serviceName}</strong></p>
        <p><span className="text-gray-500">Barbeiro:</span> <strong>{barberName}</strong></p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nova data</label>
          <input type="date" value={copyDate} onChange={e => onChange('copyDate', e.target.value)} className="input text-sm w-full" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hora</label>
          <input type="time" value={copyTime} onChange={e => onChange('copyTime', e.target.value)} className="input text-sm w-full" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={copyEmail} onChange={e => onChange('copyEmail', e.target.checked)} />
        <span>Enviar email de confirmação ao cliente</span>
      </label>
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

  // Email do cliente seleccionado (guardado quando o cliente é escolhido na pesquisa)
  const [selectedClientEmail, setSelectedClientEmail] = useState<string | undefined>(undefined)

  // Estado do modal de email placeholder
  const [showEmailModal, setShowEmailModal] = useState(false)

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

  // Chamado pelo botão "Criar reserva"
  const handleSaveClick = () => {
    // Se send_email está activo E o cliente tem email placeholder → mostrar modal
    if (form.sendEmail && isPlaceholderEmail(selectedClientEmail)) {
      setShowEmailModal(true)
      return
    }
    onSave()
  }

  // Utilizador escolheu atualizar o email
  const handleUpdateEmail = (newEmail: string) => {
    setShowEmailModal(false)
    onSave({ update_email: newEmail, send_email: true })
  }

  // Utilizador escolheu confirmar sem emails
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
            <ClientSearch
              value={form.client_name}
              onChange={(id, name, email) => {
                onChange('client_id', id)
                onChange('client_name', name)
                setSelectedClientEmail(email)
              }}
              onCreateNew={({ name, email, phone }) => {
                setNewClientName(name)
                setNewClientEmail(email)
                setNewClientPhone(phone)
                setNewClientMode(true)
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
          <select value={form.barber_id ?? barberId} onChange={e => onChange('barber_id', Number(e.target.value))} className="input text-sm w-full">
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Serviço <span className="text-red-400">*</span></label>
          <select
            value={form.service_id ?? ''}
            onChange={e => {
              const serviceId = Number(e.target.value)
              const service = services.find(s => s.id === serviceId)
              onChange('service_id', serviceId)
              if (service?.duration) onChange('service_duration', service.duration)
            }}
            className="input text-sm w-full"
          >
            <option value="">Selecionar serviço</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
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
