"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CreditCard, CheckCircle2, Loader2, AlertTriangle, Sparkles, Shield } from "lucide-react"

function DemoPaymentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const deviceId = searchParams.get("device_id")
  const paymentId = searchParams.get("payment_id")
  const amount = searchParams.get("amount") || "500"
  const tier = searchParams.get("tier") || "standard"
  const photos = searchParams.get("photos") || "15"

  const handleConfirmPayment = async () => {
    if (!deviceId || !paymentId) return

    setIsProcessing(true)

    // Имитация задержки обработки платежа
    await new Promise((resolve) => setTimeout(resolve, 1500))

    try {
      // Подтверждаем демо-платеж через API
      const res = await fetch(
        `/api/payment/status?device_id=${deviceId}&payment_id=${paymentId}&demo_confirmed=true`
      )
      const data = await res.json()

      if (data.isPro) {
        setIsSuccess(true)
        localStorage.setItem("pinglass_is_pro", "true")

        // Редирект на главную через 2 секунды
        setTimeout(() => {
          router.push("/")
        }, 2000)
      }
    } catch (error) {
      console.error("Demo payment error:", error)
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    router.push("/")
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Демо-оплата успешна!</h1>
          <p className="text-muted-foreground mb-4">
            Ваш Pro-статус активирован. Перенаправляем вас обратно...
          </p>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        {/* Demo Warning Banner */}
        <div className="mb-6 p-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">Демо-режим</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Это демонстрационная страница оплаты. Реальные деньги списываться не будут.
                Платежная система не настроена.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Card */}
        <div className="bg-card rounded-3xl shadow-2xl overflow-hidden border border-border">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">PinGlass Pro</h1>
                <p className="text-sm text-muted-foreground">AI-фотопортреты</p>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-border">
              <span className="text-muted-foreground">Пакет</span>
              <span className="font-medium text-foreground capitalize">{tier} ({photos} фото)</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border">
              <span className="text-muted-foreground">Сумма</span>
              <span className="text-2xl font-bold text-foreground">{amount} ₽</span>
            </div>

            {/* Fake Card Details */}
            <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <CreditCard className="w-4 h-4" />
                <span>Данные карты (демо)</span>
              </div>
              <div className="grid gap-3">
                <input
                  type="text"
                  placeholder="4242 4242 4242 4242"
                  disabled
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground cursor-not-allowed opacity-60"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="12/25"
                    disabled
                    className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground cursor-not-allowed opacity-60"
                  />
                  <input
                    type="text"
                    placeholder="123"
                    disabled
                    className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground cursor-not-allowed opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Безопасная демо-транзакция</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <button
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Подтвердить демо-оплату
                  </>
                )}
              </button>

              <button
                onClick={handleCancel}
                disabled={isProcessing}
                className="w-full py-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          ID платежа: {paymentId?.slice(0, 20)}...
        </p>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
}

export default function DemoPaymentPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DemoPaymentContent />
    </Suspense>
  )
}
