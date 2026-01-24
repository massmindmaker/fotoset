"use client"

import { useState } from "react"
import { Loader2, Sparkles, X, Download, AlertCircle, Check, Save } from "lucide-react"
import type { TestBlock as TestBlockType, TestResult } from "@/lib/admin/types"

/**
 * PartnerTestBlock Component
 *
 * Adapted from admin TestBlock for partner pack testing
 * Saves prompts directly to the partner's current pack
 */

interface PartnerTestBlockProps {
  block: TestBlockType
  packId: number
  referenceImages: string[] // base64 URLs
  onUpdate: (id: string, updates: Partial<TestBlockType>) => void
  onRemove: (id: string) => void
  onPromptSaved?: (promptId: number) => void
  isOnlyBlock?: boolean
}

export function PartnerTestBlock({
  block,
  packId,
  referenceImages,
  onUpdate,
  onRemove,
  onPromptSaved,
  isOnlyBlock = false,
}: PartnerTestBlockProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedPromptId, setSavedPromptId] = useState<number | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(block.id, { prompt: e.target.value })
    setSavedPromptId(null)
  }

  const handlePhotoCountChange = (count: 1 | 2 | 3 | 4) => {
    onUpdate(block.id, { photoCount: count })
  }

  const handleGenerate = async () => {
    if (!block.prompt.trim() || referenceImages.length === 0) {
      alert("Введите промпт и загрузите референсные изображения")
      return
    }

    setIsGenerating(true)
    onUpdate(block.id, { status: "generating", startedAt: Date.now() })
    setSavedPromptId(null)

    try {
      // Use the partner test endpoint
      const response = await fetch("/api/partner/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImages,
          prompt: block.prompt,
          photoCount: block.photoCount,
          aspectRatio: "3:4",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.userMessage || errorData.message || "Ошибка генерации")
      }

      const data = await response.json()

      if (data.success) {
        onUpdate(block.id, {
          status: "completed",
          results: data.results,
          completedAt: Date.now(),
        })
      } else {
        throw new Error(data.error?.userMessage || "Генерация не удалась")
      }
    } catch (error) {
      console.error("[PartnerTestBlock] Generation error:", error)
      onUpdate(block.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveToPack = async () => {
    if (!block.prompt.trim() || !block.results?.length) return

    try {
      setIsSaving(true)
      const telegramUserId = localStorage.getItem("pinglass_telegram_user_id")

      const response = await fetch(`/api/partner/packs/${packId}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: telegramUserId ? parseInt(telegramUserId) : undefined,
          prompt: block.prompt,
          previewUrl: block.results[selectedImageIndex]?.imageUrl || block.results[0]?.imageUrl,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to save prompt")
      }

      const data = await response.json()
      setSavedPromptId(data.prompt.id)
      onPromptSaved?.(data.prompt.id)
    } catch (error) {
      console.error("[PartnerTestBlock] Save error:", error)
      alert("Ошибка сохранения промпта в пак")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement("a")
    link.href = imageUrl
    link.download = `test-${block.id}-${index + 1}.jpg`
    link.click()
  }

  const totalLatency = block.results
    ? block.results.reduce((sum, r) => sum + r.latency, 0)
    : 0
  const avgLatency = block.results ? totalLatency / block.results.length : 0

  const hasResults = block.status === "completed" && block.results && block.results.length > 0

  return (
    <div className="bg-card rounded-xl p-6 border shadow-sm relative">
      {/* Remove button */}
      {!isOnlyBlock && (
        <button
          onClick={() => onRemove(block.id)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
          aria-label="Удалить блок"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="space-y-4">
        {/* Prompt input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Промпт
          </label>
          <textarea
            value={block.prompt}
            onChange={handlePromptChange}
            disabled={block.status === "generating"}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-background border text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Portrait of a person in natural lighting, professional photography..."
          />
        </div>

        {/* Photo count selector */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Количество фото
          </label>
          <div className="flex gap-2">
            {([1, 2, 3, 4] as const).map((count) => (
              <button
                key={count}
                onClick={() => handlePhotoCountChange(count)}
                disabled={block.status === "generating"}
                className={
                  "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed " +
                  (block.photoCount === count
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80")
                }
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={
            !block.prompt.trim() ||
            referenceImages.length === 0 ||
            isGenerating
          }
          className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Генерация... {block.startedAt && `(${Math.floor((Date.now() - block.startedAt) / 1000)}s)`}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Генерировать
            </>
          )}
        </button>

        {/* Error message */}
        {block.status === "failed" && block.error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">
                  {block.error}
                </p>
                <button
                  onClick={handleGenerate}
                  className="mt-2 text-xs text-destructive underline hover:no-underline"
                >
                  Попробовать снова
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results gallery */}
        {hasResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Результаты ({block.results!.length} фото)
              </p>
              <p className="text-xs text-muted-foreground">
                Среднее время: {(avgLatency / 1000).toFixed(1)}s
              </p>
            </div>

            {/* Image selection hint */}
            {block.results!.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Выберите фото для сохранения (активно: #{selectedImageIndex + 1})
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {block.results!.map((result, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`aspect-[3/4] rounded-lg bg-muted overflow-hidden relative group cursor-pointer transition-all ${
                    selectedImageIndex === index
                      ? "ring-2 ring-primary ring-offset-2"
                      : "hover:ring-2 hover:ring-muted-foreground/50"
                  }`}
                >
                  <img
                    src={result.imageUrl}
                    alt={`Result ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Selection indicator */}
                  {selectedImageIndex === index && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  {/* Download overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(result.imageUrl, index)
                      }}
                      className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium flex items-center gap-2 backdrop-blur-sm"
                    >
                      <Download className="w-4 h-4" />
                      Скачать
                    </button>
                  </div>
                  {/* Latency badge */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white font-mono">
                    {(result.latency / 1000).toFixed(1)}s
                  </div>
                </div>
              ))}
            </div>

            {/* Save to pack button */}
            <button
              onClick={handleSaveToPack}
              disabled={isSaving || !!savedPromptId}
              className={`w-full px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                savedPromptId
                  ? "bg-green-500/10 text-green-600 border border-green-500/20"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : savedPromptId ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {savedPromptId ? "Сохранено в пак" : "Сохранить в пак"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
