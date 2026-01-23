'use client'

import { useMemo } from 'react'
import type { MonthlyEarning } from '@/lib/partner-types'

interface EarningsChartProps {
  data: MonthlyEarning[]
}

export function EarningsChart({ data }: EarningsChartProps) {
  // Fill missing months and sort ascending
  const chartData = useMemo(() => {
    const now = new Date()
    const months: MonthlyEarning[] = []

    // Create last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = date.toISOString().slice(0, 7)
      const existing = data.find(d => d.month === monthKey)

      months.push({
        month: monthKey,
        rub: existing?.rub || 0,
        ton: existing?.ton || 0,
        count: existing?.count || 0
      })
    }

    return months
  }, [data])

  const maxValue = useMemo(() => {
    return Math.max(...chartData.map(d => d.rub), 1)
  }, [chartData])

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return date.toLocaleDateString('ru-RU', { month: 'short' })
  }

  return (
    <div className="bg-card border rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Monthly Earnings (RUB)
      </h3>

      <div className="flex items-end gap-1 h-32">
        {chartData.map((item) => {
          const height = (item.rub / maxValue) * 100
          return (
            <div
              key={item.month}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              <div className="w-full relative">
                <div
                  className="w-full bg-primary/20 rounded-t transition-all group-hover:bg-primary/30"
                  style={{ height: `${Math.max(height, 2)}%`, minHeight: '2px' }}
                />
                {item.rub > 0 && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-popover px-1 rounded shadow">
                    {item.rub.toLocaleString('ru-RU')} RUB
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatMonth(item.month)}
              </span>
            </div>
          )
        })}
      </div>

      {chartData.every(d => d.rub === 0) && (
        <div className="text-center text-sm text-muted-foreground mt-4">
          No earnings data yet
        </div>
      )}
    </div>
  )
}
