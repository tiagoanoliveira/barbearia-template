import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scissors, Eye, EyeOff, LogIn } from 'lucide-react'
import { authApi } from '@/api/auth'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await authApi.login({ email, password })
    setLoading(false)

    if (!res.success || !res.data) {
      setError(res.error ?? 'Credenciais inválidas.')
      return
    }

    localStorage.setItem('admin_token', res.data.token)
    localStorage.setItem('admin_user', JSON.stringify(res.data.user))
    navigate(ROUTES.ADMIN_DASHBOARD)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Scissors size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">{barberShopConfig.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Painel de administração</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@barbearia.pt"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                         text-white placeholder:text-gray-600 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                           text-white placeholder:text-gray-600 text-sm pr-11
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-xl px-4 py-2.5">
              {error}
            </p>
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
              <><LogIn size={18} /> Entrar</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
