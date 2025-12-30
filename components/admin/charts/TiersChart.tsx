'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts'

interface TiersChartProps {
  data: Record<string, { count: number; revenue: number }>
}

const TIER_LABELS: Record<string, string> = {
  starter: 'Starter',
  standard: 'Standard',
  premium: 'Premium',
  unknown: 'Неизвестно'
}

const TIER_COLORS: Record<string, string> = {
  starter: '#3B82F6',
  standard: '#8B5CF6',
  premium: '#EC4899',
  unknown: '#6B7280'
}

export function TiersChart({ data }: TiersChartProps) {
  const chartData = Object.entries(data).map(([tier, stats]) => ({
    name: TIER_LABELS[tier] || tier,
    value: stats.count,
    revenue: stats.revenue,
    tier
  }))

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; revenue: number } }> }) => {
    if (active && payload && payload.length) {
      const { name, value, revenue } = payload[0].payload
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0

      return (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-xl">
          <p className="text-sm font-medium text-slate-800 mb-1">{name}</p>
          <p className="text-sm text-slate-600">
            <span className="text-slate-500">Платежей: </span>
            <span className="font-medium">{value} ({percentage}%)</span>
          </p>
          <p className="text-sm text-emerald-600">
            <span className="text-slate-500">Выручка: </span>
            <span className="font-medium">{revenue.toLocaleString('ru-RU')} ₽</span>
          </p>
        </div>
      )
    }
    return null
  }

  const renderCustomLabel = (props: {
    cx?: number
    cy?: number
    midAngle?: number
    innerRadius?: number
    outerRadius?: number
    percent?: number
  }) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props

    if (percent < 0.05) return null

    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Распределение по тарифам</h3>

      {chartData.length === 0 || total === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500">
          Нет данных о платежах
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={80}
                innerRadius={40}
                dataKey="value"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.tier}
                    fill={TIER_COLORS[entry.tier] || TIER_COLORS.unknown}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span className="text-slate-700 text-sm font-medium">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
