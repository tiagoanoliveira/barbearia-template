import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookies_accepted')) {
      setVisible(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('cookies_accepted', '1')
    setVisible(false)
  }

  const reject = () => {
    localStorage.setItem('cookies_accepted', '0')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto bg-gray-900 border border-white/10 rounded-2xl
                      shadow-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-gray-300 flex-1">
          Usamos cookies para melhorar a tua experiência.{' '}
          <Link to="/cookies" className="text-brand-400 hover:underline">Saber mais</Link>
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={reject}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors">
            Recusar
          </button>
          <button onClick={accept}
                  className="px-5 py-2 bg-brand-500 text-white text-sm font-semibold
                             rounded-xl hover:bg-brand-600 transition-colors">
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}
