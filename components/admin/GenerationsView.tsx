'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Image,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  RotateCcw,
  Zap,
  Timer,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import type { AdminGenerationJob, GenerationStats, GenerationStatus } from '@/lib/admin/types'
import { DateFilter, type DateFilterPreset, getDateRangeFromPreset } from './DateFilter'
import { GenerationDetailsModal } from './GenerationDetailsModal'

/**
 * GenerationsView Component
 *
 * Displays generation jobs with real-time progress monitoring
 */

interface Filters {
  status: string
  dateFrom: string
  dateTo: string
  page: number
}

export function GenerationsView() {
  const [jobs, setJobs] = useState<AdminGenerationJob[]>([])
  const [stats, setStats] = useState<GenerationStats | null>(null)
  const [filters, setFilters] = useState<Filters>({
    status: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
  })
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Date filter state
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all')
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null })

  // Details modal
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Retry state
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null)

  // Auto-refresh for active jobs
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchJobs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      params.set('page', String(filters.page))
      params.set('limit', '20')

      const response = await fetch(`/api/admin/generations?${params}`)
      if (!response.ok) throw new Error('Failed to fetch generations')

      const data = await response.json()
      setJobs(data.jobs || [])
      setStats(data.stats || null)
      setPagination({
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
        page: data.pagination?.page || 1,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Auto-refresh every 10 seconds if there are processing jobs
  useEffect(() => {
    if (!autoRefresh || !stats?.processing_jobs) return

    const interval = setInterval(fetchJobs, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, stats?.processing_jobs, fetchJobs])

  const handleDateFilterChange = (preset: DateFilterPreset, range?: { from: Date | null; to: Date | null }) => {
    setDatePreset(preset)
    if (range) {
      setCustomDateRange(range)
    }

    const dateRange = range || getDateRangeFromPreset(preset)
    setFilters(prev => ({
      ...prev,
      dateFrom: dateRange.from?.toISOString().split('T')[0] || '',
      dateTo: dateRange.to?.toISOString().split('T')[0] || '',
      page: 1
    }))
  }

  const handleRetry = async (jobId: number) => {
    setRetryingJobId(jobId)
    try {
      const response = await fetch(`/api/admin/generations/${jobId}/retry`, {
        method: 'POST'
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Retry failed')
      }
      fetchJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed')
    } finally {
      setRetryingJobId(null)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—'
    if (seconds < 60) return `${seconds}с`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}м ${secs}с`
  }

  const getStatusBadge = (status: GenerationStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Завершено
          </span>
        )
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            В процессе
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            <Clock className="w-3 h-3" />
            В очереди
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Ошибка
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Отменено
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-600 text-xs mb-1">
              <BarChart3 className="w-4 h-4" />
              Всего
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats.total_jobs.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 text-xs mb-1">
              <CheckCircle className="w-4 h-4" />
              Завершено
            </div>
            <p className="text-2xl font-bold text-emerald-600">{stats.completed_jobs.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
              <Loader2 className="w-4 h-4" />
              В процессе
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.processing_jobs}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-red-600 text-xs mb-1">
              <XCircle className="w-4 h-4" />
              Ошибки
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.failed_jobs}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-600 text-xs mb-1">
              <TrendingUp className="w-4 h-4" />
              Успешность
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats.success_rate}%</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-600 text-xs mb-1">
              <Timer className="w-4 h-4" />
              Среднее время
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatDuration(stats.avg_completion_time)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
          >
            <option value="">Все статусы</option>
            <option value="completed">Завершено</option>
            <option value="processing">В процессе</option>
            <option value="pending">В очереди</option>
            <option value="failed">Ошибка</option>
            <option value="cancelled">Отменено</option>
          </select>
        </div>

        <DateFilter
          value={datePreset}
          customRange={customDateRange}
          onChange={handleDateFilterChange}
        />

        <div className="flex-1" />

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-slate-300 bg-white text-pink-500 focus:ring-pink-500"
          />
          Авто-обновление
        </label>

        <button
          onClick={fetchJobs}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Аватар</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Стиль</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Прогресс</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Время</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Загрузка...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Генерации не найдены
                  </td>
                </tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-700 font-mono">
                      #{job.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <Image className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-900">{job.avatar_name || `#${job.avatar_id}`}</p>
                          <p className="text-xs text-slate-500">User: {job.telegram_user_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {job.style_id || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              job.status === 'completed' ? 'bg-emerald-500' :
                              job.status === 'failed' ? 'bg-red-500' :
                              'bg-blue-500'
                            }`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600">
                          {job.completed_photos}/{job.total_photos}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDuration(job.duration)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedJobId(job.id)
                            setIsDetailsOpen(true)
                          }}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                          title="Подробности"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(job.status === 'failed' || job.status === 'cancelled') && (
                          <button
                            onClick={() => handleRetry(job.id)}
                            disabled={retryingJobId === job.id}
                            className="p-2 hover:bg-amber-50 rounded-lg text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-50"
                            title="Повторить"
                          >
                            {retryingJobId === job.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {job.status === 'processing' && (
                          <span title="Генерация идёт">
                            <Zap className="w-4 h-4 text-blue-500 animate-pulse" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-600">
              Показано {(pagination.page - 1) * 20 + 1} - {Math.min(pagination.page * 20, pagination.total)} из {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <GenerationDetailsModal
        jobId={selectedJobId}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false)
          setSelectedJobId(null)
        }}
        onRetry={() => {
          if (selectedJobId) handleRetry(selectedJobId)
        }}
      />
    </div>
  )
}
