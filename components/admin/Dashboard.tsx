'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  CreditCard,
  TrendingUp,
  Zap,
  Clock,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Activity
} from 'lucide-react'
import { KPICard } from './KPICard'
import { RevenueChart } from './charts/RevenueChart'
import { TiersChart } from './charts/TiersChart'
import { RegistrationsChart } from './charts/RegistrationsChart'
import { RecentActivity } from './RecentActivity'

interface DashboardStats {
  kpi: {
    totalUsers: number
    proUsers: number
    revenueMtd: number
    revenueToday: number
    conversionRate: number
    avgCheck: number
    totalGenerations: number
    pendingGenerations: number
  }
  charts: {
    revenueByDay: Array<{ date: string; revenue: number; transactions: number }>
    registrationsByDay: Array<{ date: string; registrations: number }>
    tierDistribution: Record<string, { count: number; revenue: number }>
  }
  recent: {
    payments: Array<{
      id: number
      amount: number
      tier: string
      status: string
      createdAt: string
      telegramUserId: string
    }>
    users: Array<{
      id: number
      telegramUserId: string
      createdAt: string
    }>
    generations: Array<{
      id: number
      status: string
      tier: string
      totalPhotos: number
      completedPhotos: number
      createdAt: string
      telegramUserId: string
    }>
  }
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }

      const data = await response.json()
      setStats(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        {/* KPI Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse border border-slate-200">
              <div className="h-4 bg-slate-200 rounded w-24 mb-4"></div>
              <div className="h-8 bg-slate-200 rounded w-32"></div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 h-80 animate-pulse border border-slate-200">
            <div className="h-4 bg-slate-200 rounded w-32 mb-4"></div>
            <div className="h-full bg-slate-100 rounded"></div>
          </div>
          <div className="bg-white rounded-xl p-6 h-80 animate-pulse border border-slate-200">
            <div className="h-4 bg-slate-200 rounded w-32 mb-4"></div>
            <div className="h-full bg-slate-100 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-red-700 font-medium transition-colors border border-red-300"
        >
          Повторить
        </button>
      </div>
    )
  }

  if (!stats) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          {lastUpdated && (
            <p className="text-sm text-slate-500">
              Обновлено: {lastUpdated.toLocaleTimeString('ru-RU')}
            </p>
          )}
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium transition-colors disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Пользователи"
          value={stats.kpi.totalUsers.toLocaleString('ru-RU')}
          subtitle={`${stats.kpi.proUsers} Pro`}
          icon={<Users className="w-5 h-5" />}
          trend={stats.kpi.conversionRate}
          trendLabel="конверсия"
        />
        <KPICard
          title="Выручка MTD"
          value={formatCurrency(stats.kpi.revenueMtd)}
          subtitle={`Сегодня: ${formatCurrency(stats.kpi.revenueToday)}`}
          icon={<CreditCard className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          title="Средний чек"
          value={formatCurrency(stats.kpi.avgCheck)}
          subtitle={`${stats.kpi.conversionRate}% конверсия`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
        />
        <KPICard
          title="Генерации"
          value={stats.kpi.totalGenerations.toLocaleString('ru-RU')}
          subtitle={stats.kpi.pendingGenerations > 0 ? `${stats.kpi.pendingGenerations} в очереди` : 'Нет в очереди'}
          icon={<Zap className="w-5 h-5" />}
          color={stats.kpi.pendingGenerations > 0 ? 'yellow' : 'purple'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={stats.charts.revenueByDay} />
        <TiersChart data={stats.charts.tierDistribution} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RegistrationsChart data={stats.charts.registrationsByDay} />
        <RecentActivity
          payments={stats.recent.payments}
          users={stats.recent.users}
          generations={stats.recent.generations}
        />
      </div>
    </div>
  )
}
