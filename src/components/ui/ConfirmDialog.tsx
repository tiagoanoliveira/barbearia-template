import { AlertTriangle, Info, Trash2 } from 'lucide-react'
import Modal from './Modal'

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
    icon:   <Trash2 size={22} className="text-red-400" />,
    iconBg: 'bg-red-500/10',
    btn:    'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    icon:   <AlertTriangle size={22} className="text-amber-400" />,
    iconBg: 'bg-amber-500/10',
    btn:    'bg-amber-500 hover:bg-amber-600 text-white',
  },
  info: {
    icon:   <Info size={22} className="text-primary-400" />,
    iconBg: 'bg-primary-500/10',
    btn:    'bg-primary-500 hover:bg-primary-600 text-white',
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
  const styles = variantStyles[variant]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="sm"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-xl bg-white/5 text-gray-300
                       hover:bg-white/10 transition-colors disabled:opacity-50"
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
      }
    >
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${styles.iconBg}`}>
          {styles.icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
          <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        </div>
        {extra && <div className="w-full text-left">{extra}</div>}
      </div>
    </Modal>
  )
}
