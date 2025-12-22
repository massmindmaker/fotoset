"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react"
import { createPollingController } from "@/components/hooks/usePolling"

// Max polling attempts: 60 seconds for normal, 30 seconds for test/demo
const MAX_ATTEMPTS_NORMAL = 30 // 30 attempts * 2s = 60 seconds
const MAX_ATTEMPTS_FAST = 30   // 30 attempts * 1s = 30 seconds

function PaymentCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error" | "timeout">("loading")

  useEffect(() => {
    // Telegram-only authentication
    const telegramUserId = searchParams.get("telegram_user_id")
    const paymentId = searchParams.get("payment_id")
    const tier = searchParams.get("tier") || "premium"
    const isTestPayment = searchParams.get("test") === "true"
    const isDemoPayment = paymentId?.startsWith("demo_")
    const isFastMode = isTestPayment || isDemoPayment

    // Require telegramUserId
    if (!telegramUserId) {
      setStatus("error")
      return
    }

    const pollingController = createPollingController()

    pollingController.start(
      'payment-status',
      async () => {
        try {
          // Build URL with telegram_user_id
          let url = `/api/payment/status?telegram_user_id=${telegramUserId}`
          if (paymentId) url += `&payment_id=${paymentId}`
          if (isTestPayment) url += "&test=true"
          if (isDemoPayment) url += "&demo_confirmed=true"

          const res = await fetch(url)
          const data = await res.json()

          if (data.paid) {
            pollingController.stop('payment-status')
            setStatus("success")
            // Перенаправляем обратно для начала генерации с флагом
            // FIX: Pass telegram_user_id so auth can work after external redirect
            // FIX: Increased delay 2s→4s for DB replication
            setTimeout(() => {
              let redirectUrl = "/?resume_payment=true"
              if (telegramUserId) {
                redirectUrl += `&telegram_user_id=${telegramUserId}`
              }
              redirectUrl += `&tier=${tier}`
              router.push(redirectUrl)
            }, 4000)
          }
        } catch (err) {
          console.error("[Callback] Payment check error:", err)
          pollingController.stop('payment-status')
          setStatus("error")
        }
      },
      {
        intervalMs: isFastMode ? 1000 : 2000,
        maxAttempts: isFastMode ? MAX_ATTEMPTS_FAST : MAX_ATTEMPTS_NORMAL,
        onTimeout: () => {
          console.error("[Callback] Max polling attempts reached")
          setStatus("timeout")
        },
      }
    )

    return () => {
      pollingController.stopAll()
    }
  }, [searchParams, router])

  const isTest = searchParams.get("test") === "true"
  const isDemo = searchParams.get("payment_id")?.startsWith("demo_")

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        {(isTest || isDemo) && (
          <div className="mb-4 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full inline-block">
            {isDemo ? "Демо-режим" : "Тестовый режим"}
          </div>
        )}

        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin mb-4" />
            <h1 className="text-xl font-semibold mb-2">Проверяем оплату...</h1>
            <p className="text-muted-foreground">Пожалуйста, подождите</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Оплата успешна!</h1>
            <p className="text-muted-foreground">Перенаправляем вас обратно...</p>
          </>
        )}

        {status === "timeout" && (
          <>
            <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Оплата обрабатывается</h1>
            <p className="text-muted-foreground mb-4">
              Платёж ещё не подтверждён. Это может занять несколько минут.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl"
              >
                Проверить снова
              </button>
              <button
                onClick={() => router.push("/")}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl"
              >
                На главную
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Ошибка оплаты</h1>
            <p className="text-muted-foreground mb-4">Что-то пошло не так</p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl"
            >
              Вернуться на главную
            </button>
          </>
        )}
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

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentCallbackContent />
    </Suspense>
  )
}
