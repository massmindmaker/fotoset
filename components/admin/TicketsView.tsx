'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  User,
  Send,
  ArrowUpRight,
  Users,
  Timer,
  AlertCircle,
  X,
  ChevronDown,
  Bot,
  Settings
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

type TicketCategory = 'payment' | 'generation' | 'technical' | 'account' | 'feedback' | 'general'
type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4'
type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'
type MessageSender = 'user' | 'operator' | 'ai' | 'system'

interface Ticket {
  id: number
  ticket_number: string
  user_id: number
  telegram_user_id: number
  telegram_username: string | null
  user_name: string | null
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  subject: string
  assigned_to: string | null
  assigned_to_name: string | null
  sla_deadline: string | null
  created_at: string
  updated_at: string
  last_message_at: string | null
  messages_count: number
}

interface TicketMessage {
  id: number
  ticket_id: number
  sender_type: MessageSender
  sender_name: string | null
  message: string // API returns 'message' field
  created_at: string
  attachments?: { type: string; url: string; filename?: string }[]
}

interface TicketStats {
  total: number
  open: number
  in_progress: number
  waiting_user: number
  resolved: number
  closed: number
  sla_breached: number
  avg_response_time: number // in minutes
}

interface Filters {
  status: string
  priority: string
  category: string
  search: string
  assignedToMe: boolean
  page: number
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG: Record<TicketCategory, { label: string; color: string; bgColor: string }> = {
  payment: { label: 'Оплата', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  generation: { label: 'Генерация', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  technical: { label: 'Технический', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  account: { label: 'Аккаунт', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  feedback: { label: 'Отзыв', color: 'text-pink-700', bgColor: 'bg-pink-100' },
  general: { label: 'Общее', color: 'text-slate-700', bgColor: 'bg-slate-100' }
}

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; bgColor: string; borderColor: string }> = {
  P1: { label: 'P1', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
  P2: { label: 'P2', color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
  P3: { label: 'P3', color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-300' },
  P4: { label: 'P4', color: 'text-green-700', bgColor: 'bg-green-100', borderColor: 'border-green-300' }
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  open: { label: 'Открыт', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: <MessageSquare className="w-3 h-3" /> },
  in_progress: { label: 'В работе', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: <Clock className="w-3 h-3" /> },
  waiting_user: { label: 'Ожидание', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: <User className="w-3 h-3" /> },
  resolved: { label: 'Решен', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: <CheckCircle className="w-3 h-3" /> },
  closed: { label: 'Закрыт', color: 'text-slate-600', bgColor: 'bg-slate-100', icon: <XCircle className="w-3 h-3" /> }
}

const SENDER_CONFIG: Record<MessageSender, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  user: { label: 'Пользователь', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: <User className="w-3 h-3" /> },
  operator: { label: 'Оператор', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: <Users className="w-3 h-3" /> },
  ai: { label: 'AI', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', icon: <Bot className="w-3 h-3" /> },
  system: { label: 'Система', color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200', icon: <Settings className="w-3 h-3" /> }
}

// ============================================================================
// Helper Components
// ============================================================================

function CategoryBadge({ category }: { category: TicketCategory }) {
  const config = CATEGORY_CONFIG[category]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
      {config.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${config.bgColor} ${config.color} border ${config.borderColor}`}>
      {config.label}
    </span>
  )
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  )
}

function SLAIndicator({ deadline, status }: { deadline: string | null; status: TicketStatus }) {
  if (!deadline || status === 'resolved' || status === 'closed') {
    return <span className="text-sm text-slate-400">-</span>
  }

  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diff = deadlineDate.getTime() - now.getTime()
  const hoursLeft = Math.floor(diff / (1000 * 60 * 60))
  const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (diff < 0) {
    // SLA breached
    const hoursOverdue = Math.abs(hoursLeft)
    return (
      <div className="flex items-center gap-1 text-red-600">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-medium">-{hoursOverdue}ч</span>
      </div>
    )
  }

  if (hoursLeft < 2) {
    // Approaching deadline (< 2 hours)
    return (
      <div className="flex items-center gap-1 text-amber-600">
        <Clock className="w-4 h-4" />
        <span className="text-xs font-medium">{hoursLeft}ч {minutesLeft}м</span>
      </div>
    )
  }

  // Normal
  return (
    <div className="flex items-center gap-1 text-slate-500">
      <Clock className="w-4 h-4" />
      <span className="text-xs">{hoursLeft}ч</span>
    </div>
  )
}

function MessageBubble({ message }: { message: TicketMessage }) {
  const config = SENDER_CONFIG[message.sender_type]
  const isUser = message.sender_type === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] rounded-xl px-4 py-3 border ${config.bgColor}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`flex items-center gap-1 text-xs font-medium ${config.color}`}>
            {config.icon}
            {message.sender_name || config.label}
          </span>
          <span className="text-xs text-slate-400">
            {new Date(message.created_at).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        <p className="text-sm text-slate-800 whitespace-pre-wrap">{message.message}</p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment, idx) => (
              <a
                key={idx}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <ArrowUpRight className="w-3 h-3" />
                {attachment.filename || `Вложение ${idx + 1}`}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Stats Cards Component
// ============================================================================

function StatsCards({ stats, isLoading }: { stats: TicketStats | null; isLoading: boolean }) {
  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-8 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}м`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}ч ${mins}м`
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <MessageSquare className="w-4 h-4" />
          Всего тикетов
        </div>
        <p className="text-2xl font-bold text-foreground">{stats.total}</p>
      </div>

      <div className="bg-card rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
          <MessageSquare className="w-4 h-4" />
          Открытые
        </div>
        <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
      </div>

      <div className="bg-card rounded-xl p-4 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 text-purple-600 text-xs mb-1">
          <Clock className="w-4 h-4" />
          В работе
        </div>
        <p className="text-2xl font-bold text-purple-600">{stats.in_progress}</p>
      </div>

      <div className="bg-card rounded-xl p-4 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-600 text-xs mb-1">
          <AlertTriangle className="w-4 h-4" />
          SLA нарушен
        </div>
        <p className="text-2xl font-bold text-red-600">{stats.sla_breached}</p>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Timer className="w-4 h-4" />
          Среднее время ответа
        </div>
        <p className="text-2xl font-bold text-foreground">{formatTime(stats.avg_response_time)}</p>
      </div>
    </div>
  )
}

// ============================================================================
// Ticket Detail Modal
// ============================================================================

interface TicketDetailModalProps {
  ticket: Ticket | null
  isOpen: boolean
  onClose: () => void
  onAction: () => void
}

function TicketDetailModal({ ticket, isOpen, onClose, onAction }: TicketDetailModalProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | ''>('')
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority | ''>('')
  const [assignTo, setAssignTo] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch messages when ticket changes
  useEffect(() => {
    if (!ticket || !isOpen) return

    const fetchMessages = async () => {
      setIsLoadingMessages(true)
      setError(null)
      try {
        const response = await fetch(`/api/admin/tickets/${ticket.id}/messages`)
        if (!response.ok) throw new Error('Failed to fetch messages')
        const data = await response.json()
        if (data.success) {
          setMessages(data.data.messages || [])
        }
      } catch (err) {
        console.error('Error fetching messages:', err)
        setError('Ошибка загрузки сообщений')
      } finally {
        setIsLoadingMessages(false)
      }
    }

    fetchMessages()
    setSelectedStatus(ticket.status)
    setSelectedPriority(ticket.priority)
    setAssignTo(ticket.assigned_to || '')
  }, [ticket, isOpen])

  const handleSendReply = async () => {
    if (!ticket || !replyContent.trim()) return

    setIsSending(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: replyContent.trim(),
          messageType: 'text'
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()
      if (data.success) {
        setMessages(prev => [...prev, data.data.message])
        setReplyContent('')
        onAction()
      }
    } catch (err) {
      console.error('Error sending reply:', err)
      setError('Ошибка отправки сообщения')
    } finally {
      setIsSending(false)
    }
  }

  const handleUpdateTicket = async () => {
    if (!ticket) return

    setIsUpdating(true)
    setError(null)
    try {
      const updates: Record<string, string | null> = {}
      if (selectedStatus && selectedStatus !== ticket.status) {
        updates.status = selectedStatus
      }
      if (selectedPriority && selectedPriority !== ticket.priority) {
        updates.priority = selectedPriority
      }
      if (assignTo !== (ticket.assigned_to || '')) {
        updates.assigned_to = assignTo || null
      }

      if (Object.keys(updates).length === 0) {
        setIsUpdating(false)
        return
      }

      const response = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) throw new Error('Failed to update ticket')

      const data = await response.json()
      if (data.success) {
        onAction()
        onClose()
      }
    } catch (err) {
      console.error('Error updating ticket:', err)
      setError('Ошибка обновления тикета')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleEscalate = async () => {
    if (!ticket) return

    setIsUpdating(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/tickets/${ticket.id}/escalate`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to escalate ticket')

      const data = await response.json()
      if (data.success) {
        onAction()
        onClose()
      }
    } catch (err) {
      console.error('Error escalating ticket:', err)
      setError('Ошибка эскалации тикета')
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isOpen || !ticket) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-foreground">{ticket.ticket_number}</span>
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{ticket.subject}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Messages Panel */}
          <div className="flex-1 flex flex-col border-r border-border">
            {/* Ticket Info */}
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Пользователь:</span>
                  <span className="font-medium">{ticket.user_name || 'Неизвестный'}</span>
                  {ticket.telegram_username && (
                    <a
                      href={`https://t.me/${ticket.telegram_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      @{ticket.telegram_username}
                    </a>
                  )}
                </div>
                <CategoryBadge category={ticket.category} />
                <SLAIndicator deadline={ticket.sla_deadline} status={ticket.status} />
              </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Нет сообщений</p>
                </div>
              ) : (
                messages.map(message => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}
            </div>

            {/* Reply Form */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Написать ответ..."
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  rows={3}
                  disabled={isSending}
                />
              </div>
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSendReply}
                  disabled={!replyContent.trim() || isSending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Отправить
                </button>
              </div>
            </div>
          </div>

          {/* Actions Panel */}
          <div className="w-72 p-4 space-y-4 overflow-y-auto">
            <h3 className="font-semibold text-foreground">Действия</h3>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Статус
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="open">Открыт</option>
                <option value="in_progress">В работе</option>
                <option value="waiting_user">Ожидание пользователя</option>
                <option value="resolved">Решен</option>
                <option value="closed">Закрыт</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Приоритет
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="P1">P1 - Критический</option>
                <option value="P2">P2 - Высокий</option>
                <option value="P3">P3 - Средний</option>
                <option value="P4">P4 - Низкий</option>
              </select>
            </div>

            {/* Assign */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Назначить
              </label>
              <input
                type="text"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                placeholder="ID оператора"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Update Button */}
            <button
              onClick={handleUpdateTicket}
              disabled={isUpdating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Сохранить изменения
            </button>

            {/* Escalate Button */}
            <button
              onClick={handleEscalate}
              disabled={isUpdating || ticket.priority === 'P1'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              Эскалировать
            </button>

            {/* Info */}
            <div className="pt-4 border-t border-border space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Создан:</span>
                <span>{new Date(ticket.created_at).toLocaleString('ru-RU')}</span>
              </div>
              <div className="flex justify-between">
                <span>Обновлен:</span>
                <span>{new Date(ticket.updated_at).toLocaleString('ru-RU')}</span>
              </div>
              {ticket.assigned_to_name && (
                <div className="flex justify-between">
                  <span>Назначен:</span>
                  <span>{ticket.assigned_to_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function TicketsView() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [filters, setFilters] = useState<Filters>({
    status: '',
    priority: '',
    category: '',
    search: '',
    assignedToMe: false,
    page: 1
  })
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detail modal state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: '20'
      })

      if (filters.status) params.append('status', filters.status)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.category) params.append('category', filters.category)
      if (filters.search) params.append('search', filters.search)
      if (filters.assignedToMe) params.append('assignedToMe', 'true')

      const response = await fetch(`/api/admin/tickets?${params}`)
      if (!response.ok) throw new Error('Failed to fetch tickets')

      const data = await response.json()
      if (data.success) {
        setTickets(data.data.tickets || [])
        setPagination(data.data.pagination || { total: 0, totalPages: 0, page: 1 })
      }
    } catch (err) {
      console.error('Error fetching tickets:', err)
      setError('Ошибка загрузки тикетов')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tickets/stats')
      if (!response.ok) return
      const data = await response.json()
      if (data.success) {
        setStats(data.data.stats)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.search !== '') {
        setFilters(f => ({ ...f, page: 1 }))
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [filters.search])

  const handleRefresh = () => {
    fetchTickets()
    fetchStats()
  }

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setIsDetailOpen(true)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <StatsCards stats={stats} isLoading={isLoading && !stats} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl p-4 border border-border">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Поиск по номеру, username..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Status Filter */}
        <select
          value={filters.status}
          onChange={(e) => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Все статусы</option>
          <option value="open">Открытые</option>
          <option value="in_progress">В работе</option>
          <option value="waiting_user">Ожидание</option>
          <option value="resolved">Решенные</option>
          <option value="closed">Закрытые</option>
        </select>

        {/* Priority Filter */}
        <select
          value={filters.priority}
          onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value, page: 1 }))}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Все приоритеты</option>
          <option value="P1">P1 - Критический</option>
          <option value="P2">P2 - Высокий</option>
          <option value="P3">P3 - Средний</option>
          <option value="P4">P4 - Низкий</option>
        </select>

        {/* Category Filter */}
        <select
          value={filters.category}
          onChange={(e) => setFilters(f => ({ ...f, category: e.target.value, page: 1 }))}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Все категории</option>
          <option value="payment">Оплата</option>
          <option value="generation">Генерация</option>
          <option value="technical">Технический</option>
          <option value="account">Аккаунт</option>
          <option value="feedback">Отзыв</option>
          <option value="general">Общее</option>
        </select>

        {/* Assigned to Me */}
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={filters.assignedToMe}
            onChange={(e) => setFilters(f => ({ ...f, assignedToMe: e.target.checked, page: 1 }))}
            className="rounded border-border bg-background text-primary focus:ring-primary"
          />
          Мои тикеты
        </label>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-destructive/50 hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Номер</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Пользователь</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Категория</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Приоритет</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Назначен</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SLA</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Создан</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Загрузка...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Тикеты не найдены
                  </td>
                </tr>
              ) : (
                tickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleTicketClick(ticket)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-foreground">{ticket.ticket_number}</span>
                        {ticket.messages_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="w-3 h-3" />
                            {ticket.messages_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{ticket.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{ticket.user_name || 'Неизвестный'}</p>
                        {ticket.telegram_username && (
                          <p className="text-xs text-blue-600">@{ticket.telegram_username}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={ticket.category} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {ticket.assigned_to_name || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SLAIndicator deadline={ticket.sla_deadline} status={ticket.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{formatDate(ticket.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTicketClick(ticket)
                        }}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        title="Открыть"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Показано {(pagination.page - 1) * 20 + 1} - {Math.min(pagination.page * 20, pagination.total)} из {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                disabled={pagination.page <= 1}
                className="p-2 hover:bg-muted rounded-lg text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 hover:bg-muted rounded-lg text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedTicket(null)
        }}
        onAction={() => {
          fetchTickets()
          fetchStats()
        }}
      />
    </div>
  )
}
