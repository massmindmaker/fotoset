"use client"

import type React from "react"
import { useState, lazy, Suspense } from "react"
import { ArrowLeft, Sparkles, Loader2, CheckCircle2, Send } from "lucide-react"
import type { Persona, GenerationProgress } from "./types"

const ResultsGallery = lazy(() => import("../results-gallery"))

const ComponentLoader = () => (
  <div className="flex items-center justify-center py-4">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
)

export interface ResultsViewProps {
  persona: Persona
  onBack: () => void
  onGenerateMore: () => void
  isGenerating: boolean
  generationProgress: GenerationProgress
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  persona,
  onBack,
  onGenerateMore,
  isGenerating,
  generationProgress,
}) => {
  const assets = [...persona.generatedAssets].sort((a, b) => b.createdAt - a.createdAt)
  const pendingCount = isGenerating ? Math.max(0, generationProgress.total - assets.length) : 0
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false)
  const [telegramSent, setTelegramSent] = useState(false)

  const sendToTelegram = async () => {
    if (assets.length === 0 || isSendingToTelegram) return

    setIsSendingToTelegram(true)
    try {
      const tg =
        typeof window !== "undefined"
          ? (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } })
              .Telegram?.WebApp
          : null
      const telegramUserId = tg?.initDataUnsafe?.user?.id

      const response = await fetch("/api/telegram/send-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          photoUrls: assets.map((a) => a.url),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setTelegramSent(true)
        setTimeout(() => setTelegramSent(false), 5000)
      } else {
        alert(data.error || "Не удалось отправить фото")
      }
    } catch (error) {
      console.error("Failed to send to Telegram:", error)
      alert("Ошибка отправки в Telegram")
    } finally {
      setIsSendingToTelegram(false)
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={isGenerating}
          className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95 disabled:opacity-50"
          aria-label="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {isGenerating ? (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 rounded-xl">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium text-primary">
              {assets.length} / {generationProgress.total} фото
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={sendToTelegram}
              disabled={isSendingToTelegram || assets.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-[#0088cc]/25 disabled:opacity-50 hover-lift active-press"
              aria-label="Отправить в Telegram"
            >
              {isSendingToTelegram ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : telegramSent ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{telegramSent ? "Отправлено!" : "В Telegram"}</span>
            </button>
            <button
              onClick={onGenerateMore}
              className="flex items-center gap-2 btn-premium text-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ещё</span>
            </button>
          </div>
        )}
      </div>

      {isGenerating && generationProgress.total > 0 && (
        <div className="space-y-2 glass rounded-2xl p-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out shimmer"
              style={{ width: (assets.length / generationProgress.total) * 100 + "%" }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center animate-pulse">Генерируем ваши фото...</p>
        </div>
      )}

      {assets.length === 0 && !isGenerating ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Нет сгенерированных фото</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Suspense fallback={<ComponentLoader />}>
            <ResultsGallery assets={assets} personaName={persona.name} thumbnailUrl={persona.thumbnailUrl} />
          </Suspense>
          {pendingCount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: pendingCount }).map((_, i) => (
                <div
                  key={"skeleton-" + i}
                  className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-muted to-muted/50 shimmer flex items-center justify-center border border-border/50"
                  role="status"
                  aria-label="Загрузка фото"
                >
                  <Loader2 className="w-6 h-6 text-muted-foreground/50 animate-spin" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ResultsView
