"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Sparkles, X, Mail, Lock, User, Eye, EyeOff } from "lucide-react"
import { authClient } from "@/lib/auth/client"

const DEMO_PHOTOS = [
  "/optimized/demo/Screenshot_1.webp", "/optimized/demo/Screenshot_2.webp", "/optimized/demo/Screenshot_3.webp",
  "/optimized/demo/Screenshot_4.webp", "/optimized/demo/Screenshot_5.webp", "/optimized/demo/Screenshot_6.webp",
  "/optimized/demo/Screenshot_7.webp", "/optimized/demo/Screenshot_8.webp", "/optimized/demo/Screenshot_9.webp",
  "/optimized/demo/Screenshot_10.webp", "/optimized/demo/Screenshot_11.webp",
]

export interface OnboardingViewProps {
  onComplete: () => void
  onStart: () => void
  isAuthPending?: boolean
  authError?: boolean
  isTelegramWebApp?: boolean
}

type AuthMode = 'login' | 'register'

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  onComplete,
  onStart,
  isAuthPending = false,
  authError = false,
  isTelegramWebApp = false
}) => {
  const [stage, setStage] = useState(0)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 100)
    const t2 = setTimeout(() => setStage(2), 1200)
    const t3 = setTimeout(() => setStage(3), 1800)
    const t4 = setTimeout(() => setStage(4), 2400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [])

  const handleStart = useCallback(() => {
    onStart()
  }, [onStart])

  // Open auth modal for web users
  const handleOpenAuthModal = useCallback(() => {
    setShowAuthModal(true)
    setError(null)
  }, [])

  // Close auth modal
  const handleCloseAuthModal = useCallback(() => {
    setShowAuthModal(false)
    setError(null)
    setEmail('')
    setPassword('')
    setName('')
  }, [])

  // Google OAuth
  const handleGoogleAuth = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/?auth=success',
      })
    } catch (err) {
      console.error('[Auth] Google auth error:', err)
      setError('Ошибка входа через Google')
      setIsLoading(false)
    }
  }, [])

  // Email/Password Login
  const handleEmailLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Заполните все поля')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || 'Неверный email или пароль')
        setIsLoading(false)
        return
      }

      // Success - redirect to dashboard
      localStorage.setItem("pinglass_onboarding_complete", "true")
      window.location.href = '/?auth=success'
    } catch (err) {
      console.error('[Auth] Email login error:', err)
      setError('Ошибка входа. Проверьте данные.')
      setIsLoading(false)
    }
  }, [email, password])

  // Email/Password Registration
  const handleEmailRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Заполните все поля')
      return
    }
    if (password.length < 8) {
      setError('Пароль должен быть минимум 8 символов')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: name || email.split('@')[0],
      })

      if (result.error) {
        setError(result.error.message || 'Ошибка регистрации')
        setIsLoading(false)
        return
      }

      // Success - redirect to dashboard
      localStorage.setItem("pinglass_onboarding_complete", "true")
      window.location.href = '/?auth=success'
    } catch (err) {
      console.error('[Auth] Registration error:', err)
      setError('Ошибка регистрации. Попробуйте позже.')
      setIsLoading(false)
    }
  }, [email, password, name])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-14 relative overflow-hidden bg-gradient-mesh">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl animate-float" />
        <div
          className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-accent/10 blur-3xl animate-float"
          style={{ animationDelay: "-2s" }}
        />
      </div>
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
        {/* Animated photos section */}
        <div className="relative w-full aspect-square max-w-md mb-8">
          <div
            className={
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-primary/20 blur-3xl transition-all duration-1000 " +
              (stage >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-50")
            }
          />
          <div
            className={
              "absolute top-1/2 left-1/2 w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden holographic-shine border-4 border-transparent animate-holographic-border shadow-2xl shadow-primary/30 " +
              (stage >= 1 ? "animate-main-image-enter" : "opacity-0")
            }
            style={stage < 1 ? { transform: "translate(-50%, -50%) scale(0.3)" } : undefined}
          >
            <img src={DEMO_PHOTOS[0]} alt="AI Portrait" className="w-full h-full object-cover" loading="eager" />
          </div>
          {/* Inner orbit */}
          <div
            className={
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full " +
              (stage >= 2 ? "animate-orbit-ring-enter" : "opacity-0")
            }
          >
            <div
              className="absolute inset-0 animate-orbit-smooth"
              style={{ "--orbit-duration": "25s" } as React.CSSProperties}
            >
              {DEMO_PHOTOS.slice(1, 5).map((src, i) => {
                const angle = i * 90 + 45
                return (
                  <div
                    key={"inner-" + i}
                    className="absolute"
                    style={{ left: "50%", top: "50%", transform: `rotate(${angle}deg) translateX(115px)` }}
                  >
                    <div style={{ transform: `rotate(${-angle}deg)` }}>
                      <div
                        className={
                          "orbit-content w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-xl shadow-primary/20 -translate-x-1/2 -translate-y-1/2 " +
                          (i % 2 === 0 ? "neon-frame" : "neon-frame-alt")
                        }
                      >
                        <img src={src} alt={"Portrait " + i} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Outer orbit */}
          <div
            className={
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full " +
              (stage >= 3 ? "animate-orbit-ring-enter" : "opacity-0")
            }
            style={{ animationDelay: "0.2s" }}
          >
            <div
              className="absolute inset-0 animate-orbit-smooth-reverse"
              style={{ "--orbit-duration": "35s" } as React.CSSProperties}
            >
              {DEMO_PHOTOS.slice(5, 11).map((src, i) => {
                const angle = i * 60 + 30
                return (
                  <div
                    key={"outer-" + i}
                    className="absolute"
                    style={{ left: "50%", top: "50%", transform: `rotate(${angle}deg) translateX(175px)` }}
                  >
                    <div style={{ transform: `rotate(${-angle}deg)` }}>
                      <div
                        className={
                          "orbit-content-reverse w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden shadow-lg shadow-accent/20 -translate-x-1/2 -translate-y-1/2 " +
                          (i % 2 === 1 ? "neon-frame-alt" : "neon-frame")
                        }
                      >
                        <img
                          src={src}
                          alt={"Portrait outer " + i}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Title */}
        <div
          className={
            "flex flex-col items-center mb-8 transition-all duration-1000 " +
            (stage >= 4 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")
          }
        >
          <h1 className="logo-text text-4xl sm:text-5xl font-black tracking-tight mb-3">
            Pinglass
          </h1>
          <p className="text-muted-foreground max-w-md text-lg text-center leading-relaxed">
            Создавайте впечатляющие AI-фотографии
          </p>
        </div>

        {/* Button */}
        {isTelegramWebApp ? (
          <button
            onClick={handleStart}
            disabled={isAuthPending}
            className={
              "w-full max-w-xs btn-premium text-lg " +
              (stage >= 4 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0") +
              (isAuthPending ? " opacity-70 cursor-wait" : "")
            }
            style={{ transitionDelay: "200ms" }}
          >
            <span className="flex items-center justify-center gap-2">
              {isAuthPending ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Авторизация...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Начать!
                </>
              )}
            </span>
          </button>
        ) : (
          <button
            onClick={handleOpenAuthModal}
            className={
              "w-full max-w-xs btn-premium text-lg transition-all duration-500 " +
              (stage >= 4 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")
            }
            style={{ transitionDelay: "200ms" }}
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Начать!
            </span>
          </button>
        )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card rounded-3xl shadow-[var(--shadow-lg)] border border-border/50 overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
            {/* Close button */}
            <button
              onClick={handleCloseAuthModal}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            <div className="p-6 pt-12">
              {/* Title */}
              <h2 className="text-2xl font-bold text-center mb-2">
                {authMode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}
              </h2>
              <p className="text-muted-foreground text-center mb-6">
                {authMode === 'login'
                  ? 'Войдите, чтобы продолжить'
                  : 'Создайте аккаунт для начала'}
              </p>

              {/* Error message */}
              {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm text-center">
                  {error}
                </div>
              )}

              {/* Google button */}
              <button
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-800 rounded-xl font-medium hover:bg-gray-50 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all mb-4 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isLoading ? 'Загрузка...' : 'Продолжить с Google'}
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">или</span>
                </div>
              </div>

              {/* Email form */}
              <form onSubmit={authMode === 'login' ? handleEmailLogin : handleEmailRegister}>
                {authMode === 'register' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Имя</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ваше имя"
                        className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={authMode === 'register' ? "Минимум 8 символов" : "Ваш пароль"}
                      required
                      minLength={authMode === 'register' ? 8 : undefined}
                      className="w-full pl-10 pr-12 py-3 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-primary to-[oklch(0.65_0.20_340)] text-primary-foreground rounded-xl font-semibold hover:opacity-90 hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)] transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Загрузка...' : (authMode === 'login' ? 'Войти' : 'Создать аккаунт')}
                </button>
              </form>

              {/* Switch mode */}
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {authMode === 'login' ? (
                  <>
                    Нет аккаунта?{' '}
                    <button
                      onClick={() => { setAuthMode('register'); setError(null); }}
                      className="text-primary hover:underline font-medium"
                    >
                      Зарегистрироваться
                    </button>
                  </>
                ) : (
                  <>
                    Уже есть аккаунт?{' '}
                    <button
                      onClick={() => { setAuthMode('login'); setError(null); }}
                      className="text-primary hover:underline font-medium"
                    >
                      Войти
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OnboardingView
