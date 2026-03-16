import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { api } from '@/api/client'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await api.post('/api/auth/forgot-password', { email })
    setLoading(false)

    if (!res.success) {
      setError(res.error ?? 'Erro ao processar o pedido.')
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-sm">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 mb-8 transition-colors">
          <ArrowLeft size={16} /> Voltar ao login
        </Link>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-900/40 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h1 className="text-xl font-semibold text-white">Email enviado!</h1>
            <p className="text-gray-400 text-sm">
              Se existir uma conta associada a <strong className="text-gray-200">{email}</strong>,
              receberás um email com instruções para recuperar a password.
            </p>
            <p className="text-gray-600 text-xs">Não te esqueças de verificar a pasta de spam.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 bg-brand-900/40 rounded-2xl flex items-center justify-center mb-4">
                <Mail size={28} className="text-brand-400" />
              </div>
              <h1 className="text-xl font-semibold text-white">Esqueceste a password?</h1>
              <p className="text-gray-500 text-sm mt-1 text-center">
                Indica o teu email e enviamos um link para redefinires a password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.pt"
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
                  : 'Enviar link de recuperação'
                }
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
