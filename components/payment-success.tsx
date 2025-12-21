"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Sparkles } from "lucide-react"

interface PaymentSuccessProps {
  isVisible: boolean
  tier: {
    id: string
    photos: number
    price: number
  }
  onContinue: () => void
}

export function PaymentSuccess({ isVisible, tier, onContinue }: PaymentSuccessProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
      setIsAnimatingOut(false)

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        handleDismiss()
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [isVisible])

  const handleDismiss = () => {
    setIsAnimatingOut(true)
    setTimeout(() => {
      setShouldRender(false)
      onContinue()
    }, 300)
  }

  if (!shouldRender) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimatingOut ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleDismiss}
      />

      {/* Confetti Container */}
      <div className="fixed inset-0 z-[201] pointer-events-none overflow-hidden">
        {/* Generate 50 confetti pieces */}
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="confetti"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
              backgroundColor: [
                "oklch(0.70 0.16 350)", // primary pink
                "oklch(0.80 0.11 80)", // accent yellow
                "oklch(0.65 0.18 340)", // purple
                "oklch(0.75 0.14 10)", // orange
                "oklch(0.85 0.12 200)", // cyan
              ][Math.floor(Math.random() * 5)],
            }}
          />
        ))}
      </div>

      {/* Success Card */}
      <div className="fixed inset-0 z-[202] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`glass-strong rounded-3xl p-8 max-w-md w-full pointer-events-auto transition-all duration-300 ${
            isAnimatingOut ? "opacity-0 scale-95 translate-y-4" : "opacity-100 scale-100 translate-y-0"
          }`}
          style={{
            animation: isAnimatingOut ? "none" : "celebration-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse-glow" />
              <CheckCircle2 className="w-20 h-20 text-primary relative z-10 animate-bounce-in" />
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-gradient-pink-yellow mb-3 animate-fade-in-up">
              Оплата успешна!
            </h2>
            <p className="text-foreground/80 text-lg animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              Спасибо за покупку
            </p>
          </div>

          {/* Receipt */}
          <div
            className="bg-muted/50 rounded-2xl p-6 mb-6 space-y-4 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex items-center gap-3 pb-4 border-b border-border/50">
              <Sparkles className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold text-foreground">Детали заказа</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Количество фото</span>
                <span className="text-foreground font-semibold text-lg">{tier.photos} фото</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Тариф</span>
                <span className="text-foreground font-medium capitalize">{tier.id}</span>
              </div>

              <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                <span className="text-foreground font-medium">Оплачено</span>
                <span className="text-2xl font-bold text-gradient-pink">{tier.price} ₽</span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleDismiss}
            className="btn-premium w-full animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <span className="relative z-10">Перейти к галерее</span>
          </button>

          {/* Auto-dismiss hint */}
          <p
            className="text-center text-muted-foreground text-sm mt-4 animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            Автоматически закроется через 5 сек
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes celebration-enter {
          0% {
            opacity: 0;
            transform: scale(0.5) translateY(30px);
          }
          50% {
            transform: scale(1.05) translateY(-5px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes bounce-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          top: -10px;
          opacity: 0;
          animation: confetti-fall linear forwards;
          will-change: transform, opacity;
        }

        .confetti:nth-child(3n) {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .confetti:nth-child(4n) {
          width: 6px;
          height: 14px;
        }

        .confetti:nth-child(5n) {
          width: 12px;
          height: 6px;
        }

        .animate-bounce-in {
          animation: bounce-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s backwards;
        }

        /* Prevent body scroll when modal is open */
        body:has(.payment-success-open) {
          overflow: hidden;
        }
      `}</style>
    </>
  )
}

// Usage example:
/*
const [showSuccess, setShowSuccess] = useState(false)

const handlePaymentSuccess = () => {
  setShowSuccess(true)
}

return (
  <PaymentSuccess
    isVisible={showSuccess}
    tier={{
      id: "professional",
      photos: 23,
      price: 500
    }}
    onContinue={() => {
      setShowSuccess(false)
      // Navigate to gallery or results
      setViewState({ view: "RESULTS", personaId: currentPersonaId })
    }}
  />
)
*/
