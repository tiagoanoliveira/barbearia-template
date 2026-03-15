import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Edit2, Camera, X, Save, Link2, Unlink, Star } from 'lucide-react'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Client } from '@/types'

interface ProfileForm {
  name: string; email: string; phone: string; nif: string
  current_password: string; new_password: string; new_password_confirm: string
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const photoRef = useRef<HTMLInputElement>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<ProfileForm>({
    name: '', email: '', phone: '', nif: '',
    current_password: '', new_password: '', new_password_confirm: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

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
    }
  }, [user])

  const updateProfile = useMutation({
    mutationFn: (data: Partial<ProfileForm>) => api.put('/api/me', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); setEditOpen(false); setFormError(null) },
    onError:   (e: any) => setFormError(e?.message ?? 'Erro ao guardar.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.new_password && form.new_password !== form.new_password_confirm) {
      setFormError('As passwords não coincidem.'); return
    }
    const payload: Record<string, string> = { name: form.name, email: form.email, phone: form.phone, nif: form.nif }
    if (form.new_password) {
      payload.current_password = form.current_password
      payload.new_password     = form.new_password
    }
    updateProfile.mutate(payload)
  }

  const handleLogout = () => { localStorage.removeItem('user_token'); navigate('/login') }
  const field = (key: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  // Upload de foto de perfil
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

  const methods     = (user?.auth_methods ?? '').split(',').map(m => m.trim()).filter(Boolean)
  const hasGoogle   = methods.includes('google')
  const hasFacebook = methods.includes('facebook')
  const hasPassword = methods.includes('password')

  const handleLinkGoogle    = () => { window.location.href = `/api/auth/google?redirect=${encodeURIComponent('/perfil')}` }
  const handleLinkFacebook  = () => { window.location.href = `/api/auth/facebook?redirect=${encodeURIComponent('/perfil')}` }

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

  const totalCompleted = user.completed_reservations ?? 0
  const currentStamps  = totalCompleted % 10
  const isNextFree     = currentStamps === 9

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

        {/* Cartão de fidelização */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-gray-900">Cartão de fidelização</h3>
            </div>
            <span className="text-xs text-gray-500">{totalCompleted} cortes concluídos</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">O 10º corte é por conta da casa 🍻</p>
          <div className="grid grid-cols-5 gap-2 mb-3 max-w-md">
            {Array.from({ length: 10 }).map((_, i) => {
              const isFilled = i < currentStamps
              const isGift   = i === 9
              const isNext   = isGift && isNextFree
              return (
                <div key={i} className={`flex items-center justify-center aspect-square rounded-2xl text-xs font-semibold border ${
                  isGift
                    ? isNext ? 'bg-amber-500 text-white border-amber-400 animate-pulse' : 'bg-amber-500/10 text-amber-400 border-amber-400/40'
                    : isFilled ? 'bg-primary-500 text-white border-primary-500/80' : 'bg-white/5 text-gray-500 border-white/10'
                }`}>
                  {isGift ? '10' : i + 1}
                </div>
              )
            })}
          </div>
          {isNextFree
            ? <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">O teu próximo corte será gratuito. Apresenta este ecrã no pagamento para aplicar a oferta.</p>
            : <p className="text-xs text-gray-500">Faltam <span className="font-semibold text-gray-700">{10 - currentStamps}</span> reservas para o próximo corte grátis.</p>
          }
        </Card>

        {/* Foto de perfil */}
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

        {/* Info pessoal */}
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

        {/* Métodos de autenticação */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Métodos de autenticação</h3>
          <p className="text-xs text-gray-500 mb-3">
            Podes associar a tua conta do Google ou Facebook. Para remover todos os métodos sociais, é obrigatório ter uma password definida.
          </p>
          <div className="space-y-2">
            {/* Password */}
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-900">Password</p>
                <p className="text-xs text-gray-500">{hasPassword ? 'Password definida' : 'Ainda não definiste uma password.'}</p>
              </div>
              {hasPassword
                ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">Ativo</span>
                : <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">Recomendado</span>
              }
            </div>

            {/* Google */}
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

            {/* Facebook */}
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
          </div>
          {linkError && <p className="mt-3 text-xs text-red-500">{linkError}</p>}
        </Card>

      </div>

      {/* Modal editar */}
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
              <hr className="border-gray-100" />
              <p className="text-xs text-gray-500">Alteração de password (opcional)</p>
              {([['Password atual','current_password','password'],['Nova password','new_password','password'],['Confirmar password','new_password_confirm','password']] as const).map(([label, key, type]) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input type={type} className="input" value={(form as any)[key]} onChange={field(key as keyof ProfileForm)} />
                </div>
              ))}
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
    </div>
  )
}
