'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'

interface RevenueChartProps {
  data: Array<{ date: string; revenue: number; transactions: number }>
}

export function RevenueChart({ data }: RevenueChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`
    }
    return value.toString()
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      const revenue = payload.find(p => p.dataKey === 'revenue')?.value || 0
      const transactions = payload.find(p => p.dataKey === 'transactions')?.value || 0

      return (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-xl">
          <p className="text-sm text-slate-600 mb-2 font-medium">
            {label ? formatDate(label) : ''}
          </p>
          <p className="text-sm text-emerald-600">
            <span className="text-slate-500">Выручка: </span>
            <span className="font-medium">{revenue.toLocaleString('ru-RU')} ₽</span>
          </p>
          <p className="text-sm text-blue-600">
            <span className="text-slate-500">Транзакций: </span>
            <span className="font-medium">{transactions}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Выручка за 30 дней</h3>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500">
          Нет данных за выбранный период
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatCurrency}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
