"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Loader2, ChevronLeft, ChevronRight, Shield, ShieldOff } from "lucide-react"

interface User {
  id: number
  telegram_user_id: number
  is_pro: boolean
  created_at: string
  avatars_count: number
  payments_count: number
  total_spent: number
}

export function UsersView() {
  const [users, setUsers] = useState<User[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })

      if (search) {
        params.append("search", search)
      }

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) throw new Error("Failed to fetch users")

      const data = await response.json()
      if (data.success) {
        setUsers(data.data.users)
        setTotalPages(data.data.pagination.totalPages)
        setTotal(data.data.pagination.total)
      }
    } catch (err) {
      console.error("[UsersView] Error:", err)
      setError("Ошибка загрузки пользователей")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page])

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== "") {
        setPage(1)
        fetchUsers()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Поиск по ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          onClick={() => fetchUsers(true)}
          disabled={isRefreshing}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        Всего пользователей: <span className="font-medium text-foreground">{total}</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          {error}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-sm font-medium text-muted-foreground">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Telegram ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Avatars</th>
                  <th className="px-4 py-3">Платежи</th>
                  <th className="px-4 py-3">Потрачено</th>
                  <th className="px-4 py-3">Создан</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Пользователи не найдены
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-mono">{user.id}</td>
                      <td className="px-4 py-3 text-sm font-mono">{user.telegram_user_id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {user.is_pro ? (
                            <>
                              <Shield className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium text-primary">Pro</span>
                            </>
                          ) : (
                            <>
                              <ShieldOff className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Free</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{user.avatars_count}</td>
                      <td className="px-4 py-3 text-sm">{user.payments_count}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {user.total_spent ? `${user.total_spent}₽` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("ru-RU")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Страница {page} из {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
