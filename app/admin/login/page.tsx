'use client'

import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for OAuth errors in URL
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_error: 'Ошибка авторизации Google',
        no_code: 'Не получен код авторизации',
        invalid_state: 'Ошибка безопасности. Попробуйте снова',
        oauth_not_configured: 'Google OAuth не настроен',
        token_error: 'Ошибка получения токена',
        user_info_error: 'Не удалось получить данные пользователя',
        email_not_verified: 'Email не подтверждён в Google',
        not_allowed: 'Доступ запрещён. Обратитесь к администратору',
        callback_error: 'Ошибка авторизации'
      }
      setError(errorMessages[errorParam] || 'Неизвестная ошибка')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка входа')
      }

      // Redirect to admin panel
      router.push('/admin')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            PinGlass Admin
          </h1>
          <p className="text-slate-500">
            Панель администрирования
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white shadow-xl border border-slate-200 rounded-2xl p-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 focus:bg-white transition-all"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-12 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 focus:bg-white transition-all"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-medium py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Вход...
                </>
              ) : (
                'Войти'
              )}
            </button>
          </form>

          {/* Help Text */}
          <p className="mt-6 text-center text-xs text-slate-400">
            Вход только для администраторов
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-400">
          PinGlass © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

function LoginLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-4" />
        <p className="text-slate-500">Загрузка...</p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  )
}
