import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, LogIn, AlertTriangle } from 'lucide-react'
import { api } from '@/api/client'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
        sitekey: barberShopConfig.turnstileSiteKey,
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

  // Estado para modal de telefone duplicado (com email real)
  const [phoneExistModal, setPhoneExistModal] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [pendingPhone, setPendingPhone] = useState('')

  // Estado para aviso de telefone sem email (criado pelo admin)
  const [phoneNoEmailWarning, setPhoneNoEmailWarning] = useState<{ phone: string; supportUrl: string } | null>(null)

  const field = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setPhoneNoEmailWarning(null)

    if (!turnstileToken) {
      setError('Por favor confirme que não é um robô antes de continuar.')
      return
    }

    if (mode === 'register') {
      if (form.password !== form.confirm) {
        setError('As passwords não coincidem.')
        return
      }
      const cleaned = form.phone.replace(/\s/g, '')
      if (!cleaned || cleaned.length < 9) {
        setError('Insere um número de telemóvel válido (mínimo 9 dígitos).')
        return
      }
    }

    setLoading(true)
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const payload  = mode === 'login'
      ? { identifier: form.email || form.phone, password: form.password, turnstileToken }
      : { name: form.name, email: form.email, phone: form.phone, password: form.password, turnstileToken }

    const res = await api.post<{ token: string; message?: string; email_pending_verification?: boolean }>(endpoint, payload)
    setLoading(false)

    const ts = (window as any).turnstile
    if (ts && widgetIdRef.current) {
      ts.reset(widgetIdRef.current)
      setTurnstileToken(null)
    }

    if (!res.success || !res.data) {
      try {
        const parsed = JSON.parse(res.error ?? '')

        if (parsed?.code === 'PHONE_EXISTS_NO_EMAIL') {
          setPhoneNoEmailWarning({
            phone:      form.phone,
            supportUrl: parsed.support_url ?? '/suporte',
          })
          return
        }

        if (parsed?.code === 'PHONE_EXISTS') {
          setPendingEmail(form.email)
          setPendingPhone(form.phone)
          setPhoneExistModal(true)
          return
        }
      } catch {
        // não é JSON estruturado
      }

      if (res.error === 'Email já registado') {
        setError('Esta conta já foi criada. Verifique o email de confirmação que recebeu.')
      } else {
        setError(res.error ?? 'Credenciais inválidas.')
      }
      return
    }

    if (mode === 'login') {
      localStorage.setItem('user_token', res.data.token)
      window.dispatchEvent(new Event('authchange'))
      navigate(redirectTo)
      return
    }

    setSuccessMsg(res.data.message ?? 'Conta criada! Verifique o seu email para confirmar o registo.')
    setMode('login')
    setForm({ name: '', email: form.email, phone: form.phone, password: '', confirm: '' })
  }

  const handlePhoneExistConfirm = async () => {
    setLoading(true)
    const res = await api.post('/api/auth/request-email-change-by-phone', {
      phone:    pendingPhone,
      newEmail: pendingEmail,
    })
    setLoading(false)
    setPhoneExistModal(false)
    if (res.success) {
      setSuccessMsg('Foi enviado um email de confirmação para a conta existente. Verifique a sua caixa de entrada.')
    } else {
      setError(res.error ?? 'Erro ao processar pedido.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-sm">
        <div className="flex bg-white/5 rounded-2xl p-1 mb-6">
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(null); setSuccessMsg(null); setPhoneNoEmailWarning(null) }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      mode === m ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
                    }`}>
              {m === 'login' ? 'Entrar' : 'Registar'}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
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
            Google
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
            Facebook
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
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Telemóvel
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={field('phone')}
                  placeholder="9XX XXX XXX"
                  pattern="[0-9 +]{9,15}"
                  inputMode="numeric"
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-400">Password</label>
              {mode === 'login' && (
                <Link to="/esqueci-password" className="text-xs text-brand-400 hover:underline">
                  Esqueceste a password?
                </Link>
              )}
            </div>
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

          <div ref={turnstileRef} className="mt-2 flex justify-center" />

          {error && (
            <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {phoneNoEmailWarning && (
            <div className="flex gap-3 bg-amber-950/60 border border-amber-700/60 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-300 space-y-1">
                <p className="font-medium">Conta sem email associado</p>
                <p className="text-amber-400/80">
                  Já existe uma conta com o número <strong className="text-amber-300">{phoneNoEmailWarning.phone}</strong>, mas
                  sem email configurado. Para associar o seu email a esta conta, contacte o nosso suporte.
                </p>
                <Link
                  to={phoneNoEmailWarning.supportUrl}
                  className="inline-block mt-1 text-amber-300 underline underline-offset-2 hover:text-amber-200 font-medium"
                >
                  Ir para o suporte →
                </Link>
              </div>
            </div>
          )}

          {successMsg && (
            <p className="text-sm text-green-400 bg-green-950/50 border border-green-800/50 rounded-xl px-4 py-2.5">
              {successMsg}
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

      <ConfirmDialog
        open={phoneExistModal}
        onClose={() => setPhoneExistModal(false)}
        onConfirm={handlePhoneExistConfirm}
        title="Conta já existente"
        description={`Já existe uma conta associada ao número ${pendingPhone}. Pretende atualizar o email dessa conta para ${pendingEmail}? Será enviado um email de confirmação para o endereço atual da conta.`}
        confirmLabel="Sim, atualizar email"
        cancelLabel="Não, voltar"
        variant="warning"
        loading={loading}
      />
    </div>
  )
}
