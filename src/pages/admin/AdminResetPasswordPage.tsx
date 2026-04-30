import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Scissors, Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react'
import { barberShopConfig, LOGO_URL } from '@/config/theme'
import { ROUTES } from '@/config/routes'

export default function AdminResetPasswordPage() {
  const [username, setUsername]       = useState('')
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState<string | null>(null)

  const LogoMark = () => (
    LOGO_URL
      ? <img src={LOGO_URL} alt={barberShopConfig.name} className="w-16 h-16 object-contain flex-shrink-0" />
      : <div className="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Scissors size={32} className="text-white" />
        </div>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPw !== confirmPw) {
      setError('As passwords não coincidem.')
      return
    }
    if (newPw.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword: newPw }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Erro ao actualizar password.')
      } else {
        setSuccess(data?.data?.message ?? 'Password actualizada com sucesso!')
        setUsername('')
        setNewPw('')
        setConfirmPw('')
      }
    } catch {
      setError('Erro de rede. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <Link to={ROUTES.ADMIN_LOGIN} className="flex items-center gap-2.5 flex-shrink-0 mb-2">
            <LogoMark />
          </Link>
          <h1 className="text-xl font-bold text-white">{barberShopConfig.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Definir nova password</p>
        </div>

        {/* Aviso temporário */}
        <div className="flex items-start gap-2.5 bg-amber-950/60 border border-amber-700/50 rounded-xl px-4 py-3 mb-5">
          <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300 leading-relaxed">
            Página temporária para correcção de passwords. Não partilhes este link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="o-teu-username"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                         text-white placeholder:text-gray-600 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Nova password */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nova password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                           text-white placeholder:text-gray-600 text-sm pr-11
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                aria-label={showNew ? 'Ocultar password' : 'Mostrar password'}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirmar password */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirmar password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                           text-white placeholder:text-gray-600 text-sm pr-11
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                aria-label={showConfirm ? 'Ocultar password' : 'Mostrar password'}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Sucesso */}
          {success && (
            <div className="flex items-center gap-2.5 bg-green-950/60 border border-green-700/50 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="text-green-400 shrink-0" />
              <p className="text-sm text-green-300">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500
                       text-white font-semibold rounded-xl hover:bg-brand-600
                       transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <><KeyRound size={18} /> Actualizar password</>
            )}
          </button>

          <div className="text-center pt-1">
            <Link
              to={ROUTES.ADMIN_LOGIN}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Voltar ao login
            </Link>
          </div>

        </form>
      </div>
    </div>
  )
}
