"use client"

import { Sparkles } from "lucide-react"

interface PartnerQuotaIndicatorProps {
  limit: number
  used: number
  className?: string
}

/**
 * PartnerQuotaIndicator Component
 *
 * Shows partner's test generation quota usage
 * Displays: "X/200 генераций использовано"
 */
export function PartnerQuotaIndicator({
  limit,
  used,
  className = "",
}: PartnerQuotaIndicatorProps) {
  const remaining = limit - used
  const percentage = Math.min(100, (used / limit) * 100)

  // Color based on remaining percentage
  const getColor = () => {
    if (remaining <= 10) return "text-red-600"
    if (remaining <= 50) return "text-amber-600"
    return "text-green-600"
  }

  const getBarColor = () => {
    if (remaining <= 10) return "bg-red-500"
    if (remaining <= 50) return "bg-amber-500"
    return "bg-green-500"
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-slate-700">Квота генераций</span>
        </div>
        <span className={`text-sm font-semibold ${getColor()}`}>
          {remaining} осталось
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="text-xs text-slate-500 mt-2">
        Использовано {used} из {limit} тестовых генераций
      </p>
    </div>
  )
}
