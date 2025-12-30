'use client'

import { ArrowUp, ArrowDown } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  icon?: React.ReactNode
  trend?: number
  trendLabel?: string
  color?: 'default' | 'green' | 'blue' | 'yellow' | 'purple' | 'red'
}

const colorClasses = {
  default: {
    bg: 'bg-white border-slate-200',
    icon: 'bg-slate-100 text-slate-600',
    trend: 'text-slate-600'
  },
  green: {
    bg: 'bg-white border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-600',
    trend: 'text-emerald-600'
  },
  blue: {
    bg: 'bg-white border-blue-200',
    icon: 'bg-blue-100 text-blue-600',
    trend: 'text-blue-600'
  },
  yellow: {
    bg: 'bg-white border-amber-200',
    icon: 'bg-amber-100 text-amber-600',
    trend: 'text-amber-600'
  },
  purple: {
    bg: 'bg-white border-purple-200',
    icon: 'bg-purple-100 text-purple-600',
    trend: 'text-purple-600'
  },
  red: {
    bg: 'bg-white border-red-200',
    icon: 'bg-red-100 text-red-600',
    trend: 'text-red-600'
  }
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  color = 'default'
}: KPICardProps) {
  const classes = colorClasses[color]

  return (
    <div className={`${classes.bg} rounded-xl p-6 border shadow-sm`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-600">{title}</h3>
        {icon && (
          <div className={`p-2 rounded-lg ${classes.icon}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold text-slate-800">{value}</p>

        {(subtitle || trend !== undefined) && (
          <div className="flex items-center gap-2">
            {trend !== undefined && (
              <div className={`flex items-center gap-1 text-sm font-medium ${classes.trend}`}>
                {trend >= 0 ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
                <span>{Math.abs(trend)}%</span>
                {trendLabel && <span className="text-slate-500">{trendLabel}</span>}
              </div>
            )}
            {subtitle && !trend && (
              <p className="text-sm text-slate-600">{subtitle}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
