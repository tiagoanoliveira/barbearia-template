import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { clientsApi } from '@/api/clients'
import type { Barber, Reservation, Service } from '@/types'

function slotToISO(dateStr: string, slot: number, startH: number) {
  const t = startH * 60 + slot * 15
  return `${dateStr}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '00')}:00`
}

function ClientSearch({ onChange }: { onChange: (id: number, name: string) => void }) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)

  const onType = (v: string) => {
    setQ(v)
    setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDq(v), 350)
  }

  const { data } = useQuery({
    queryKey: ['client-search', dq],
    queryFn: () => clientsApi.list({ search: dq, page: 1, perPage: 8 }),
    enabled: dq.length >= 1,
  })

  const results = data?.data?.items ?? []

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
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {results.map(c => (
            <li
              key={c.id}
              className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex justify-between"
              onMouseDown={() => {
                onChange(c.id, c.name)
                setQ(c.name)
                setOpen(false)
              }}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-gray-400">{c.phone ?? c.email ?? ''}</span>
            </li>
          ))}
        </ul>
      )}
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
  form: Partial<Reservation & { sendEmail: boolean }>
  saving: boolean
  onChange: (k: string, v: unknown) => void
  onSave: () => void
  onCancel: () => void
}) {
  const iso = slotToISO(selectedDate, slot, startH)
  const [newClientMode, setNewClientMode] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return
    setCreatingClient(true)
    try {
      const res = await clientsApi.create({
        name: newClientName.trim(),
        email: newClientEmail.trim() || undefined,
        phone: newClientPhone.trim() || undefined,
      })
      if (res.success && res.data) {
        onChange('client_id', res.data.id)
        onChange('client_name', res.data.name)
        setNewClientMode(false)
      }
    } finally {
      setCreatingClient(false)
    }
  }

  return (
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
            <input type="text" placeholder="Nome do cliente" className="input text-sm w-full" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
            <input type="email" placeholder="Email (opcional)" className="input text-sm w-full" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
            <input type="tel" placeholder="Telefone (opcional)" className="input text-sm w-full" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} />
            <button type="button" onClick={handleCreateClient} disabled={creatingClient || !newClientName.trim()} className="btn-primary w-full text-xs mt-1 disabled:opacity-50">
              {creatingClient ? 'A criar cliente...' : 'Criar e associar cliente'}
            </button>
          </div>
        ) : (
          <ClientSearch onChange={(id, name) => { onChange('client_id', id); onChange('client_name', name) }} />
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
        <select value={form.barber_id ?? barberId} onChange={e => onChange('barber_id', Number(e.target.value))} className="input text-sm w-full">
          {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Serviço <span className="text-red-400">*</span></label>
        <select value={form.service_id ?? ''} onChange={e => onChange('service_id', Number(e.target.value))} className="input text-sm w-full">
          <option value="">Selecionar serviço</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Data e hora</label>
        <input type="datetime-local" value={(form.data_hora ?? iso).substring(0, 16)} onChange={e => onChange('data_hora', `${e.target.value}:00`)} className="input text-sm w-full" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nota (opcional)</label>
        <textarea rows={2} value={form.comentario ?? ''} onChange={e => onChange('comentario', e.target.value)} placeholder="Observações para o barbeiro..." className="input text-sm w-full resize-none" />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={!!form.sendEmail} onChange={e => onChange('sendEmail', e.target.checked)} />
        <span>Enviar email de confirmação ao cliente</span>
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary text-xs">Cancelar</button>
        <button onClick={onSave} disabled={saving || !form.client_id || !form.service_id} className="btn-primary text-xs disabled:opacity-50">
          {saving ? 'A criar...' : 'Criar reserva'}
        </button>
      </div>
    </div>
  )
}
