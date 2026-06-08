import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, Navigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Edit2, Camera, X, Save, Link2, Unlink, Star, Eye, EyeOff, KeyRound, Tag } from 'lucide-react'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Client, Discount } from '@/types'
import { isDiscountUsable } from '@/types'
import { barberShopConfig } from '@/config/theme'

interface ProfileForm {
  name: string; email: string; phone: string; nif: string
  current_password: string; new_password: string; new_password_confirm: string
}

function SetPasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ new_password: '', new_password_confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.new_password.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres.')
      return
    }
    if (form.new_password !== form.new_password_confirm) {
      setError('As passwords não coincidem.')
      return
    }
    setLoading(true)
    const res = await api.put('/api/me', { new_password: form.new_password })
    setLoading(false)
    if (!res.success) {
      setError((res as any).error ?? 'Erro ao definir password.')
      return
    }
    onSuccess()
    onClose()
  }

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Definir password</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="label">Nova password</label>
              <div className="relative">
                <input
                    type={showPw ? 'text' : 'password'}
                    className="input pr-10"
                    value={form.new_password}
                    onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    required
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirmar password</label>
              <div className="relative">
                <input
                    type={showConfirm ? 'text' : 'password'}
                    className="input pr-10"
                    value={form.new_password_confirm}
                    onChange={e => setForm(f => ({ ...f, new_password_confirm: e.target.value }))}
                    placeholder="Repete a password"
                    required
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'A guardar...' : 'Definir password'}
              </button>
            </div>
          </form>
        </div>
      </div>
  )
}

// ─── Helpers de desconto ───────────────────────────────────────────────────
function mapRawDiscount(d: any): Discount {
  return {
    id:                       d.id,
    client_id:                d.cliente_id ?? null,
    name:                     d.nome,
    description:              d.descricao ?? null,
    type:                     d.tipo,
    origin:                   d.origem ?? null,
    value_percent:            d.valor_percentagem ?? null,
    value_fixed:              d.valor_fixo_centimos ?? null,
    valid_from:               d.valido_de ?? null,
    valid_to:                 d.valido_ate ?? null,
    min_reservations:         d.min_reservas ?? null,
    min_reservations_period:  d.min_reservas_periodo ?? null,
    group:                    d.grupo ?? null,
    rule_type:                d.regra_tipo ?? null,
    rule_detail:              d.regra_detalhe ?? null,
    max_uses:                 d.max_usos ?? null,
    used_count:               d.usos_feitos ?? 0,
    last_used_at:             d.usado_ultima_vez_em ?? null,
    last_used_reservation_id: d.usado_ultima_reserva_id ?? null,
    usage_comment:            d.comentario_uso ?? null,
    active:                   !!d.ativo,
    created_by_admin_id:      d.criado_por_admin_id ?? null,
    created_at:               d.criado_em,
    updated_at:               d.atualizado_em,
  }
}

function fmtDiscountValue(d: Discount): string {
  if (d.value_percent != null) return `${d.value_percent}% de desconto`
  if (d.value_fixed   != null) return `${(d.value_fixed / 100).toFixed(2)}€ de desconto`
  return ''
}

// Agrupa descontos pelo campo group; descontos sem grupo ficam em grupos individuais (chave = 'solo-{id}')
function groupDiscounts(discounts: Discount[]): { groupKey: string; items: Discount[] }[] {
  const map = new Map<string, Discount[]>()
  for (const d of discounts) {
    const key = d.group ?? `solo-${d.id}`
    const existing = map.get(key)
    if (existing) existing.push(d)
    else map.set(key, [d])
  }
  return Array.from(map.entries()).map(([groupKey, items]) => ({ groupKey, items }))
}

const TIPO_BADGE: Record<string, string> = {
  ocasional:   'bg-amber-100 text-amber-700',
  vitalicio:   'bg-emerald-100 text-emerald-700',
  mensal:      'bg-blue-100 text-blue-700',
  quantidade:  'bg-indigo-100 text-indigo-700',
  servico:     'bg-teal-100 text-teal-700',
  fidelizacao: 'bg-purple-100 text-purple-700',
  campanha:    'bg-pink-100 text-pink-700',
  outro:       'bg-gray-100 text-gray-600',
}

function DiscountCard({ d }: { d: Discount }) {
  const badgeClass = TIPO_BADGE[d.type] ?? 'bg-gray-100 text-gray-600'
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
        <Tag size={14} className="text-primary-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{d.name}</p>
          {/* Só mostra badge de tipo se for relevante para o cliente (não 'quantidade') */}
          {!['quantidade', 'mensal'].includes(d.type) && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{d.type}</span>
          )}
        </div>
        {d.description && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{d.description}</p>
        )}
        <p className="text-xs font-semibold text-primary-600 mt-1">{fmtDiscountValue(d)}</p>
        {d.max_uses != null && (
          <p className="text-xs text-gray-400 mt-0.5">
            {d.max_uses === 1
              ? 'Válido para uma utilização'
              : `${d.used_count} / ${d.max_uses} utilizações`
            }
          </p>
        )}
      </div>
    </div>
  )
}

// Grupo de descontos com o mesmo 'group' — mostrados como conjunto
function DiscountGroup({ groupKey, items }: { groupKey: string; items: Discount[] }) {
  const hasGroup = !groupKey.startsWith('solo-')
  if (!hasGroup) return <DiscountCard d={items[0]} />
  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 px-4 py-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">{groupKey}</p>
      {items.map(d => (
        <div key={d.id} className="flex items-start gap-2">
          <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg bg-white flex items-center justify-center border border-indigo-100">
            <Tag size={11} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold text-gray-900 leading-snug">{d.name}</p>
            </div>
            {d.description && <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>}
            <p className="text-xs font-semibold text-primary-600 mt-0.5">{fmtDiscountValue(d)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Bloco de descontos no perfil público ─────────────────────────────────────
function ProfileDiscountsBlock({ clientId }: { clientId: number }) {
  const { data: clientRes }  = useQuery({
    queryKey: ['profile-discounts-client', clientId],
    queryFn: () => api.get<any[]>(`/api/discounts/client/${clientId}`),
    enabled: !!clientId,
  })
  const { data: generalRes } = useQuery({
    queryKey: ['profile-discounts-general'],
    queryFn: () => api.get<any[]>('/api/discounts/general'),
  })

  const clientDiscounts: Discount[] = ((clientRes as any)?.data ?? []).map(mapRawDiscount).filter(isDiscountUsable)
  const generalDiscounts: Discount[] = ((generalRes as any)?.data ?? []).map(mapRawDiscount).filter(isDiscountUsable)

  if (clientDiscounts.length === 0 && generalDiscounts.length === 0) return null

  const clientGroups  = groupDiscounts(clientDiscounts)
  const generalGroups = groupDiscounts(generalDiscounts)

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Tag size={16} className="text-primary-500" />
        <h3 className="text-sm font-semibold text-gray-900">Os meus descontos</h3>
      </div>

      {clientGroups.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Descontos exclusivos</p>
          <div className="space-y-2">
            {clientGroups.map(g => <DiscountGroup key={g.groupKey} {...g} />)}
          </div>
        </div>
      )}

      {generalGroups.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Descontos gerais</p>
          <div className="space-y-2">
            {generalGroups.map(g => <DiscountGroup key={g.groupKey} {...g} />)}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        💡 Apresenta o teu perfil na barbearia para o barbeiro aplicar o desconto no momento do pagamento.
      </p>
    </Card>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const photoRef = useRef<HTMLInputElement>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [setPasswordOpen, setSetPasswordOpen] = useState(false)
  const [form, setForm] = useState<ProfileForm>({
    name: '', email: '', phone: '', nif: '',
    current_password: '', new_password: '', new_password_confirm: '',
  })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [emailChangeInfo, setEmailChangeInfo] = useState<{
    pendingEmail: string
    hadSocial: boolean
  } | null>(null)

  const hasToken = !!localStorage.getItem('user_token')
  if (!hasToken) return <Navigate to="/login?redirect=/perfil" replace />

  const { data: meRes, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Client>('/api/me'),
    retry: false,
  })

  const user = meRes?.data as (Client & {
    completed_reservations?: number; auth_methods?: string
  }) | undefined

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        name:  user.name  ?? '',
        email: user.email ?? '',
        phone: (user as any).phone ?? '',
        nif:   (user as any).nif   ?? '',
      }))
      const photoUrl = (user as any).photo_url ?? null
      if (photoUrl) {
        localStorage.setItem('user_photo', photoUrl)
      } else {
        localStorage.removeItem('user_photo')
      }
      window.dispatchEvent(new Event('authchange'))
    }
  }, [user])

  useEffect(() => {
    const code = searchParams.get('social_error')
    if (!code) return
    if (code === 'google_email_mismatch') {
      setLinkError('O email da conta Google não corresponde ao email desta conta. Usa o mesmo email para associar ou termina sessão e entra com essa conta primeiro.')
    } else if (code === 'facebook_email_mismatch') {
      setLinkError('O email da conta Facebook não corresponde ao email desta conta. Usa o mesmo email para associar ou termina sessão e entra com essa conta primeiro.')
    }
  }, [searchParams])

  const methods     = (user?.auth_methods ?? '').split(',').map(m => m.trim()).filter(Boolean)
  const hasGoogle   = methods.includes('google')
  const hasFacebook = methods.includes('facebook')
  const hasPassword = methods.includes('password')
  const hasSocial   = hasGoogle || hasFacebook

  const updateProfile = useMutation({
    mutationFn: (data: Partial<ProfileForm>) => api.put('/api/me', data),
    onSuccess: (res: any) => {
      if (!res?.success) {
        setFormError(res?.error ?? 'Erro ao guardar.')
        return
      }
      qc.invalidateQueries({ queryKey: ['me'] })
      setEditOpen(false)
      setFormError(null)
      setShowCurrentPw(false)
      setShowNewPw(false)
      setShowConfirmPw(false)
      if (res?.data?.email_change_pending && res.data.pending_email) {
        setEmailChangeInfo({
          pendingEmail: res.data.pending_email,
          hadSocial: hasSocial,
        })
      }
    },
    onError: (e: any) => setFormError(e?.message ?? 'Erro ao guardar.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) { setFormError('O nome não pode estar vazio.'); return }
    if (!form.phone.trim()) { setFormError('O número de telemovel não pode ser removido.'); return }
    if (!form.email.trim()) { setFormError('O email não pode estar vazio.'); return }
    if (form.new_password && form.new_password !== form.new_password_confirm) {
      setFormError('As passwords não coincidem.')
      return
    }
    const payload: Record<string, string> = {
      name: form.name, email: form.email, phone: form.phone, nif: form.nif,
    }
    if (form.new_password) {
      payload.current_password = form.current_password
      payload.new_password     = form.new_password
    }
    updateProfile.mutate(payload)
  }

  const handleLogout = () => {
    localStorage.removeItem('user_token')
    localStorage.removeItem('user_photo')
    window.dispatchEvent(new Event('authchange'))
    navigate('/login')
  }

  const field = (key: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    setPhotoError(null)
    try {
      const token = localStorage.getItem('user_token')
      const fd    = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/me/photo', {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    fd,
      })
      const data = await res.json()
      if (data.success) {
        if (data.data?.photo_url) {
          localStorage.setItem('user_photo', data.data.photo_url)
          window.dispatchEvent(new Event('authchange'))
        }
        qc.invalidateQueries({ queryKey: ['me'] })
      } else {
        setPhotoError(data.error ?? 'Erro ao fazer upload da foto.')
      }
    } catch (err: any) {
      setPhotoError('Erro de rede: ' + err.message)
    } finally {
      setPhotoUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleLinkGoogle = async () => {
    setLinkError(null)
    try {
      const token = localStorage.getItem('user_token')
      const res = await fetch(`/api/auth/google/link?redirect=${encodeURIComponent('/perfil')}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.success && data.data?.url) window.location.href = data.data.url
      else setLinkError(data.error ?? 'Não foi possível iniciar a associação com a Google.')
    } catch { setLinkError('Erro de rede ao iniciar associação com a Google.') }
  }

  const handleLinkFacebook = async () => {
    setLinkError(null)
    try {
      const token = localStorage.getItem('user_token')
      const res = await fetch(`/api/auth/facebook/link?redirect=${encodeURIComponent('/perfil')}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.success && data.data?.url) window.location.href = data.data.url
      else setLinkError(data.error ?? 'Não foi possível iniciar a associação com o Facebook.')
    } catch { setLinkError('Erro de rede ao iniciar associação com o Facebook.') }
  }

  const handleUnlinkGoogle = async () => {
    setLinkError(null)
    const res = await api.delete<{ message: string }>('/api/auth/google/unlink')
    if (!res.success) setLinkError(res.error ?? 'Não foi possível desassociar a conta Google.')
    else qc.invalidateQueries({ queryKey: ['me'] })
  }
  const handleUnlinkFacebook = async () => {
    setLinkError(null)
    const res = await api.delete<{ message: string }>('/api/auth/facebook/unlink')
    if (!res.success) setLinkError(res.error ?? 'Não foi possível desassociar a conta Facebook.')
    else qc.invalidateQueries({ queryKey: ['me'] })
  }

  if (isLoading) return <div className="pt-24 flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (!user)     return <Navigate to="/login?redirect=/perfil" replace />

  const { everyN } = barberShopConfig.loyalty
  const stampsNeeded   = everyN - 1
  const totalCompleted = user.completed_reservations ?? 0
  const currentStamps  = totalCompleted % everyN
  const isNextFree     = currentStamps === stampsNeeded
  const faltam         = stampsNeeded - currentStamps
  const discountsEnabled = !!(barberShopConfig.discounts as any)?.enabled

  return (
      <div className="pt-24 pb-16 min-h-screen bg-gray-950 text-white">
        <div className="max-w-2xl mx-auto px-4 space-y-5">

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black">O meu perfil</h1>
            <button onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl text-sm transition-all">
              <LogOut size={16} /> Sair
            </button>
          </div>

          <Link to="/reservations"
                className="flex items-center justify-between px-5 py-4 bg-primary-500/10 border border-primary-500/30 rounded-2xl hover:bg-primary-500/20 transition-all">
            <span className="text-primary-400 font-semibold">Ver as minhas reservas</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>

          {barberShopConfig.loyalty.enabled && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-amber-400" />
                  <h3 className="text-sm font-semibold text-gray-900">Cartão de fidelização</h3>
                </div>
                <span className="text-xs text-gray-500">{totalCompleted} cortes concluídos</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">O {everyN}º corte é por conta da casa 🍻</p>
              <div
                className="grid gap-2 mb-3 max-w-md mx-auto"
                style={{ gridTemplateColumns: `repeat(${Math.min(everyN, 5)}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: everyN }).map((_, i) => {
                  const isGiftSlot = i === everyN - 1
                  const isFilled   = i < currentStamps
                  const isActive   = isGiftSlot && isNextFree
                  return (
                      <div key={i} className={`flex items-center justify-center aspect-square rounded-2xl text-xs font-semibold border ${
                          isGiftSlot
                              ? isActive
                                  ? 'bg-amber-500 text-white border-amber-400 animate-pulse'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-400/40'
                              : isFilled
                                  ? 'bg-primary-500 text-white border-primary-500/80'
                                  : 'bg-white/5 text-gray-500 border-white/10'
                      }`}>
                        {isGiftSlot ? '🎁' : i + 1}
                      </div>
                  )
                })}
              </div>
              {isNextFree
                  ? <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">O teu próximo corte será gratuito. Apresenta este ecrã no pagamento para aplicar a oferta.</p>
                  : <p className="text-xs text-gray-500">Faltam <span className="font-semibold text-gray-700">{faltam}</span> {faltam === 1 ? 'reserva' : 'reservas'} para o próximo corte grátis.</p>
              }
            </Card>
          )}

          {user.id && discountsEnabled && (
            <ProfileDiscountsBlock clientId={user.id} />
          )}

          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Foto de perfil</h3>
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-primary-100 overflow-hidden">
                  {(user as any).photo_url
                      ? <img src={(user as any).photo_url} alt={user.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-primary-700 text-3xl font-black">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                  }
                </div>
                <button onClick={() => photoRef.current?.click()} disabled={photoUploading}
                        className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center shadow-md hover:bg-primary-600 transition-colors disabled:opacity-60">
                  {photoUploading
                      ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : <Camera size={14} className="text-white" />
                  }
                </button>
              </div>
              <div>
                <p className="text-sm text-gray-600">{photoUploading ? 'A fazer upload...' : 'Clica na câmara para alterar a foto.'}</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — máx. 3 MB</p>
                {photoError && <p className="text-xs text-red-500 mt-1">{photoError}</p>}
              </div>
              <input type="file" ref={photoRef} accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Informações pessoais</h3>
              <button onClick={() => setEditOpen(true)}
                      className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                <Edit2 size={14} /> Editar
              </button>
            </div>
            <dl className="space-y-3">
              {[
                { label: 'Nome',     value: user.name },
                { label: 'Email',    value: user.email },
                { label: 'Telefone', value: (user as any).phone || '—' },
                { label: 'NIF',      value: (user as any).nif   || '—' },
              ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <dt className="text-sm text-gray-500">{label}</dt>
                    <dd className="text-sm font-medium text-gray-900">{value}</dd>
                  </div>
              ))}
            </dl>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Métodos de autenticação</h3>
            <p className="text-xs text-gray-500 mb-3">
              {barberShopConfig.facebookEnabled
                  ? 'Podes associar a tua conta do Google ou Facebook.'
                  : 'Podes associar a tua conta do Google.'
              }{' '}
              Para remover todos os métodos sociais, é obrigatório ter uma password definida.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">Password</p>
                  <p className="text-xs text-gray-500">{hasPassword ? 'Password definida' : 'Ainda não definiste uma password.'}</p>
                </div>
                {hasPassword
                    ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">Ativo</span>
                    : (
                        <button onClick={() => setSetPasswordOpen(true)}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-medium transition-colors">
                          <KeyRound size={12} /> Definir password
                        </button>
                    )
                }
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">Google</p>
                  <p className="text-xs text-gray-500">{hasGoogle ? 'Conta Google associada.' : 'Usa a tua conta Google para entrar rapidamente.'}</p>
                </div>
                {hasGoogle
                    ? <button onClick={handleUnlinkGoogle} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100">
                      <Unlink size={12} /> Desassociar
                    </button>
                    : <button onClick={handleLinkGoogle} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white text-gray-800 border border-gray-200 hover:bg-gray-50">
                      <Link2 size={12} /> Associar Google
                    </button>
                }
              </div>
              {barberShopConfig.facebookEnabled && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Facebook</p>
                  <p className="text-xs text-gray-500">{hasFacebook ? 'Conta Facebook associada.' : 'Associa a tua conta Facebook.'}</p>
                </div>
                {hasFacebook
                    ? <button onClick={handleUnlinkFacebook} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100">
                      <Unlink size={12} /> Desassociar
                    </button>
                    : <button onClick={handleLinkFacebook} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100">
                      <Link2 size={12} /> Associar Facebook
                    </button>
                }
              </div>
              )}
            </div>
            {linkError && <p className="mt-3 text-xs text-red-500">{linkError}</p>}
          </Card>

        </div>

        {editOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Editar perfil</h3>
                  <button onClick={() => setEditOpen(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                  {([['Nome','name','text'],['Email','email','email'],['Telefone','phone','tel'],['NIF','nif','text']] as const).map(([label, key, type]) => (
                      <div key={key}>
                        <label className="label">{label}</label>
                        <input type={type} className="input" value={(form as any)[key]} onChange={field(key as keyof ProfileForm)} />
                      </div>
                  ))}
                  {hasPassword && (
                      <>
                        <hr className="border-gray-100" />
                        <p className="text-xs text-gray-500">Alteração de password (opcional)</p>
                        {([
                          ['Password atual', 'current_password', showCurrentPw, setShowCurrentPw],
                          ['Nova password', 'new_password', showNewPw, setShowNewPw],
                          ['Confirmar password', 'new_password_confirm', showConfirmPw, setShowConfirmPw],
                        ] as const).map(([label, key, show, setShow]) => (
                            <div key={key}>
                              <label className="label">{label}</label>
                              <div className="relative">
                                <input
                                    type={show ? 'text' : 'password'}
                                    className="input pr-10"
                                    value={(form as any)[key]}
                                    onChange={field(key as keyof ProfileForm)}
                                />
                                <button
                                    type="button"
                                    onClick={() => (setShow as React.Dispatch<React.SetStateAction<boolean>>)(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              </div>
                            </div>
                        ))}
                      </>
                  )}
                  {formError && <p className="text-sm text-red-500">{formError}</p>}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={updateProfile.isPending}>
                      <Save size={14} /> {updateProfile.isPending ? 'A guardar...' : 'Guardar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {setPasswordOpen && (
            <SetPasswordModal
                onClose={() => setSetPasswordOpen(false)}
                onSuccess={() => qc.invalidateQueries({ queryKey: ['me'] })}
            />
        )}

        {emailChangeInfo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
                <h3 className="font-bold text-gray-900 mb-1">Confirmação de alteração de email</h3>
                <p className="text-sm text-gray-700">
                  Enviámos um email para <span className="font-semibold">{emailChangeInfo.pendingEmail}</span> com um link para
                  confirmares a alteração do teu email.
                </p>
                <p className="text-sm text-gray-700">
                  Tens <span className="font-semibold">24 horas</span> para concluir esta confirmação. Até lá, deves continuar a
                  entrar com o teu email atual.
                </p>
                {emailChangeInfo.hadSocial && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      Atenção: ao confirmares o novo email, as contas de redes sociais associadas (Google/Facebook) serão desassociadas
                      deste perfil. Depois podes associa-las novamente se quiseres.
                    </p>
                )}
                <div className="flex justify-end pt-2">
                  <button type="button" onClick={() => setEmailChangeInfo(null)} className="btn-primary text-sm">
                    Percebi
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  )
}
