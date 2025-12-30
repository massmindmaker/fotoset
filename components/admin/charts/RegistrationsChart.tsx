'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface RegistrationsChartProps {
  data: Array<{ date: string; registrations: number }>
}

export function RegistrationsChart({ data }: RegistrationsChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-xl">
          <p className="text-sm text-slate-600 mb-2 font-medium">
            {label ? formatDate(label) : ''}
          </p>
          <p className="text-sm text-blue-600">
            <span className="text-slate-500">Регистраций: </span>
            <span className="font-medium">{payload[0].value}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Регистрации за 30 дней</h3>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500">
          Нет данных за выбранный период
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRegistrations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
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
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="registrations"
                stroke="#3B82F6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRegistrations)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
