"use client"

import { useState, useEffect, useCallback } from "react"
import {
  MessageSquare,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  AlertTriangle,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react"
import type { TelegramQueueStats, TelegramQueueMessage } from "@/lib/admin/types"

type StatusFilter = 'all' | 'pending' | 'sent' | 'failed' | 'retry'

/**
 * TelegramQueueView - Admin component for monitoring Telegram message queue
 */
export function TelegramQueueView() {
  const [stats, setStats] = useState<TelegramQueueStats | null>(null)
  const [messages, setMessages] = useState<TelegramQueueMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Send message modal
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendTelegramId, setSendTelegramId] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Retry state
  const [retrying, setRetrying] = useState<number | null>(null)

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50'
      })

      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const res = await fetch(`/api/admin/telegram?${params}`)
      if (!res.ok) throw new Error('Failed to fetch telegram queue')

      const data = await res.json()
      setStats(data.stats)
      setMessages(data.messages)
      setTotalPages(data.pagination.totalPages)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const handleRetry = async (messageId: number) => {
    setRetrying(messageId)
    try {
      const res = await fetch(`/api/admin/telegram/${messageId}/retry`, {
        method: 'POST'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to retry message')
      }

      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry')
    } finally {
      setRetrying(null)
    }
  }

  const handleSendMessage = async () => {
    if (!sendTelegramId || !sendMessage) return

    setSending(true)
    try {
      const res = await fetch('/api/admin/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: sendTelegramId,
          message: sendMessage
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }

      setShowSendModal(false)
      setSendTelegramId('')
      setSendMessage('')
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'retry':
        return <RotateCcw className="w-4 h-4 text-orange-500" />
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'retry':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card/50 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs">Всего</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {stats?.total.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-card/50 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">В очереди</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {stats?.pending.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-card/50 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-400 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs">Отправлено</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {stats?.sent.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-card/50 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-xs">Ошибки</span>
          </div>
          <div className="text-2xl font-bold text-red-400">
            {stats?.failed.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-card/50 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-400 mb-1">
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs">Повтор</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">
            {stats?.retry.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-card/50 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-primary mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs">Успешность</span>
          </div>
          <div className="text-2xl font-bold text-primary">
            {(stats?.success_rate || 0).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter)
              setPage(1)
            }}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Все статусы</option>
            <option value="pending">В очереди</option>
            <option value="sent">Отправлено</option>
            <option value="failed">Ошибки</option>
            <option value="retry">Повтор</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-border"
            />
            Автообновление
          </label>

          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border hover:bg-muted/50 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Обновить</span>
          </button>

          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            <span className="text-sm">Отправить</span>
          </button>
        </div>
      </div>

      {/* Messages Table */}
      <div className="bg-card/50 border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Пользователь</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Попытки</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Создано</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Отправлено</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Действия</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Нет сообщений в очереди</p>
                  </td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                      #{msg.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-mono">
                          {msg.telegram_user_id || `user:${msg.user_id}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {msg.message_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${getStatusBadgeClass(msg.status)}`}>
                        {getStatusIcon(msg.status)}
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {msg.retry_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(msg.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {msg.sent_at ? formatDate(msg.sent_at) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {msg.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(msg.id)}
                          disabled={retrying === msg.id}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-colors disabled:opacity-50"
                        >
                          {retrying === msg.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Повторить
                        </button>
                      )}
                      {msg.error_message && (
                        <span
                          className="text-xs text-red-400 cursor-help"
                          title={msg.error_message}
                        >
                          Ошибка
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Страница {page} из {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 hover:bg-muted/50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 hover:bg-muted/50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Send Message Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Отправить сообщение
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Telegram User ID
                </label>
                <input
                  type="text"
                  value={sendTelegramId}
                  onChange={(e) => setSendTelegramId(e.target.value)}
                  placeholder="123456789"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Сообщение
                </label>
                <textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder="Текст сообщения..."
                  rows={4}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!sendTelegramId || !sendMessage || sending}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
