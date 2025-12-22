"use client"

import { Suspense, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { XCircle, Loader2, RefreshCw, Home, AlertTriangle } from "lucide-react"

function PaymentFailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const deviceId = searchParams.get("device_id")
  const paymentId = searchParams.get("payment_id")
  const errorCode = searchParams.get("error")
  const errorMessage = searchParams.get("message")

  // Trigger haptic feedback on Telegram
  const triggerHaptic = useCallback((type: "error" | "warning") => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred(type)
      }
    } catch {
      // Silently fail if haptic not available
    }
  }, [])

  // Initialize Telegram WebApp and trigger error haptic
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready?.()
      window.Telegram.WebApp.expand?.()
    }
    // Trigger error haptic on mount
    triggerHaptic("error")
  }, [triggerHaptic])

  // Get human-readable error message
  const getErrorDescription = () => {
    if (errorMessage) return decodeURIComponent(errorMessage)

    switch (errorCode) {
      case "cancelled":
        return "Вы отменили оплату"
      case "declined":
        return "Платеж был отклонен банком"
      case "timeout":
        return "Время ожидания платежа истекло"
      case "insufficient_funds":
        return "Недостаточно средств на карте"
      case "card_expired":
        return "Срок действия карты истек"
      default:
        return "Произошла ошибка при обработке платежа"
    }
  }

  const handleRetry = () => {
    triggerHaptic("warning")
    // Go back to home with retry flag
    router.push("/?retry_payment=true")
  }

  const handleHome = () => {
    router.push("/")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 safe-area-inset-top safe-area-inset-bottom">
      {/* Animated background gradient */}
      <div className="fixed inset-0 bg-gradient-mesh opacity-50 pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 text-center max-w-sm mx-auto">
        {/* Error icon with glow */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-24 h-24 rounded-full animate-pulse"
              style={{ backgroundColor: "oklch(0.55 0.20 25 / 0.2)" }}
            />
          </div>
          <XCircle
            className="w-20 h-20 text-destructive mx-auto relative z-10 animate-fade-in-scale"
            strokeWidth={1.5}
          />
          <AlertTriangle
            className="absolute -top-1 -right-1 w-6 h-6 text-accent animate-float"
            style={{ animationDelay: "0.2s" }}
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold mb-2 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          Оплата не прошла
        </h1>

        {/* Error description */}
        <p className="text-muted-foreground mb-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          {getErrorDescription()}
        </p>

        {/* Payment details (if available) */}
        {(deviceId || paymentId || errorCode) && (
          <div
            className="glass rounded-xl p-4 mb-6 text-sm animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            {paymentId && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">ID платежа</span>
                <span className="font-mono text-xs truncate max-w-[140px]">
                  {paymentId.slice(0, 12)}...
                </span>
              </div>
            )}
            {errorCode && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">Код ошибки</span>
                <span className="font-mono text-xs text-destructive">
                  {errorCode}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Статус</span>
              <span className="text-destructive font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                Не оплачено
              </span>
            </div>
          </div>
        )}

        {/* Help text */}
        <p
          className="text-xs text-muted-foreground mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.4s" }}
        >
          Деньги не были списаны с вашей карты. Вы можете попробовать снова или использовать другую карту.
        </p>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full py-4 px-6 bg-primary text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up"
            style={{ animationDelay: "0.5s" }}
          >
            <RefreshCw className="w-5 h-5" />
            Попробовать снова
          </button>

          <button
            onClick={handleHome}
            className="w-full py-4 px-6 bg-secondary text-secondary-foreground rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <Home className="w-5 h-5" />
            На главную
          </button>
        </div>

        {/* Support link */}
        <p
          className="text-xs text-muted-foreground mt-6 animate-fade-in-up"
          style={{ animationDelay: "0.7s" }}
        >
          Если проблема повторяется, напишите в{" "}
          <a
            href="https://t.me/pinglass_support"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            поддержку
          </a>
        </p>
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

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentFailContent />
    </Suspense>
  )
}
