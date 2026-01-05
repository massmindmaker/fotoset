"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Loader2, ChevronLeft, ChevronRight, DollarSign, TrendingUp, Eye, Send, MessageCircle } from "lucide-react"
import type { AdminPayment, PaymentStats } from "@/lib/admin/types"
import { DateFilter, type DateFilterPreset, getDateRangeFromPreset } from "./DateFilter"
import { ExportButton, type ExportFormat } from "./ExportButton"
import { PaymentDetailsModal } from "./PaymentDetailsModal"
import { exportData, formatPaymentForExport } from "@/lib/admin/export"

/**
 * PaymentsView Component
 *
 * Displays payments table with filters, stats, and refund functionality
 *
 * Features:
 * - Payment list with pagination
 * - Stats cards (revenue, avg order, conversion)
 * - Filters (status, date range, tier)
 * - Refund modal (simplified version)
 */

interface Filters {
  status: string
  dateFrom: string
  dateTo: string
  tierId: string
  provider: string
  page: number
}

// Provider badge component
function ProviderBadge({ provider }: { provider: string }) {
  const config: Record<string, { label: string; icon: string; className: string }> = {
    tbank: { label: 'T-Bank', icon: '🏦', className: 'bg-red-100 text-red-700' },
    stars: { label: 'Stars', icon: '⭐', className: 'bg-blue-100 text-blue-700' },
    ton: { label: 'TON', icon: '💎', className: 'bg-amber-100 text-amber-700' },
  }
  const { label, icon, className } = config[provider] || config.tbank
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {icon} {label}
    </span>
  )
}

export function PaymentsView() {
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [filters, setFilters] = useState<Filters>({
    status: '',
    dateFrom: '',
    dateTo: '',
    tierId: '',
    provider: '',
    page: 1,
  })
  const [providerStats, setProviderStats] = useState<Array<{
    provider: string
    total_count: number
    success_count: number
    revenue_rub: number
    total_stars: number
    total_ton: number
  }>>([])

  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selected payment for refund
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [isRefunding, setIsRefunding] = useState(false)

  // Date filter and details modal
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all')
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null })
  const [detailsPaymentId, setDetailsPaymentId] = useState<number | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: '20',
      })

      if (filters.status) params.append('status', filters.status)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)
      if (filters.tierId) params.append('tierId', filters.tierId)
      if (filters.provider) params.append('provider', filters.provider)

      const response = await fetch(`/api/admin/payments?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.userMessage || 'Ошибка загрузки платежей')
      }

      setPayments(data.data.payments)
      setPagination(data.data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/payments/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.data.stats)
        if (data.data.providerStats) {
          setProviderStats(data.data.providerStats)
        }
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Handle date filter change
  const handleDateFilterChange = (preset: DateFilterPreset, range?: { from: Date | null; to: Date | null }) => {
    setDatePreset(preset)
    if (preset === 'custom' && range) {
      setCustomDateRange(range)
      setFilters(f => ({
        ...f,
        dateFrom: range.from?.toISOString().split('T')[0] || '',
        dateTo: range.to?.toISOString().split('T')[0] || '',
        page: 1
      }))
    } else {
      const dateRange = getDateRangeFromPreset(preset)
      setFilters(f => ({
        ...f,
        dateFrom: dateRange.from?.toISOString().split('T')[0] || '',
        dateTo: dateRange.to?.toISOString().split('T')[0] || '',
        page: 1
      }))
    }
  }

  // Handle export
  const handleExport = async (format: ExportFormat) => {
    const exportPayments = payments.map(p => formatPaymentForExport({
      id: p.id,
      tbank_payment_id: p.tbank_payment_id || '',
      user_id: p.user_id,
      telegram_user_id: String(p.telegram_user_id || ''),
      amount: p.amount,
      tier_id: p.tier_id || 'unknown',
      photo_count: p.photo_count || 0,
      status: p.status,
      created_at: p.created_at
    }))

    await exportData(exportPayments, format, { filename: `payments-${datePreset}` })
  }

  // Handle refund
  const handleRefund = async () => {
    if (!selectedPayment || !refundReason.trim()) return

    setIsRefunding(true)
    try {
      const response = await fetch('/api/admin/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          reason: refundReason,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.userMessage || 'Ошибка создания возврата')
      }

      // Refresh data
      setSelectedPayment(null)
      setRefundReason('')
      fetchPayments()
      fetchStats()

      alert('Возврат успешно создан')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка возврата')
    } finally {
      setIsRefunding(false)
    }
  }

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      succeeded: "bg-green-500/20 text-green-500 border-green-500/30",
      pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
      canceled: "bg-gray-500/20 text-gray-500 border-gray-500/30",
      refunded: "bg-destructive/20 text-destructive border-destructive/30",
    }

    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              <span>Общая выручка</span>
            </div>
            <div className="text-2xl font-bold">{stats.total_revenue}₽</div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Чистая выручка</span>
            </div>
            <div className="text-2xl font-bold">{stats.net_revenue}₽</div>
            <div className="text-xs text-muted-foreground mt-1">После возвратов</div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <span>Средний чек</span>
            </div>
            <div className="text-2xl font-bold">{stats.avg_order_value.toFixed(0)}₽</div>
          </div>
        </div>
      )}

      {/* Provider Stats */}
      {providerStats.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {providerStats.map((ps) => (
            <div key={ps.provider} className="bg-white rounded-xl p-4 border border-slate-200">
              <ProviderBadge provider={ps.provider} />
              <div className="mt-2">
                <div className="text-xl font-bold">{ps.revenue_rub.toLocaleString('ru-RU')}₽</div>
                <div className="text-xs text-muted-foreground">
                  {ps.success_count} платежей
                  {ps.total_stars > 0 && ` · ${ps.total_stars}⭐`}
                  {ps.total_ton > 0 && ` · ${ps.total_ton.toFixed(2)} TON`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={filters.status}
          onChange={(e) => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm"
        >
          <option value="">Все статусы</option>
          <option value="succeeded">Успешно</option>
          <option value="pending">В обработке</option>
          <option value="refunded">Возвращено</option>
        </select>

        <select
          value={filters.tierId}
          onChange={(e) => setFilters(f => ({ ...f, tierId: e.target.value, page: 1 }))}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm"
        >
          <option value="">Все тарифы</option>
          <option value="starter">Starter (7 фото)</option>
          <option value="standard">Standard (15 фото)</option>
          <option value="premium">Premium (23 фото)</option>
        </select>

        <select
          value={filters.provider}
          onChange={(e) => setFilters(f => ({ ...f, provider: e.target.value, page: 1 }))}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
        >
          <option value="">Все провайдеры</option>
          <option value="tbank">T-Bank</option>
          <option value="stars">Stars</option>
          <option value="ton">TON</option>
        </select>

        <DateFilter
          value={datePreset}
          customRange={customDateRange}
          onChange={handleDateFilterChange}
        />

        <div className="flex-1" />

        <ExportButton
          onExport={handleExport}
          disabled={payments.length === 0}
        />

        <button
          onClick={() => fetchPayments()}
          className="px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-sm font-medium text-muted-foreground">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Пользователь</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Тариф</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Провайдер</th>
                  <th className="px-4 py-3">TG фото</th>
                  <th className="px-4 py-3">Возврат</th>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      Платежи не найдены
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-mono">{payment.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          {payment.telegram_username ? (
                            <span className="text-sm font-medium text-foreground">@{payment.telegram_username}</span>
                          ) : null}
                          <span className="text-xs text-muted-foreground font-mono">{payment.telegram_user_id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {payment.amount}₽
                        {payment.original_amount && payment.original_currency && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({payment.original_currency === 'XTR' ? `${payment.original_amount}⭐` : `${payment.original_amount} TON`})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{payment.tier_id || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={payment.status} />
                      </td>
                      <td className="px-4 py-3">
                        <ProviderBadge provider={payment.provider || 'tbank'} />
                      </td>
                      <td className="px-4 py-3">
                        {payment.status === 'succeeded' ? (
                          <div className="flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-sm">
                              {payment.tg_sent_count || 0}/{payment.gen_photos_count || payment.photo_count || 0}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {payment.refund_amount ? `${payment.refund_amount}₽` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(payment.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setDetailsPaymentId(payment.id)
                              setIsDetailsOpen(true)
                            }}
                            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                            title="Детали"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {payment.status === 'succeeded' &&
                           (payment.refund_amount || 0) < payment.amount && (
                            <button
                              onClick={() => setSelectedPayment(payment)}
                              className="text-sm text-primary hover:underline"
                            >
                              💸 Возврат
                            </button>
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
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Страница {pagination.page} из {pagination.totalPages} • Всего: {pagination.total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                  disabled={filters.page === 1}
                  className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.min(pagination.totalPages, f.page + 1) }))}
                  disabled={filters.page === pagination.totalPages}
                  className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Refund Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Создать возврат</h3>

            <div className="space-y-3 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Платёж:</span>
                <span className="font-mono">#{selectedPayment.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма:</span>
                <span className="font-medium">{selectedPayment.amount}₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Уже возвращено:</span>
                <span>{selectedPayment.refund_amount || 0}₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Доступно для возврата:</span>
                <span className="font-medium text-primary">
                  {selectedPayment.amount - (selectedPayment.refund_amount || 0)}₽
                </span>
              </div>
            </div>

            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Причина возврата (обязательно)"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm resize-none"
              rows={3}
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleRefund}
                disabled={!refundReason.trim() || isRefunding}
                className="flex-1 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 text-sm font-medium"
              >
                {isRefunding ? 'Создание...' : 'Создать возврат'}
              </button>
              <button
                onClick={() => { setSelectedPayment(null); setRefundReason('') }}
                disabled={isRefunding}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        paymentId={detailsPaymentId}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false)
          setDetailsPaymentId(null)
        }}
        onRefund={() => {
          fetchPayments()
          fetchStats()
        }}
      />
    </div>
  )
}
