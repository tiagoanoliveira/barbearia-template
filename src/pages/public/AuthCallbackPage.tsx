import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Scissors } from 'lucide-react'

/**
 * Rota: /auth/callback
 * Intermediário entre o callback OAuth (server-side) e o frontend.
 * O servidor redireciona para cá com ?token=...&redirect=...
 * Esta página guarda o token no localStorage e navega para o destino.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const token    = searchParams.get('token')
    const redirect = searchParams.get('redirect') ?? '/perfil'

    if (token) {
      localStorage.setItem('user_token', token)
      navigate(redirect, { replace: true })
    } else {
      // Token ausente — algo correu mal
      navigate('/login?error=oauth_failed', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
