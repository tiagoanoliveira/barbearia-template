import { type LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: number        // percentagem, positivo = sobe, negativo = desce
  trendLabel?: string
  iconColor?: string    // classe tailwind de bg, ex: 'bg-brand-500'
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  iconColor = 'bg-brand-500',
}: StatCardProps) {
  const hasTrend = trend !== undefined
  const isUp = (trend ?? 0) > 0
  const isDown = (trend ?? 0) < 0

  return (
    <div className="card p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 leading-none mb-2">
          {value}
        </p>
        {hasTrend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            isUp ? 'text-emerald-600' : isDown ? 'text-red-500' : 'text-gray-500'
          }`}>
            {isUp   ? <TrendingUp  size={13} /> :
             isDown ? <TrendingDown size={13} /> :
                      <Minus size={13} />}
            <span>
              {isUp ? '+' : ''}{trend?.toFixed(1)}%
              {trendLabel && <span className="text-gray-400 font-normal"> {trendLabel}</span>}
            </span>
          </div>
        )}
      </div>
      <div className={`flex-shrink-0 w-11 h-11 ${iconColor} rounded-2xl flex items-center justify-center`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  )
}
