"use client"

import type React from "react"
import { lazy, Suspense } from "react"
import { ArrowLeft, Loader2, Sparkles } from "lucide-react"
import type { Persona, GenerationProgress } from "./types"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

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

  // For re-generation: calculate new photos generated in THIS batch
  const startCount = generationProgress.startPhotoCount ?? 0
  const newPhotosInBatch = Math.max(0, assets.length - startCount)
  const pendingCount = isGenerating ? Math.max(0, generationProgress.total - newPhotosInBatch) : 0

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
              {newPhotosInBatch} / {generationProgress.total} фото
            </span>
          </div>
        )}
      </div>

      {/* Progress Card - v4 design: gradient background, enhanced styling */}
      {isGenerating && generationProgress.total > 0 && (
        <div className="p-5 rounded-xl shadow-[var(--shadow-lg)] border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-[var(--accent-purple)]/5">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <span className="text-base font-semibold text-foreground">AI генерация</span>
            </div>
            <Progress
              value={(newPhotosInBatch / generationProgress.total) * 100}
              className="h-3 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-[oklch(0.65_0.18_340)] [&>div]:rounded-full"
            />
            <div className="flex justify-between items-center">
              <p className="text-sm text-foreground font-semibold">
                {newPhotosInBatch} / {generationProgress.total} фото
              </p>
              <p className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                ~{Math.ceil((generationProgress.total - newPhotosInBatch) * 0.5)} мин
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center pt-3 border-t border-border/30">
              Можете закрыть приложение — пришлём фото в Telegram
            </p>
          </div>
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
          {/* Skeleton placeholders - v4 design */}
          {pendingCount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: pendingCount }).map((_, i) => (
                <div
                  key={"skeleton-" + i}
                  className="aspect-[3/4] rounded-xl overflow-hidden relative shadow-[var(--shadow-sm)]"
                  role="status"
                  aria-label="Загрузка фото"
                >
                  <Skeleton className="w-full h-full" />
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/10 to-transparent">
                    <div className="w-11 h-11 rounded-full bg-background/90 backdrop-blur-md flex items-center justify-center shadow-[var(--shadow-md)]">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  </div>
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
