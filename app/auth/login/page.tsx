'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Shield, Crown, ArrowRight, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function UnifiedLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialCheckDone, setInitialCheckDone] = useState(false)

  // Get hint from URL (e.g., /auth/login?hint=admin or ?hint=partner)
  const hint = searchParams.get('hint') as 'admin' | 'partner' | null

  // Check if already authenticated
  useEffect(() => {
    checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    try {
      // Check admin session first
      const adminRes = await fetch('/api/admin/auth/session').catch(() => null)
      if (adminRes?.ok) {
        const adminData = await adminRes.json()
        if (adminData.authenticated) {
          router.replace('/admin')
          return
        }
      }

      // Check partner session
      const partnerRes = await fetch('/api/partner/auth/session').catch(() => null)
      if (partnerRes?.ok) {
        const partnerData = await partnerRes.json()
        if (partnerData.success && partnerData.authenticated) {
          router.replace('/partner/dashboard')
          return
        }
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
      const res = await fetch('/api/auth/unified-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword
        }),
      })
      const data = await res.json()

      if (data.success && data.redirect) {
        // Small delay to ensure cookie is set before redirect
        // Using window.location for more reliable cookie handling
        await new Promise(r => setTimeout(r, 150))
        window.location.href = data.redirect
        return // Prevent setLoading(false) during redirect
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Dynamic styling based on hint
  const isAdmin = hint === 'admin'
  const Icon = isAdmin ? Shield : Crown
  const title = isAdmin ? 'Админ-панель' : (hint === 'partner' ? 'Партнёрский кабинет' : 'Вход в систему')
  const subtitle = isAdmin
    ? 'Войдите для управления системой'
    : (hint === 'partner'
      ? 'Войдите, чтобы управлять своими заработками'
      : 'Введите данные для входа в панель администратора или партнёра')
  const gradientFrom = isAdmin ? 'from-blue-500' : 'from-violet-500'
  const gradientTo = isAdmin ? 'to-indigo-600' : 'to-purple-600'
  const ringColor = isAdmin ? 'focus:ring-blue-500' : 'focus:ring-violet-500'
  const shadowColor = isAdmin ? 'shadow-blue-500/30' : 'shadow-violet-500/30'
  const accentColor = isAdmin ? 'text-blue-500' : 'text-violet-500'
  const bgGradient = isAdmin
    ? 'from-blue-500/10 via-background to-indigo-500/10'
    : 'from-violet-500/10 via-background to-purple-500/10'

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bgGradient} p-4`}>
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg ${shadowColor}`}>
            <Icon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
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
                  placeholder="email@example.com"
                  className={`w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 ${ringColor} focus:border-transparent transition-all`}
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
                  className={`w-full pl-11 pr-12 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 ${ringColor} focus:border-transparent transition-all`}
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
              className={`w-full py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2`}
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
          {hint === 'partner' && (
            <>
              <p>
                Нет партнёрского аккаунта?{' '}
                <a
                  href="https://t.me/PinGlassBot/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${accentColor} hover:underline`}
                >
                  Подайте заявку в приложении
                </a>
              </p>
            </>
          )}
          {!hint && (
            <p>
              Система автоматически определит тип аккаунта
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
