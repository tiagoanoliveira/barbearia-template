import { X, AlertTriangle, Info, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

type Variant = 'danger' | 'warning' | 'info'

interface ConfirmDialogProps {
  open:          boolean
  onClose:       () => void
  onConfirm:     () => void
  title:         string
  description:   string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:      Variant
  loading?:      boolean
  /** Conteúdo extra abaixo da descrição (ex: campos de input) */
  extra?:        React.ReactNode
}

const variantStyles: Record<Variant, { icon: React.ReactNode; btn: string; iconBg: string }> = {
  danger: {
    icon:   <Trash2 size={18} className="text-red-500" />,
    iconBg: 'bg-red-500/10',
    btn:    'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    icon:   <AlertTriangle size={18} className="text-amber-500" />,
    iconBg: 'bg-amber-500/10',
    btn:    'bg-amber-500 hover:bg-amber-600 text-white',
  },
  info: {
    icon:   <Info size={18} className="text-blue-500" />,
    iconBg: 'bg-blue-500/10',
    btn:    'bg-blue-600 hover:bg-blue-700 text-white',
  },
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  variant      = 'info',
  loading      = false,
  extra,
}: ConfirmDialogProps) {
  const styles    = variantStyles[variant]
  const dialogRef = useRef<HTMLDivElement>(null)

  // Fechar com Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Bloquear scroll do body
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onMouseDown={handleOverlayClick}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col animate-fade-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        {/* Header: ícone topo-esquerdo · X topo-direito */}
        <div className="flex items-start justify-between px-5 pt-5 pb-0">
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${styles.iconBg}`}>
            {styles.icon}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600
                       transition-colors disabled:opacity-40"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo: título + descrição */}
        <div className="px-5 pt-3 pb-5">
          <h3
            id="confirm-title"
            className="text-sm font-semibold text-gray-900 mb-1 leading-snug"
          >
            {title}
          </h3>
          <p
            id="confirm-desc"
            className="text-sm text-gray-500 leading-relaxed"
          >
            {description}
          </p>
          {extra && <div className="mt-3">{extra}</div>}
        </div>

        {/* Footer: Cancelar à esquerda · Confirmar à direita */}
        <div className="flex items-center justify-between gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-xl bg-gray-100 text-gray-700
                       hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm rounded-xl font-semibold transition-colors
                        disabled:opacity-50 flex items-center gap-2 ${styles.btn}`}
          >
            {loading
              ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              : confirmLabel
            }
          </button>
        </div>
      </div>
    </div>
  )
}
