"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Sparkles, ArrowRight } from "lucide-react"

// Telegram WebApp types
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          notificationOccurred: (type: "error" | "success" | "warning") => void
          impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
        }
        close?: () => void
        ready?: () => void
        expand?: () => void
      }
    }
  }
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [countdown, setCountdown] = useState(3)
  const [showConfetti, setShowConfetti] = useState(false)

  const deviceId = searchParams.get("device_id")
  const paymentId = searchParams.get("payment_id")

  // Trigger haptic feedback on Telegram
  const triggerHaptic = useCallback(() => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred("success")
      }
    } catch {
      // Silently fail if haptic not available
    }
  }, [])

  // Initialize Telegram WebApp
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready?.()
      window.Telegram.WebApp.expand?.()
    }
  }, [])

  // Animation and redirect logic
  useEffect(() => {
    // Trigger success haptic
    triggerHaptic()

    // Show confetti animation
    setShowConfetti(true)

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Auto redirect after 3 seconds
    const redirectTimeout = setTimeout(() => {
      router.push("/")
    }, 3000)

    return () => {
      clearInterval(countdownInterval)
      clearTimeout(redirectTimeout)
    }
  }, [router, triggerHaptic])

  const handleContinue = () => {
    triggerHaptic()
    router.push("/")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 safe-area-inset-top safe-area-inset-bottom">
      {/* Animated background gradient */}
      <div className="fixed inset-0 bg-gradient-mesh opacity-50 pointer-events-none" />

      {/* Success confetti effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full animate-fade-in-up"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${20 + Math.random() * 40}%`,
                backgroundColor: i % 3 === 0
                  ? "oklch(0.70 0.16 350)"
                  : i % 3 === 1
                    ? "oklch(0.80 0.11 80)"
                    : "oklch(0.62 0.14 340)",
                animationDelay: `${i * 0.1}s`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 text-center max-w-sm mx-auto">
        {/* Success icon with glow */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-green-500/20 animate-pulse-glow" />
          </div>
          <CheckCircle2
            className="w-20 h-20 text-green-500 mx-auto relative z-10 animate-fade-in-scale"
            strokeWidth={1.5}
          />
          <Sparkles
            className="absolute -top-2 -right-2 w-6 h-6 text-accent animate-float"
            style={{ animationDelay: "0.2s" }}
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold mb-2 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          Оплата прошла успешно!
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground mb-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          Теперь вы можете создавать неограниченные AI-портреты
        </p>

        {/* Payment details (if available) */}
        {(deviceId || paymentId) && (
          <div
            className="glass rounded-xl p-4 mb-6 text-sm animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            {paymentId && (
              <div className="flex justify-between items-center mb-2 last:mb-0">
                <span className="text-muted-foreground">ID платежа</span>
                <span className="font-mono text-xs truncate max-w-[140px]">
                  {paymentId.slice(0, 12)}...
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Статус</span>
              <span className="text-green-500 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Pro активирован
              </span>
            </div>
          </div>
        )}

        {/* Countdown and redirect */}
        <div
          className="text-sm text-muted-foreground mb-4 animate-fade-in-up"
          style={{ animationDelay: "0.4s" }}
        >
          Перенаправление через {countdown} сек...
        </div>

        {/* Manual continue button */}
        <button
          onClick={handleContinue}
          className="w-full py-4 px-6 bg-primary text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up"
          style={{ animationDelay: "0.5s" }}
        >
          Продолжить
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background safe-area-inset-top safe-area-inset-bottom">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
