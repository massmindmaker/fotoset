"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Sparkles, MessageCircle, ExternalLink } from "lucide-react"

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

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  onComplete,
  onStart,
  isAuthPending = false,
  authError = false,
  isTelegramWebApp = false
}) => {
  const [stage, setStage] = useState(0)

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

  const handleOpenTelegram = useCallback(() => {
    // Open Telegram bot in new tab or app
    window.open("https://t.me/Pinglass_bot/App", "_blank")
  }, [])

  // For web users (not in Telegram), show redirect screen
  if (!isTelegramWebApp && !isAuthPending) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6">
        {/* Background pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-md mx-auto">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="logo-text text-4xl font-black tracking-tight mb-2">
              Pinglass
            </h1>
            <p className="text-muted-foreground">
              AI-фотосессия в Telegram
            </p>
          </div>

          {/* Demo photos grid */}
          <div className="relative w-72 h-72 mx-auto mb-8">
            {DEMO_PHOTOS.slice(0, 6).map((src, i) => {
              const angle = (i * 60) - 90
              const radius = 100
              const x = Math.cos((angle * Math.PI) / 180) * radius
              const y = Math.sin((angle * Math.PI) / 180) * radius
              return (
                <div
                  key={i}
                  className="absolute w-20 h-20 rounded-2xl overflow-hidden shadow-xl border-2 border-white/20"
                  style={{
                    left: `calc(50% + ${x}px - 40px)`,
                    top: `calc(50% + ${y}px - 40px)`,
                    transform: `rotate(${i * 15 - 30}deg)`,
                  }}
                >
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )
            })}
            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-2xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 mb-8">
            <h2 className="text-xl font-bold">
              Доступно только в Telegram
            </h2>
            <p className="text-muted-foreground">
              Откройте PinGlass в Telegram, чтобы создать 23 профессиональных AI-фото за 5 минут
            </p>
          </div>

          {/* Open Telegram button */}
          <button
            onClick={handleOpenTelegram}
            className="w-full py-4 px-6 bg-[#24A1DE] hover:bg-[#1d8fc7] text-white font-semibold rounded-2xl shadow-xl shadow-[#24A1DE]/30 transition-all flex items-center justify-center gap-3"
          >
            <MessageCircle className="w-5 h-5" />
            Открыть в Telegram
            <ExternalLink className="w-4 h-4 ml-1" />
          </button>

          <p className="text-xs text-muted-foreground mt-4">
            Нажмите кнопку выше или откройте @Pinglass_bot в Telegram
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (isAuthPending) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-muted-foreground">Проверка авторизации...</p>
      </div>
    )
  }

  // Error state
  if (authError) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Ошибка авторизации</h2>
          <p className="text-muted-foreground mb-6">
            Не удалось получить данные из Telegram. Попробуйте закрыть и открыть приложение заново.
          </p>
          <button
            onClick={handleOpenTelegram}
            className="py-3 px-6 bg-primary text-white rounded-xl font-medium"
          >
            Открыть в Telegram
          </button>
        </div>
      </div>
    )
  }

  // Normal onboarding for Telegram users
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background touch-none overscroll-none overflow-hidden safe-area-inset-top">
      {/* Demo photos background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="demo-photo-grid absolute inset-0">
          {DEMO_PHOTOS.map((src, i) => (
            <div
              key={i}
              className={`absolute rounded-2xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-1000 ${
                stage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
              }`}
              style={{
                left: `${(i % 4) * 26 + 5}%`,
                top: `${Math.floor(i / 4) * 30 + 5}%`,
                width: '22%',
                aspectRatio: '3/4',
                transform: `rotate(${(i % 3 - 1) * 4}deg)`,
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-end px-6 pb-8 safe-area-inset-bottom">
        {/* Logo and tagline */}
        <div
          className={`text-center mb-6 transition-all duration-700 ${
            stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <h1 className="logo-text text-4xl sm:text-5xl font-black tracking-tight mb-2">
            Pinglass
          </h1>
          <p className="text-lg text-muted-foreground">
            Твоя AI-фотосессия
          </p>
        </div>

        {/* Features */}
        <div
          className={`flex flex-wrap justify-center gap-2 mb-8 transition-all duration-700 delay-300 ${
            stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="px-3 py-1.5 bg-primary/10 rounded-full text-sm font-medium text-primary">
            23 фото
          </span>
          <span className="px-3 py-1.5 bg-primary/10 rounded-full text-sm font-medium text-primary">
            5 минут
          </span>
          <span className="px-3 py-1.5 bg-primary/10 rounded-full text-sm font-medium text-primary">
            HD качество
          </span>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className={`w-full max-w-sm py-4 px-6 bg-gradient-to-r from-primary to-pink-500 text-white font-semibold rounded-2xl shadow-xl shadow-primary/30 transition-all duration-700 delay-500 flex items-center justify-center gap-2 ${
            stage >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          Начать
        </button>
      </div>
    </div>
  )
}
