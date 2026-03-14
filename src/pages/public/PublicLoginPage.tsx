import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Scissors, Eye, EyeOff, LogIn } from 'lucide-react'
import { api } from '@/api/client'
import { barberShopConfig } from '@/config/theme'

type Mode = 'login' | 'register'

export default function PublicLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/perfil'

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
    // Permite login por email ou telefone
    const payload  = mode === 'login'
      ? { identifier: form.email || form.phone, password: form.password }
      : { name: form.name, email: form.email, phone: form.phone, password: form.password }

    const res = await api.post<{ token: string }>(endpoint, payload)
    setLoading(false)

    if (!res.success || !res.data) {
      setError(res.error ?? 'Credenciais inválidas.')
      return
    }

    localStorage.setItem('user_token', res.data.token)
    navigate(redirectTo)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <p className="text-gray-500 text-sm mt-1">
            {mode === 'login' ? 'Bem-vindo de volta!' : 'Criar conta'}
          </p>
        </div>

        {/* Toggle login/register */}
        <div className="flex bg-white/5 rounded-2xl p-1 mb-6">
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(null) }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      mode === m ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
                    }`}>
              {m === 'login' ? 'Entrar' : 'Registar'}
            </button>
          ))}
        </div>

        {/* Social login */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white/5 border
                       border-white/10 rounded-xl text-white text-sm font-medium
                       hover:bg-white/10 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </button>
          <button
            onClick={() => window.location.href = `/api/auth/facebook?redirect=${encodeURIComponent(redirectTo)}`}
            className="w-full flex items-center justify-center gap-3 py-3 bg-[#1877F2]/10 border
                       border-[#1877F2]/30 rounded-xl text-white text-sm font-medium
                       hover:bg-[#1877F2]/20 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Continuar com Facebook
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-gray-600">ou com email</span>
          <div className="flex-1 h-px bg-white/10" />
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
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              {mode === 'login' ? 'Email ou telefone' : 'Email'}
            </label>
            <input type={mode === 'login' ? 'text' : 'email'}
                   required value={form.email} onChange={field('email')}
                   placeholder={mode === 'login' ? 'email@exemplo.pt ou 9XX XXX XXX' : 'email@exemplo.pt'}
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

          {mode === 'login' && (
            <p className="text-center text-xs text-gray-600">
              Admin?{' '}
              <Link to="/admin/login" className="text-brand-400 hover:underline">Acesso de administrador</Link>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
