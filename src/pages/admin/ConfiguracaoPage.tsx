import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Scissors, Sparkles, Users, Plus, Pencil, Trash2, Eye, EyeOff, Check, X, Upload, Link as LinkIcon, ShoppingBag } from 'lucide-react'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Barber, Service } from '@/types'

interface AdminUser {
  id: number; username: string; nome: string; role: 'admin' | 'barbeiro' | 'superAdmin'
  ativo: number; barbeiro_id: number | null; barbeiro_nome: string | null
  criado_em: string; ultimo_login: string | null
}

interface Brand {
  id: number; name: string; logo_url: string | null; website_url: string | null; ordem: number
}

export default function ConfiguracaoPage() {
  return (
      <div className="space-y-8">
        <ServicosSection />
        <BarbeirosSection />
        <MarcasSection />
        <AdminUsersSection />
      </div>
  )
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
        <Icon size={20} className="text-brand-600" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function ConfirmDelete({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-red-600 font-medium">Confirmar?</span>
      <button onClick={onConfirm} className="p-1 rounded hover:bg-red-50 text-red-600"><Check size={14} /></button>
      <button onClick={onCancel}  className="p-1 rounded hover:bg-gray-100 text-gray-500"><X size={14} /></button>
    </span>
  )
}

// ─── Upload de foto via proxy R2 ───────────────────────────────────────────────────
async function uploadToR2(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const formData = new FormData()
  formData.append('file', file)
  formData.append('key', key)

  const token = localStorage.getItem('admin_token') ?? ''
  const res = await fetch('/api/admin/upload-proxy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Erro no upload')
  }
  const json = await res.json() as { data?: { publicUrl?: string }; publicUrl?: string }
  const publicUrl = json?.data?.publicUrl ?? json?.publicUrl
  if (!publicUrl) throw new Error('publicUrl não devolvida pelo servidor')
  return publicUrl
}

function PhotoUploader({ value, onChange, folder }: { value: string; onChange: (url: string) => void; folder: string }) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [mode, setMode]             = useState<'url' | 'upload'>('url')
  const [uploading, setUploading]   = useState(false)
  const [uploadErr, setUploadErr]   = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadErr('Apenas imagens são permitidas'); return }
    if (file.size > 5 * 1024 * 1024) { setUploadErr('Máximo 5 MB'); return }
    setUploading(true); setUploadErr(null)
    try { onChange(await uploadToR2(file, folder)) }
    catch (e: unknown) { setUploadErr(e instanceof Error ? e.message : 'Erro ao fazer upload') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('url')}
          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${ mode === 'url' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300' }`}>
          <LinkIcon size={12} className="inline mr-1" />URL
        </button>
        <button type="button" onClick={() => setMode('upload')}
          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${ mode === 'upload' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300' }`}>
          <Upload size={12} className="inline mr-1" />Upload
        </button>
      </div>
      {mode === 'url' ? (
        <input type="url" className="input text-sm w-full" placeholder="https://..." value={value}
          onChange={e => onChange(e.target.value)} />
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button type="button" onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500
                       hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-60">
            {uploading ? 'A fazer upload...' : '📁 Clica para escolher imagem (máx. 5 MB)'}
          </button>
          {uploadErr && <p className="text-xs text-red-500 mt-1">{uploadErr}</p>}
        </div>
      )}
      {value && (
        <div className="flex items-center gap-2">
          <img src={value} alt="preview" className="h-10 w-auto max-w-[120px] rounded-lg object-contain border border-gray-200 bg-gray-50 p-1" />
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-400 hover:text-red-600">Remover foto</button>
        </div>
      )}
    </div>
  )
}

// ─── SERVIÇOS ─────────────────────────────────────────────────────────────────
interface BarberOverride {
  barbeiro_id: number
  barber_name: string
  preco:       number | null
  duracao:     number | null
  ativo:       boolean
}

interface ServiceForm {
  id?:                number
  name:               string
  duration:           string
  price:              string
  abreviacao:         string
  color:              string
  conta_fidelizacao:  boolean
  barber_overrides:   BarberOverride[]
}

const emptyService = (): ServiceForm => ({
  name: '', duration: '30', price: '0', abreviacao: '', color: '#0f7e44',
  conta_fidelizacao: true, barber_overrides: [],
})

function ServicosSection() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-services'],
    queryFn:  () => adminApi.get<Service[]>('/api/admin/services'),
  })
  const services: (Service & { barber_overrides?: BarberOverride[]; conta_fidelizacao?: boolean })[] =
      (data?.data as unknown as (Service & { barber_overrides?: BarberOverride[]; conta_fidelizacao?: boolean })[]) ?? []

  // Buscar barbeiros para o formulário de overrides
  const { data: barbersData } = useQuery({
    queryKey: ['admin-barbers-cfg'],
    queryFn:  () => adminApi.get<Barber[]>('/api/admin/barbers?include_inactive=1'),
  })
  const barbers: Barber[] = (barbersData?.data as unknown as Barber[]) ?? []

  const [form, setForm]         = useState<ServiceForm | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)
  const [showOverrides, setShowOverrides] = useState(false)

  const openNew = () => {
    const overrides: BarberOverride[] = barbers
        .filter(b => (b as unknown as { active?: number }).active !== 0)
        .map(b => ({ barbeiro_id: b.id, barber_name: b.name, preco: null, duracao: null, ativo: true }))
    setForm({ ...emptyService(), barber_overrides: overrides })
    setShowOverrides(false)
    setErr(null)
  }

  const openEdit = (s: Service & { barber_overrides?: BarberOverride[]; conta_fidelizacao?: boolean }) => {
    const existingMap: Record<number, BarberOverride> = {}
    for (const ov of s.barber_overrides ?? []) existingMap[ov.barbeiro_id] = ov

    const overrides: BarberOverride[] = barbers
        .filter(b => (b as unknown as { active?: number }).active !== 0)
        .map(b => existingMap[b.id] ?? {
          barbeiro_id: b.id, barber_name: b.name, preco: null, duracao: null, ativo: true,
        })

    setForm({
      id:               s.id,
      name:             s.name,
      duration:         String(s.duration),
      price:            String(s.price),
      abreviacao:       (s as unknown as { abreviacao?: string }).abreviacao ?? '',
      color:            (s as unknown as { color?: string }).color ?? '#0f7e44',
      conta_fidelizacao: s.conta_fidelizacao !== false,
      barber_overrides: overrides,
    })
    setShowOverrides(false)
    setErr(null)
  }

  const updateOverride = (barberId: number, field: keyof Omit<BarberOverride, 'barbeiro_id' | 'barber_name'>, value: unknown) => {
    setForm(f => f ? {
      ...f,
      barber_overrides: f.barber_overrides.map(ov =>
          ov.barbeiro_id === barberId ? { ...ov, [field]: value } : ov
      ),
    } : f)
  }

  const save = async () => {
    if (!form) return
    if (!form.name || !form.duration || form.price === '') { setErr('Nome, duração e preço são obrigatórios'); return }
    setSaving(true); setErr(null)
    try {
      const body = {
        name:     form.name,
        duration: parseInt(form.duration),
        price:    parseInt(form.price),
        abreviacao: form.abreviacao,
        color:    form.color,
        conta_fidelizacao: form.conta_fidelizacao,
        barber_overrides: form.barber_overrides
            .filter(ov => !ov.ativo || ov.preco !== null || ov.duracao !== null)
            .map(ov => ({
              barbeiro_id: ov.barbeiro_id,
              preco:       ov.preco   !== null ? parseInt(String(ov.preco))   : null,
              duracao:     ov.duracao !== null ? parseInt(String(ov.duracao)) : null,
              ativo:       ov.ativo,
            })),
      }
      if (form.id) await adminApi.put(`/api/admin/services/${form.id}`, body)
      else         await adminApi.post('/api/admin/services', body)
      qc.invalidateQueries({ queryKey: ['admin-services'] })
      qc.invalidateQueries({ queryKey: ['services'] })
      setForm(null)
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro ao guardar') }
    finally { setSaving(false) }
  }

  const del = async (id: number) => {
    try {
      await adminApi.delete(`/api/admin/services/${id}`)
      qc.invalidateQueries({ queryKey: ['admin-services'] })
      qc.invalidateQueries({ queryKey: ['services'] })
    } catch {}
    setDeleteId(null)
  }

  return (
      <Card>
        <SectionHeader icon={Sparkles} title="Serviços" subtitle="Define preços e durações base ou por barbeiro" />
        {isLoading ? <LoadingSpinner size="sm" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">Nome</th>
                  <th className="text-left py-2 pr-3 font-medium">Dur.</th>
                  <th className="text-left py-2 pr-3 font-medium">Preço base</th>
                  <th className="text-left py-2 pr-3 font-medium">Abrev.</th>
                  <th className="text-left py-2 pr-3 font-medium">Cor</th>
                  <th className="text-left py-2 pr-3 font-medium">Fidelização</th>
                  <th className="text-left py-2 font-medium">Por barbeiro</th>
                  <th />
                </tr>
                </thead>
                <tbody>
                {services.map(s => {
                  const hasOverrides = (s.barber_overrides ?? []).some(
                      ov => !ov.ativo || ov.preco !== null || ov.duracao !== null
                  )
                  return (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2.5 pr-3 font-medium">{s.name}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{s.duration} min</td>
                        <td className="py-2.5 pr-3 text-gray-600">{s.price}€</td>
                        <td className="py-2.5 pr-3 text-gray-500">{(s as unknown as { abreviacao?: string }).abreviacao ?? '—'}</td>
                        <td className="py-2.5 pr-3">
                          <span className="inline-block w-5 h-5 rounded border border-gray-200"
                                style={{ background: (s as unknown as { color?: string }).color ?? '#0f7e44' }} />
                        </td>
                        <td className="py-2.5 pr-3">
                          {s.conta_fidelizacao !== false
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Conta</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Não conta</span>
                          }
                        </td>
                        <td className="py-2.5 pr-3">
                          {hasOverrides
                              ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Personalizado</span>
                              : <span className="text-xs text-gray-400">Padrão</span>
                          }
                        </td>
                        <td className="py-2.5 pl-3 whitespace-nowrap">
                          {deleteId === s.id
                              ? <ConfirmDelete onConfirm={() => del(s.id)} onCancel={() => setDeleteId(null)} />
                              : <span className="flex items-center gap-1">
                            <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><Pencil size={14} /></button>
                            <button onClick={() => setDeleteId(s.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                          </span>
                          }
                        </td>
                      </tr>
                  )
                })}
                </tbody>
              </table>
              <button onClick={openNew} className="mt-4 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
                <Plus size={16} /> Novo serviço
              </button>
            </div>
        )}

        {form && (
            <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">{form.id ? 'Editar serviço' : 'Novo serviço'}</p>

              {/* Campos base */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">Nome *</label>
                  <input className="input text-sm w-full" value={form.name}
                         onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duração base (min) *</label>
                  <input type="number" min={5} step={5} className="input text-sm w-full" value={form.duration}
                         onChange={e => setForm(f => f && ({ ...f, duration: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Preço base (€) *</label>
                  <input type="number" min={0} step={1} className="input text-sm w-full" value={form.price}
                         onChange={e => setForm(f => f && ({ ...f, price: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Abreviação</label>
                  <input maxLength={6} className="input text-sm w-full" value={form.abreviacao}
                         onChange={e => setForm(f => f && ({ ...f, abreviacao: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cor</label>
                  <input type="color" className="h-9 w-full rounded border border-gray-200 cursor-pointer"
                         value={form.color} onChange={e => setForm(f => f && ({ ...f, color: e.target.value }))} />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <span className="relative inline-flex items-center">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={form.conta_fidelizacao}
                        onChange={e => setForm(f => f && ({ ...f, conta_fidelizacao: e.target.checked }))}
                      />
                      <div className="w-9 h-5 rounded-full border border-gray-300 bg-gray-200 peer-checked:bg-brand-500 peer-checked:border-brand-500 transition-colors" />
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                    </span>
                    <span className="text-sm text-gray-700">
                      Conta para fidelização
                      <span className="block text-xs text-gray-400 font-normal">
                        Se desligado, este serviço não incrementa o contador do cartão de fidelidade
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Overrides por barbeiro */}
              {form.barber_overrides.length > 0 && (
                  <div>
                    <button type="button" onClick={() => setShowOverrides(v => !v)}
                            className="flex items-center gap-2 text-xs text-brand-600 hover:text-brand-700 font-medium mb-2">
                      <Scissors size={13} />
                      {showOverrides ? 'Ocultar' : 'Personalizar'} por barbeiro
                    </button>

                    {showOverrides && (
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                            <tr className="bg-gray-50 text-gray-500">
                              <th className="text-left px-3 py-2 font-medium">Barbeiro</th>
                              <th className="text-left px-2 py-2 font-medium">Disponível</th>
                              <th className="text-left px-2 py-2 font-medium">Preço (€)</th>
                              <th className="text-left px-2 py-2 font-medium">Duração (min)</th>
                            </tr>
                            </thead>
                            <tbody>
                            {form.barber_overrides.map(ov => (
                                <tr key={ov.barbeiro_id} className="border-t border-gray-50">
                                  <td className="px-3 py-2 font-medium text-gray-700">{ov.barber_name}</td>
                                  <td className="px-2 py-2">
                                    <input type="checkbox" checked={ov.ativo}
                                           onChange={e => updateOverride(ov.barbeiro_id, 'ativo', e.target.checked)}
                                           className="rounded" />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input type="number" min={0} step={1} disabled={!ov.ativo}
                                           placeholder={`${form.price} (base)`}
                                           value={ov.preco ?? ''}
                                           onChange={e => updateOverride(ov.barbeiro_id, 'preco', e.target.value === '' ? null : Number(e.target.value))}
                                           className="input text-xs w-24 disabled:opacity-40" />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input type="number" min={5} step={5} disabled={!ov.ativo}
                                           placeholder={`${form.duration} (base)`}
                                           value={ov.duracao ?? ''}
                                           onChange={e => updateOverride(ov.barbeiro_id, 'duracao', e.target.value === '' ? null : Number(e.target.value))}
                                           className="input text-xs w-24 disabled:opacity-40" />
                                  </td>
                                </tr>
                            ))}
                            </tbody>
                          </table>
                          <p className="text-[11px] text-gray-400 px-3 py-2 bg-gray-50 border-t border-gray-100">
                            Deixa em branco para usar o valor base. Desmarca "Disponível" para que o barbeiro não faça este serviço.
                          </p>
                        </div>
                    )}
                  </div>
              )}

              {err && <p className="text-xs text-red-500">{err}</p>}
              <div className="flex gap-2">
                <button onClick={() => setForm(null)} className="btn-secondary text-xs">Cancelar</button>
                <button onClick={save} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
                  {saving ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </div>
        )}
      </Card>
  )
}

// ─── BARBEIROS ─────────────────────────────────────────────────────────────
interface BarberForm { id?: number; name: string; especialidades: string; color: string; foto: string; active: number }
const emptyBarber = (): BarberForm => ({ name: '', especialidades: '', color: '#d4a017', foto: '', active: 1 })

function BarbeirosSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin-barbers-cfg'], queryFn: () => adminApi.get<Barber[]>('/api/admin/barbers?include_inactive=1') })
  const barbers: Barber[] = (data?.data as unknown as Barber[]) ?? []

  const [form, setForm]         = useState<BarberForm | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  const openNew  = () => { setForm(emptyBarber()); setErr(null) }
  const openEdit = (b: Barber) => {
    setForm({ id: b.id, name: b.name, especialidades: (b as unknown as { especialidades?: string }).especialidades ?? '', color: b.color ?? '#d4a017', foto: b.foto ?? '', active: (b as unknown as { active?: number }).active ?? 1 })
    setErr(null)
  }
  const save = async () => {
    if (!form) return
    if (!form.name) { setErr('Nome é obrigatório'); return }
    setSaving(true); setErr(null)
    try {
      const body = { name: form.name, especialidades: form.especialidades, color: form.color, foto: form.foto || null, active: form.active }
      if (form.id) await adminApi.put(`/api/admin/barbers/${form.id}`, body)
      else         await adminApi.post('/api/admin/barbers', body)
      qc.invalidateQueries({ queryKey: ['admin-barbers-cfg'] })
      qc.invalidateQueries({ queryKey: ['barbers'] })
      setForm(null)
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro ao guardar') }
    finally { setSaving(false) }
  }
  const del = async (id: number) => {
    try {
      await adminApi.delete(`/api/admin/barbers/${id}`)
      qc.invalidateQueries({ queryKey: ['admin-barbers-cfg'] })
      qc.invalidateQueries({ queryKey: ['barbers'] })
    } catch {}
    setDeleteId(null)
  }

  return (
    <Card>
      <SectionHeader icon={Scissors} title="Barbeiros" subtitle="Podes fazer upload de foto ou colar um URL" />
      {isLoading ? <LoadingSpinner size="sm" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="text-left py-2 pr-3 font-medium">Nome</th>
                <th className="text-left py-2 pr-3 font-medium">Especialidades</th>
                <th className="text-left py-2 pr-3 font-medium">Cor</th>
                <th className="text-left py-2 font-medium">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {barbers.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2.5 pr-3 font-medium">
                    <div className="flex items-center gap-2">
                      {b.foto
                        ? <img src={b.foto} alt={b.name} className="w-7 h-7 rounded-full object-cover" />
                        : <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: b.color ?? '#888' }}>{b.name[0]}</div>
                      }
                      {b.name}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-600 max-w-[160px] truncate">{(b as unknown as { especialidades?: string }).especialidades || '—'}</td>
                  <td className="py-2.5 pr-3"><span className="inline-block w-5 h-5 rounded border border-gray-200" style={{ background: b.color ?? '#888' }} /></td>
                  <td className="py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ (b as unknown as { active?: number }).active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500' }`}>
                      {(b as unknown as { active?: number }).active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-2.5 pl-3 whitespace-nowrap">
                    {deleteId === b.id
                      ? <ConfirmDelete onConfirm={() => del(b.id)} onCancel={() => setDeleteId(null)} />
                      : <span className="flex items-center gap-1">
                          <button onClick={() => openEdit(b)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteId(b.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                        </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={openNew} className="mt-4 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
            <Plus size={16} /> Novo barbeiro
          </button>
        </div>
      )}
      {form && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">{form.id ? 'Editar barbeiro' : 'Novo barbeiro'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Nome *</label>
              <input className="input text-sm w-full" value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Especialidades</label>
              <input className="input text-sm w-full" placeholder="Ex.: Corte, Barba, Degraê" value={form.especialidades} onChange={e => setForm(f => f && ({ ...f, especialidades: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cor no calendário</label>
              <input type="color" className="h-9 w-full rounded border border-gray-200 cursor-pointer" value={form.color} onChange={e => setForm(f => f && ({ ...f, color: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Estado</label>
              <select className="input text-sm w-full" value={form.active} onChange={e => setForm(f => f && ({ ...f, active: parseInt(e.target.value) }))}>
                <option value={1}>Ativo</option>
                <option value={0}>Inativo</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Foto do barbeiro</label>
              <PhotoUploader value={form.foto} onChange={url => setForm(f => f && ({ ...f, foto: url }))} folder="barbeiros" />
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setForm(null)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary text-xs disabled:opacity-50">{saving ? 'A guardar...' : 'Guardar'}</button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── MARCAS PARCEIRAS ───────────────────────────────────────────────────────────
interface BrandForm { id?: number; name: string; logo_url: string; website_url: string; ordem: string }
const emptyBrand = (): BrandForm => ({ name: '', logo_url: '', website_url: '', ordem: '0' })

function MarcasSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => adminApi.get<Brand[]>('/api/admin/brands'),
  })
  const brands: Brand[] = (data?.data as unknown as Brand[]) ?? []

  const [form, setForm]         = useState<BrandForm | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  const openNew  = () => { setForm(emptyBrand()); setErr(null) }
  const openEdit = (b: Brand) => {
    setForm({ id: b.id, name: b.name, logo_url: b.logo_url ?? '', website_url: b.website_url ?? '', ordem: String(b.ordem) })
    setErr(null)
  }
  const save = async () => {
    if (!form) return
    if (!form.name.trim()) { setErr('Nome é obrigatório'); return }
    setSaving(true); setErr(null)
    try {
      const body = { name: form.name.trim(), logo_url: form.logo_url || null, website_url: form.website_url || null, ordem: parseInt(form.ordem) || 0 }
      if (form.id) await adminApi.put(`/api/admin/brands/${form.id}`, body)
      else         await adminApi.post('/api/admin/brands', body)
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['public-brands'] })
      setForm(null)
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro ao guardar') }
    finally { setSaving(false) }
  }
  const del = async (id: number) => {
    try {
      await adminApi.delete(`/api/admin/brands/${id}`)
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['public-brands'] })
    } catch {}
    setDeleteId(null)
  }

  return (
    <Card>
      <SectionHeader
        icon={ShoppingBag}
        title="Marcas Parceiras"
        subtitle="Logos exibidos no carrossel da homepage entre a secção Sobre e os Serviços"
      />
      {isLoading ? <LoadingSpinner size="sm" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="text-left py-2 pr-3 font-medium">Logo</th>
                <th className="text-left py-2 pr-3 font-medium">Nome</th>
                <th className="text-left py-2 pr-3 font-medium">Website</th>
                <th className="text-left py-2 font-medium">Ordem</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {brands.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400 text-sm">
                    Nenhuma marca adicionada ainda.
                  </td>
                </tr>
              )}
              {brands.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2.5 pr-3">
                    {b.logo_url
                      ? <img src={b.logo_url} alt={b.name} className="h-8 w-auto max-w-[80px] object-contain bg-gray-50 rounded border border-gray-100 p-0.5" />
                      : <span className="text-gray-300 text-xs italic">sem logo</span>
                    }
                  </td>
                  <td className="py-2.5 pr-3 font-medium">{b.name}</td>
                  <td className="py-2.5 pr-3 text-gray-500 text-xs max-w-[160px] truncate">
                    {b.website_url
                      ? <a href={b.website_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{b.website_url}</a>
                      : '—'
                    }
                  </td>
                  <td className="py-2.5 text-gray-500">{b.ordem}</td>
                  <td className="py-2.5 pl-3 whitespace-nowrap">
                    {deleteId === b.id
                      ? <ConfirmDelete onConfirm={() => del(b.id)} onCancel={() => setDeleteId(null)} />
                      : <span className="flex items-center gap-1">
                          <button onClick={() => openEdit(b)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteId(b.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                        </span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={openNew} className="mt-4 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
            <Plus size={16} /> Adicionar marca
          </button>
        </div>
      )}
      {form && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">{form.id ? 'Editar marca' : 'Nova marca'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Nome *</label>
              <input className="input text-sm w-full" placeholder="Ex: Babyliss, Wahl, Andis"
                value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Website (opcional)</label>
              <input type="url" className="input text-sm w-full" placeholder="https://..."
                value={form.website_url} onChange={e => setForm(f => f && ({ ...f, website_url: e.target.value }))} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Ordem (menor = primeiro)</label>
              <input type="number" min={0} className="input text-sm w-full"
                value={form.ordem} onChange={e => setForm(f => f && ({ ...f, ordem: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Logo da marca</label>
              <PhotoUploader
                value={form.logo_url}
                onChange={url => setForm(f => f && ({ ...f, logo_url: url }))}
                folder="marcas"
              />
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setForm(null)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
              {saving ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── ADMIN USERS ──────────────────────────────────────────────────────────────
interface AdminUserForm { id?: number; username: string; password: string; nome: string; role: 'admin' | 'barbeiro' | 'superAdmin'; barbeiro_id: string; ativo: number }
const emptyAdminUser = (): AdminUserForm => ({ username: '', password: '', nome: '', role: 'barbeiro', barbeiro_id: '', ativo: 1 })

function AdminUsersSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin-users-list'], queryFn: () => adminApi.get<AdminUser[]>('/api/admin/admin-users') })
  const users: AdminUser[] = (data?.data as unknown as AdminUser[]) ?? []
  const { data: barbersData } = useQuery({ queryKey: ['admin-barbers-cfg'], queryFn: () => adminApi.get<Barber[]>('/api/admin/barbers?include_inactive=1') })
  const barbers: Barber[] = (barbersData?.data as unknown as Barber[]) ?? []

  const [form, setForm]         = useState<AdminUserForm | null>(null)
  const [showPw, setShowPw]     = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  const openNew  = () => { setForm(emptyAdminUser()); setErr(null) }
  const openEdit = (u: AdminUser) => {
    setForm({ id: u.id, username: u.username, password: '', nome: u.nome, role: u.role, barbeiro_id: u.barbeiro_id ? String(u.barbeiro_id) : '', ativo: u.ativo })
    setErr(null)
  }
  const save = async () => {
    if (!form) return
    if (!form.username || !form.nome || !form.role) { setErr('Username, nome e role são obrigatórios'); return }
    if (!form.id && !form.password) { setErr('Password obrigatória para novo utilizador'); return }
    setSaving(true); setErr(null)
    try {
      const body: Record<string, unknown> = { username: form.username, nome: form.nome, role: form.role, ativo: form.ativo, barbeiro_id: form.barbeiro_id || null }
      if (form.password) body.password = form.password
      if (form.id) await adminApi.put(`/api/admin/admin-users/${form.id}`, body)
      else         await adminApi.post('/api/admin/admin-users', body)
      qc.invalidateQueries({ queryKey: ['admin-users-list'] })
      setForm(null)
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro ao guardar') }
    finally { setSaving(false) }
  }
  const del = async (id: number) => {
    try {
      await adminApi.delete(`/api/admin/admin-users/${id}`)
      qc.invalidateQueries({ queryKey: ['admin-users-list'] })
    } catch {}
    setDeleteId(null)
  }

  return (
    <Card>
      <SectionHeader icon={Users} title="Utilizadores Admin" subtitle="Gerir contas de acesso ao painel" />
      {isLoading ? <LoadingSpinner size="sm" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="text-left py-2 pr-3 font-medium">Username</th>
                <th className="text-left py-2 pr-3 font-medium">Nome</th>
                <th className="text-left py-2 pr-3 font-medium">Role</th>
                <th className="text-left py-2 pr-3 font-medium">Barbeiro</th>
                <th className="text-left py-2 font-medium">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2.5 pr-3 font-mono text-xs text-gray-700">{u.username}</td>
                  <td className="py-2.5 pr-3 font-medium">{u.nome}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ u.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-blue-50 text-blue-700' }`}>{u.role}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-500 text-xs">{u.barbeiro_nome ?? '—'}</td>
                  <td className="py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ u.ativo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500' }`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="py-2.5 pl-3 whitespace-nowrap">
                    {deleteId === u.id
                      ? <ConfirmDelete onConfirm={() => del(u.id)} onCancel={() => setDeleteId(null)} />
                      : <span className="flex items-center gap-1">
                          <button onClick={() => openEdit(u)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteId(u.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                        </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={openNew} className="mt-4 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
            <Plus size={16} /> Novo utilizador
          </button>
        </div>
      )}
      {form && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">{form.id ? 'Editar utilizador' : 'Novo utilizador'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Username *</label>
              <input className="input text-sm w-full" value={form.username} onChange={e => setForm(f => f && ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nome *</label>
              <input className="input text-sm w-full" value={form.nome} onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">{form.id ? 'Nova password (vazio = manter)' : 'Password *'}</label>
              <input type={showPw ? 'text' : 'password'} className="input text-sm w-full pr-9" value={form.password} onChange={e => setForm(f => f && ({ ...f, password: e.target.value }))} />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-[26px] text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role *</label>
              <select className="input text-sm w-full" value={form.role} onChange={e => setForm(f => f && ({ ...f, role: e.target.value as 'admin' | 'barbeiro' | 'superAdmin' }))}>
                <option value="barbeiro">Barbeiro</option>
                <option value="admin">Admin</option>
                <option value="superAdmin">Super Administrador</option>
              </select>
            </div>
            {form.role === 'barbeiro' && (
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Barbeiro associado</label>
                <select className="input text-sm w-full" value={form.barbeiro_id} onChange={e => setForm(f => f && ({ ...f, barbeiro_id: e.target.value }))}>
                  <option value="">— Nenhum —</option>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Estado</label>
              <select className="input text-sm w-full" value={form.ativo} onChange={e => setForm(f => f && ({ ...f, ativo: parseInt(e.target.value) }))}>
                <option value={1}>Ativo</option>
                <option value={0}>Inativo</option>
              </select>
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setForm(null)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary text-xs disabled:opacity-50">{saving ? 'A guardar...' : 'Guardar'}</button>
          </div>
        </div>
      )}
    </Card>
  )
}
