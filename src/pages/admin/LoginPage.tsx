import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scissors, Eye, EyeOff, LogIn } from 'lucide-react'
import { authApi } from '@/api/auth'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  // Turnstile
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    function renderWidget() {
      const ts = (window as any).turnstile
      if (!ts || !turnstileRef.current || widgetIdRef.current) return

      widgetIdRef.current = ts.render(turnstileRef.current, {
        sitekey: '0x4AAAAAAC77HIBeGCioAqAq',
        callback: (token: string) => setTurnstileToken(token),
      })
    }

    const existing = document.querySelector('script[data-turnstile-script="1"]') as HTMLScriptElement | null
    if (existing) {
      if (existing.getAttribute('data-loaded') === '1') {
        renderWidget()
      } else {
        existing.addEventListener('load', renderWidget)
      }
      return () => existing.removeEventListener('load', renderWidget)
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.setAttribute('data-turnstile-script', '1')
    script.onload = () => {
      script.setAttribute('data-loaded', '1')
      renderWidget()
    }
    document.body.appendChild(script)

    return () => {
      const ts = (window as any).turnstile
      if (ts && widgetIdRef.current) {
        ts.remove(widgetIdRef.current)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!turnstileToken) {
      setError('Por favor confirme que não é um robô antes de continuar.')
      return
    }

    setLoading(true)

    const res = await authApi.login({ username, password, turnstileToken })
    setLoading(false)

    const ts = (window as any).turnstile
    if (ts && widgetIdRef.current) {
      ts.reset(widgetIdRef.current)
      setTurnstileToken(null)
    }

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

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Scissors size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">{barberShopConfig.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Painel de administração</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="admin"
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
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl
                           text-white placeholder:text-gray-600 text-sm pr-11
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                aria-label={showPw ? 'Ocultar password' : 'Mostrar password'}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div ref={turnstileRef} className="mt-2 flex justify-center" />

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
