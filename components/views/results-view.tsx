"use client"

import type React from "react"
import { lazy, Suspense } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
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

  return (
    <div className="space-y-4 pb-6" aria-busy={isGenerating} aria-live="polite">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          aria-label="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {isGenerating && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 rounded-xl">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium text-primary">
              {assets.length} / {generationProgress.total} фото
            </span>
          </div>
        )}
      </div>

      {isGenerating && generationProgress.total > 0 && (
        <div className="space-y-3 bg-card border border-border rounded-2xl p-4 shadow-lg">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out shimmer"
              style={{ width: (assets.length / generationProgress.total) * 100 + "%" }}
            />
          </div>
          <p className="text-sm text-foreground font-medium text-center animate-pulse">Генерируем ваши фото...</p>
          <p className="text-xs text-muted-foreground text-center">
            Можете закрыть приложение — пришлём фото в Telegram, когда будут готовы
          </p>
        </div>
      )}

      {assets.length === 0 && !isGenerating ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Нет сгенерированных фото</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Suspense fallback={<ComponentLoader />}>
            <ResultsGallery assets={assets} personaName={persona.name} thumbnailUrl={persona.thumbnailUrl} onGenerateMore={onGenerateMore} />
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
