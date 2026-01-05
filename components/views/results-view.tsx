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

      {isGenerating && generationProgress.total > 0 && (
        <Card className="p-4 shadow-lg border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">AI генерация</span>
            </div>
            <Progress
              value={(newPhotosInBatch / generationProgress.total) * 100}
              className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent"
            />
            <div className="flex justify-between items-center">
              <p className="text-sm text-foreground font-medium">
                {newPhotosInBatch} / {generationProgress.total} фото
              </p>
              <p className="text-xs text-muted-foreground">
                ~{Math.ceil((generationProgress.total - newPhotosInBatch) * 0.5)} мин
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
              Можете закрыть приложение — пришлём фото в Telegram
            </p>
          </div>
        </Card>
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
                  className="aspect-[3/4] rounded-2xl overflow-hidden relative"
                  role="status"
                  aria-label="Загрузка фото"
                >
                  <Skeleton className="w-full h-full" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-lg">
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
