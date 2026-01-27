'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Crown, ArrowRight, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function PartnerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialCheckDone, setInitialCheckDone] = useState(false)

  // Check if already authenticated
  useEffect(() => {
    checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    try {
      const res = await fetch('/api/partner/auth/session')
      const data = await res.json()

      if (data.success && data.authenticated) {
        // Already logged in, redirect to dashboard
        router.replace('/partner/dashboard')
        return
      }
    } catch {
      // Ignore errors - just show login form
    }
    setInitialCheckDone(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    const trimmedEmail = email.trim()
    const trimmedPassword = password

    if (!trimmedEmail || !trimmedPassword) {
      setError('Введите email и пароль')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/partner/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword
        }),
      })
      const data = await res.json()

      if (data.success) {
        // Redirect to partner dashboard
        router.replace('/partner/dashboard')
      } else {
        setError(data.error || 'Ошибка входа')
      }
    } catch {
      setError('Ошибка сети. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  if (!initialCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-500/10 via-background to-purple-500/10 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Партнёрский кабинет</h1>
          <p className="text-muted-foreground mt-2">
            Войдите, чтобы управлять своими заработками
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  autoFocus
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-600 text-sm rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Вход...
                </>
              ) : (
                <>
                  Войти
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
          <p>
            Нет партнёрского аккаунта?{' '}
            <a
              href="https://t.me/PinGlassBot/app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-500 hover:underline"
            >
              Подайте заявку в приложении
            </a>
          </p>
          <p>
            <a
              href="/partner/forgot-password"
              className="text-violet-500 hover:underline"
            >
              Забыли пароль?
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
