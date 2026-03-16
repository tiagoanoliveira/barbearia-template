import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { KeyRound, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react'
import { api } from '@/api/client'

export default function ResetPasswordPage() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const token           = searchParams.get('token') ?? ''

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A password deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As passwords não coincidem.')
      return
    }
    if (!token) {
      setError('Link inválido. Por favor, pede um novo email de recuperação.')
      return
    }

    setLoading(true)
    const res = await api.post('/api/auth/reset-password', { token, password })
    setLoading(false)

    if (!res.success) {
      setError(res.error ?? 'Erro ao redefinir a password.')
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/login'), 3000)
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-red-400">Link inválido ou em falta.</p>
          <Link to="/esqueci-password" className="text-brand-400 underline text-sm">Pedir novo link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-sm">
        {success ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-900/40 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h1 className="text-xl font-semibold text-white">Password alterada!</h1>
            <p className="text-gray-400 text-sm">A tua password foi redefinida com sucesso. A redirecionar para o login...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 bg-brand-900/40 rounded-2xl flex items-center justify-center mb-4">
                <KeyRound size={28} className="text-brand-400" />
              </div>
              <h1 className="text-xl font-semibold text-white">Nova password</h1>
              <p className="text-gray-500 text-sm mt-1 text-center">Escolhe uma nova password para a tua conta.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Nova password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                               text-white placeholder:text-gray-600 text-sm pr-11
                               focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirmar password</label>
                <input
                  type="password" required
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repetir password"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                             text-white placeholder:text-gray-600 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500
                           text-white font-semibold rounded-xl hover:bg-brand-600
                           transition-colors disabled:opacity-50"
              >
                {loading
                  ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  : 'Redefinir password'
                }
              </button>

              <p className="text-center text-xs text-gray-600">
                <Link to="/esqueci-password" className="text-brand-400 hover:underline">Pedir um novo link</Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
