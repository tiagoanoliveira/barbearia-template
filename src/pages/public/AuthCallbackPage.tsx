import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Scissors, Phone } from 'lucide-react'
import { api } from '@/api/client'

/**
 * Rota: /auth/callback
 * Intermediário entre o callback OAuth (server-side) e o frontend.
 * O servidor redireciona para cá com ?token=...&redirect=...&needs_phone=1 (opcional).
 *
 * Se needs_phone=1: guarda o token e mostra ecrã de introdução do contacto (obrigatório).
 * Após guardar o contacto navega para o destino final.
 */
export default function AuthCallbackPage() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()

  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [redirectTo, setRedirectTo]         = useState('/perfil')
  const [phone, setPhone]                   = useState('')
  const [phoneError, setPhoneError]         = useState('')
  const [saving, setSaving]                 = useState(false)

  useEffect(() => {
    const token      = searchParams.get('token')
    const redirect   = searchParams.get('redirect') ?? '/perfil'
    const needsPhone = searchParams.get('needs_phone') === '1'

    if (!token) {
      navigate('/login?error=oauth_failed', { replace: true })
      return
    }

    localStorage.setItem('user_token', token)
    window.dispatchEvent(new Event('authchange'))
    setRedirectTo(redirect)

    if (needsPhone) {
      setShowPhoneModal(true)
    } else {
      navigate(redirect, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault()
    setPhoneError('')

    const cleaned = phone.replace(/\s/g, '')
    if (!cleaned || cleaned.length < 9) {
      setPhoneError('Insere um número de telemóvel válido (mínimo 9 dígitos).')
      return
    }

    setSaving(true)
    // Usa o mesmo endpoint e método do ProfilePage (/api/me PUT)
    const res = await api.put('/api/me', { phone: cleaned })
    setSaving(false)

    if (!res.success) {
      setPhoneError((res as any).error ?? 'Erro ao guardar o contacto.')
      return
    }

    navigate(redirectTo, { replace: true })
  }

  // ── Ecrã de introdução de contacto (obrigatório) ──────────────────────
  if (showPhoneModal) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center">
              <Phone size={22} className="text-white" />
            </div>
            <h1 className="text-white text-xl font-semibold text-center">
              Falta só o teu contacto
            </h1>
            <p className="text-gray-400 text-sm text-center">
              Para poderes fazer reservas precisamos do teu número de telemóvel.
            </p>
          </div>

          <form onSubmit={handleSavePhone} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-gray-300 text-sm font-medium">
                Telemóvel <span className="text-brand-400">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="912 345 678"
                value={phone}
                onChange={e => { setPhone(e.target.value); setPhoneError('') }}
                autoFocus
                required
                className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
              />
              {phoneError && (
                <p className="text-red-400 text-xs mt-0.5">{phoneError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition text-sm"
            >
              {saving ? 'A guardar…' : 'Guardar e continuar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Ecrã de carregamento (enquanto redireciona) ───────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center">
          <Scissors size={22} className="text-white" />
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <span className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-brand-500 rounded-full" />
          A autenticar…
        </div>
      </div>
    </div>
  )
}
