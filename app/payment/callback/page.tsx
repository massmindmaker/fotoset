"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Loader2, XCircle, Download, ImageIcon, Sparkles } from "lucide-react"

interface GeneratedImage {
  id: number
  status: "pending" | "generating" | "done" | "error"
  url?: string
}

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "generating" | "done" | "error">("checking")
  const [images, setImages] = useState<GeneratedImage[]>(
    Array.from({ length: 23 }, (_, i) => ({ id: i + 1, status: "pending" })),
  )
  const [completedCount, setCompletedCount] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  const startGeneration = useCallback(async () => {
    setStatus("generating")

    // Симулируем генерацию 23 изображений
    for (let i = 0; i < 23; i++) {
      // Устанавливаем текущее изображение как "generating"
      setImages((prev) => prev.map((img, idx) => (idx === i ? { ...img, status: "generating" } : img)))

      // Симуляция времени генерации (в реальности здесь будет вызов API)
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500))

      // Устанавливаем изображение как готовое
      setImages((prev) =>
        prev.map((img, idx) =>
          idx === i
            ? {
                ...img,
                status: "done",
                url: `/placeholder.svg?height=512&width=512&query=AI generated portrait photo ${i + 1}`,
              }
            : img,
        ),
      )
      setCompletedCount(i + 1)
    }

    setStatus("done")
  }, [])

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
          localStorage.setItem("photoset_is_pro", "true")
          // Начинаем генерацию сразу после подтверждения оплаты
          startGeneration()
        } else if (isTestPayment) {
          // В тестовом режиме сразу начинаем генерацию
          localStorage.setItem("photoset_is_pro", "true")
          startGeneration()
        } else {
          setTimeout(checkPayment, 2000)
        }
      } catch {
        setStatus("error")
      }
    }

    checkPayment()
  }, [searchParams, startGeneration])

  const handleDownloadAll = async () => {
    setIsDownloading(true)

    // В реальности здесь будет создание ZIP-архива
    // Пока симулируем задержку
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Создаем фейковый download
    const link = document.createElement("a")
    link.href = "/zip-archive.png"
    link.download = "photoset-ai-images.zip"
    // link.click()

    alert("В демо-режиме скачивание недоступно. В продакшене здесь будет ZIP-архив с 23 изображениями.")

    setIsDownloading(false)
  }

  const isTest = searchParams.get("test") === "true"
  const progress = Math.round((completedCount / 23) * 100)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3 safe-area-top">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold">Photoset AI</span>
          </div>
          {isTest && (
            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
              Тестовый режим
            </span>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Status checking */}
        {status === "checking" && (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin mb-4" />
            <h1 className="text-xl font-semibold mb-2">Проверяем оплату...</h1>
            <p className="text-muted-foreground">Пожалуйста, подождите</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="text-center py-20">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Ошибка оплаты</h1>
            <p className="text-muted-foreground mb-6">Что-то пошло не так</p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
            >
              Вернуться на главную
            </button>
          </div>
        )}

        {/* Generating or Done */}
        {(status === "generating" || status === "done") && (
          <>
            {/* Progress header */}
            <div className="text-center mb-6">
              {status === "generating" ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                  <h1 className="text-xl font-semibold mb-2">Генерируем ваши фото</h1>
                  <p className="text-muted-foreground mb-4">Готово {completedCount} из 23 изображений</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h1 className="text-xl font-semibold mb-2">Все фото готовы!</h1>
                  <p className="text-muted-foreground mb-4">23 уникальных изображения сгенерированы</p>
                </>
              )}

              {/* Progress bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">{progress}%</p>
            </div>

            {/* Image grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-6">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                    image.status === "done"
                      ? "border-green-400 bg-green-50"
                      : image.status === "generating"
                        ? "border-primary bg-primary/5"
                        : image.status === "error"
                          ? "border-red-400 bg-red-50"
                          : "border-muted bg-muted/30"
                  }`}
                >
                  {image.status === "done" && image.url ? (
                    <img
                      src={image.url || "/placeholder.svg"}
                      alt={`Generated ${image.id}`}
                      className="w-full h-full object-cover"
                    />
                  ) : image.status === "generating" ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  ) : image.status === "error" ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-400" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Download button */}
            {status === "done" && (
              <div className="space-y-3">
                <button
                  onClick={handleDownloadAll}
                  disabled={isDownloading}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Создаём архив...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Скачать все (ZIP)
                    </>
                  )}
                </button>

                <button onClick={() => router.push("/")} className="w-full py-3 text-muted-foreground font-medium">
                  Вернуться на главную
                </button>
              </div>
            )}

            {/* Generating info */}
            {status === "generating" && (
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Не закрывайте эту страницу. Генерация может занять несколько минут.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
