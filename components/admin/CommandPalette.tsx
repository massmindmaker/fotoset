"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  User,
  CreditCard,
  Zap,
  Gift,
  X,
  Command,
  Loader2,
  LayoutDashboard,
  Activity,
  Settings,
  MessageSquare
} from "lucide-react"

interface SearchResult {
  type: 'user' | 'payment' | 'generation' | 'referral'
  id: number
  title: string
  subtitle: string
  url: string
  meta?: Record<string, unknown>
}

interface QuickAction {
  id: string
  title: string
  subtitle: string
  url: string
  icon: React.ReactNode
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'dashboard', title: 'Dashboard', subtitle: 'Главная страница', url: '/admin', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'users', title: 'Пользователи', subtitle: 'Управление пользователями', url: '/admin/users', icon: <User className="w-4 h-4" /> },
  { id: 'payments', title: 'Платежи', subtitle: 'История платежей', url: '/admin/payments', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'generations', title: 'Генерации', subtitle: 'Мониторинг генераций', url: '/admin/generations', icon: <Zap className="w-4 h-4" /> },
  { id: 'referrals', title: 'Рефералы', subtitle: 'Реферальная система', url: '/admin/referrals', icon: <Gift className="w-4 h-4" /> },
  { id: 'telegram', title: 'Telegram', subtitle: 'Очередь сообщений', url: '/admin/telegram', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'logs', title: 'Логи', subtitle: 'Sentry логи', url: '/admin/logs', icon: <Activity className="w-4 h-4" /> },
  { id: 'settings', title: 'Настройки', subtitle: 'Настройки системы', url: '/admin/settings', icon: <Settings className="w-4 h-4" /> },
]

/**
 * CommandPalette - Global search modal (Cmd+K / Ctrl+K)
 */
export function CommandPalette() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Filter quick actions based on query
  const filteredActions = query.length === 0
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter(action =>
        action.title.toLowerCase().includes(query.toLowerCase()) ||
        action.subtitle.toLowerCase().includes(query.toLowerCase())
      )

  // Combined items for keyboard navigation
  const allItems = query.length >= 2
    ? [...results]
    : [...filteredActions]

  const totalItems = allItems.length

  // Open/close handlers
  const openPalette = useCallback(() => {
    setIsOpen(true)
    setQuery('')
    setResults([])
    setSelectedIndex(0)
  }, [])

  const closePalette = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setResults([])
  }, [])

  // Search handler with debounce
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results || [])
      }
    } catch (err) {
      console.error('[CommandPalette] Search error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle query change with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => {
        performSearch(query)
      }, 300)
    } else {
      setResults([])
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, performSearch])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open palette with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) {
          closePalette()
        } else {
          openPalette()
        }
        return
      }

      if (!isOpen) return

      // Close with Escape
      if (e.key === 'Escape') {
        e.preventDefault()
        closePalette()
        return
      }

      // Navigate with arrows
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % totalItems)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
        return
      }

      // Select with Enter
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = allItems[selectedIndex]
        if (item) {
          const url = 'url' in item ? item.url : ''
          if (url) {
            router.push(url)
            closePalette()
          }
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, totalItems, allItems, router, openPalette, closePalette])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results, query])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-4 h-4 text-blue-400" />
      case 'payment':
        return <CreditCard className="w-4 h-4 text-green-400" />
      case 'generation':
        return <Zap className="w-4 h-4 text-yellow-400" />
      case 'referral':
        return <Gift className="w-4 h-4 text-pink-400" />
      default:
        return <Search className="w-4 h-4 text-muted-foreground" />
    }
  }

  const handleSelect = (url: string) => {
    router.push(url)
    closePalette()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closePalette}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск пользователей, платежей, генераций..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          {loading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
          <button
            onClick={closePalette}
            className="p-1 hover:bg-muted/50 rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length < 2 ? (
            // Show quick actions
            <div className="p-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                Быстрые действия
              </div>
              {filteredActions.map((action, index) => (
                <button
                  key={action.id}
                  onClick={() => handleSelect(action.url)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                    ${index === selectedIndex ? 'bg-primary/20 text-primary' : 'hover:bg-muted/50'}
                  `}
                >
                  <div className="flex-shrink-0 text-muted-foreground">
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{action.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{action.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : results.length > 0 ? (
            // Show search results
            <div className="p-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                Результаты поиска
              </div>
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result.url)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                    ${index === selectedIndex ? 'bg-primary/20 text-primary' : 'hover:bg-muted/50'}
                  `}
                >
                  <div className="flex-shrink-0">
                    {getTypeIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{result.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                  </div>
                  <div className="flex-shrink-0 text-xs text-muted-foreground capitalize">
                    {result.type}
                  </div>
                </button>
              ))}
            </div>
          ) : !loading ? (
            // No results
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ничего не найдено</p>
              <p className="text-xs mt-1">Попробуйте изменить запрос</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
              навигация
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>
              выбрать
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
              закрыть
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>
    </div>
  )
}
