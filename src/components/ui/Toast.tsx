import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
}

const typeConfig = {
  success: { icon: CheckCircle, className: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  error:   { icon: XCircle,     className: 'bg-red-50 border-red-200 text-red-800' },
  warning: { icon: AlertCircle, className: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
}

export default function Toast({ message, type = 'success', duration = 3500, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true)
  const { icon: Icon, className } = typeConfig[type]

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300) }, duration)
    return () => clearTimeout(t)
  }, [duration, onClose])

  return (
    <div className={`
      flex items-center gap-3 px-4 py-3 rounded-xl border shadow-card
      transition-all duration-300 ${className}
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
    `}>
      <Icon size={18} className="flex-shrink-0" />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X size={15} />
      </button>
    </div>
  )
}
