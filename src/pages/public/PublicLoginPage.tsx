import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scissors, Eye, EyeOff, LogIn } from 'lucide-react'
import { api } from '@/api/client'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'

type Mode = 'login' | 'register'

export default function PublicLoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const field = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'register' && form.password !== form.confirm) {
      setError('As passwords não coincidem.')
      return
    }

    setLoading(true)
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const payload  = mode === 'login'
      ? { email: form.email, password: form.password }
      : { name: form.name, email: form.email, phone: form.phone, password: form.password }

    const res = await api.post<{ token: string }>(endpoint, payload)
    setLoading(false)

    if (!res.success || !res.data) {
      setError(res.error ?? 'Credenciais inválidas.')
      return
    }

    localStorage.setItem('user_token', res.data.token)
    navigate(ROUTES.PROFILE)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mb-4">
            <Scissors size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">{barberShopConfig.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === 'login' ? 'Bem-vindo de volta!' : 'Criar conta'}
          </p>
        </div>

        <div className="flex bg-white/5 rounded-2xl p-1 mb-6">
          {(['login', 'register'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null) }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === m ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {m === 'login' ? 'Entrar' : 'Registar'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Nome</label>
                <input type="text" required value={form.name} onChange={field('name')}
                       placeholder="O teu nome"
                       className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                                  text-white placeholder:text-gray-600 text-sm
                                  focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Telefone</label>
                <input type="tel" value={form.phone} onChange={field('phone')}
                       placeholder="9XX XXX XXX"
                       className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                                  text-white placeholder:text-gray-600 text-sm
                                  focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
            <input type="email" required value={form.email} onChange={field('email')}
                   placeholder="email@exemplo.pt"
                   className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                              text-white placeholder:text-gray-600 text-sm
                              focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} required
                     value={form.password} onChange={field('password')}
                     placeholder="••••••••"
                     className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                                text-white placeholder:text-gray-600 text-sm pr-11
                                focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirmar password</label>
              <input type="password" required value={form.confirm} onChange={field('confirm')}
                     placeholder="••••••••"
                     className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                                text-white placeholder:text-gray-600 text-sm
                                focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500
                             text-white font-semibold rounded-xl hover:bg-brand-600
                             transition-colors disabled:opacity-50">
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <><LogIn size={18} />{mode === 'login' ? 'Entrar' : 'Criar conta'}</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
