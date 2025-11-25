"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  useEffect(() => {
    const checkPayment = async () => {
      const deviceId = searchParams.get("device_id")
      const paymentId = searchParams.get("payment_id")
      const isTestPayment = searchParams.get("test") === "true"

      if (!deviceId) {
        setStatus("error")
        return
      }

      try {
        const url = `/api/payment/status?device_id=${deviceId}${paymentId ? `&payment_id=${paymentId}` : ""}${isTestPayment ? "&test=true" : ""}`
        const res = await fetch(url)
        const data = await res.json()

        if (data.isPro) {
          setStatus("success")
          localStorage.setItem("photoset_is_pro", "true")
          setTimeout(() => {
            router.push("/")
          }, 2000)
        } else if (isTestPayment) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        {isTest && (
          <div className="mb-4 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full inline-block">
            Тестовый режим
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
