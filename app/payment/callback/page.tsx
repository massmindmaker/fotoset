"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

function PaymentCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  useEffect(() => {
    const checkPayment = async () => {
      const deviceId = searchParams.get("device_id")
      const paymentId = searchParams.get("payment_id")
      const isTestPayment = searchParams.get("test") === "true"
      const isDemoPayment = paymentId?.startsWith("demo_")

      if (!deviceId) {
        setStatus("error")
        return
      }

      try {
        // Для демо-платежей добавляем флаг подтверждения
        let url = `/api/payment/status?device_id=${deviceId}`
        if (paymentId) url += `&payment_id=${paymentId}`
        if (isTestPayment) url += "&test=true"
        if (isDemoPayment) url += "&demo_confirmed=true"

        const res = await fetch(url)
        const data = await res.json()

        if (data.paid) {
          setStatus("success")
          // Перенаправляем обратно для начала генерации с флагом
          setTimeout(() => {
            router.push("/?resume_payment=true")
          }, 2000)
        } else if (isTestPayment || isDemoPayment) {
          setTimeout(checkPayment, 1000)
        } else {
          setTimeout(checkPayment, 2000)
        }
      } catch {
        setStatus("error")
      }
    }

    checkPayment()
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
