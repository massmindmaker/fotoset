"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Loader2, AlertCircle, AlertTriangle, Info, ChevronLeft, ChevronRight } from "lucide-react"
import type { SentryEvent } from "@/lib/admin/sentry-api"

/**
 * LogsView Component
 *
 * Displays Sentry events in a table with filters and pagination
 *
 * Features:
 * - Event table (level badge, message, user ID, timestamp)
 * - Filters: level dropdown, search input
 * - Manual refresh button (no auto-polling)
 * - Pagination (prev/next buttons)
 * - Click row → open EventDetailsModal (will implement next)
 */

interface LogsViewProps {
  onEventClick?: (event: SentryEvent) => void
}

interface FiltersState {
  level: "error" | "warning" | "info" | "all"
  search: string
  page: number
}

export function LogsView({ onEventClick }: LogsViewProps) {
  // State
  const [events, setEvents] = useState<SentryEvent[]>([])
  const [filters, setFilters] = useState<FiltersState>({
    level: "all",
    search: "",
    page: 1,
  })
  const [totalPages, setTotalPages] = useState(0)
  const [totalEvents, setTotalEvents] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch events from API
  const fetchEvents = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      // Build query params
      const params = new URLSearchParams({
        level: filters.level,
        page: filters.page.toString(),
        limit: "20",
      })

      if (filters.search) {
        params.append("search", filters.search)
      }

      const response = await fetch(`/api/admin/logs?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.userMessage || "Ошибка загрузки логов")
      }

      const data = await response.json()

      if (data.success) {
        setEvents(data.data.events)
        setTotalPages(data.data.totalPages)
        setTotalEvents(data.data.totalEvents)
      } else {
        throw new Error(data.error?.userMessage || "Неизвестная ошибка")
      }
    } catch (err) {
      console.error("[LogsView] Error fetching events:", err)
      setError(err instanceof Error ? err.message : "Ошибка загрузки логов")
      setEvents([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Initial load + filter changes
  useEffect(() => {
    fetchEvents()
  }, [filters.level, filters.page])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEvents(true) // Use refresh spinner, don't reset loading state
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [filters]) // Re-create interval when filters change

  // Manual refresh
  const handleRefresh = () => {
    fetchEvents(true)
  }

  // Search with debounce (wait 500ms after user stops typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.search !== "") {
        setFilters(prev => ({ ...prev, page: 1 }))
        fetchEvents()
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [filters.search])

  // Filter handlers
  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, level: e.target.value as FiltersState["level"], page: 1 }))
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }))
  }

  const handlePrevPage = () => {
    if (filters.page > 1) {
      setFilters(prev => ({ ...prev, page: prev.page - 1 }))
    }
  }

  const handleNextPage = () => {
    if (filters.page < totalPages) {
      setFilters(prev => ({ ...prev, page: prev.page + 1 }))
    }
  }

  // Level badge component
  const LevelBadge = ({ level }: { level: SentryEvent["level"] }) => {
    const styles = {
      error: "bg-destructive/20 text-destructive border-destructive/30",
      warning: "bg-accent/20 text-accent-foreground border-accent/30",
      info: "bg-primary/20 text-primary border-primary/30",
      debug: "bg-muted text-muted-foreground border-border",
    }

    const icons = {
      error: <AlertCircle className="w-3 h-3" />,
      warning: <AlertTriangle className="w-3 h-3" />,
      info: <Info className="w-3 h-3" />,
      debug: <Info className="w-3 h-3" />,
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${styles[level]}`}
      >
        {icons[level]}
        {level}
      </span>
    )
  }

  // Format timestamp
  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "Только что"
    if (diffMins < 60) return `${diffMins}м назад`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}ч назад`

    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters + Refresh */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Level filter */}
        <select
          value={filters.level}
          onChange={handleLevelChange}
          className="px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">Все уровни</option>
          <option value="error">Errors</option>
          <option value="warning">Warnings</option>
          <option value="info">Info</option>
        </select>

        {/* Search input */}
        <input
          type="text"
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Поиск по тексту..."
          className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
        />

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 active:bg-primary/30 text-primary font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Обновить
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-2 text-sm text-destructive underline hover:no-underline"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Events table */}
      {!isLoading && !error && (
        <>
          <div className="glass rounded-xl overflow-hidden border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    Уровень
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    Сообщение
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    User ID
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    Время
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-sm text-muted-foreground">
                      Логи не найдены
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <LevelBadge level={event.level} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground line-clamp-2">
                          {event.message}
                        </p>
                        {event.culprit && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {event.culprit}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground font-mono">
                          {event.user?.telegram_id || event.user?.id || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-muted-foreground">
                          {formatTimestamp(event.timestamp)}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Страница {filters.page} из {totalPages} • Всего: {totalEvents}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={filters.page === 1}
                  className="px-3 py-2 rounded-lg bg-card border border-border hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={filters.page === totalPages}
                  className="px-3 py-2 rounded-lg bg-card border border-border hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
