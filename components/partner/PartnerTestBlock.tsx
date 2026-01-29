"use client"

import { useState, useEffect } from "react"
import { Loader2, Sparkles, X, Download, AlertCircle, FolderPlus, Check, Image as ImageIcon } from "lucide-react"

/**
 * PartnerTestBlock Component
 *
 * Single prompt testing block for partners
 * Similar to admin TestBlock but with:
 * - "Add to pack" button that saves prompt + preview to pack
 * - Quota awareness
 */

interface TestResult {
  imageUrl: string
  latency: number
  taskId: string
  aspectRatio?: string
}

interface TestBlock {
  id: string
  prompt: string
  photoCount: 1 | 2 | 3 | 4
  status: 'idle' | 'generating' | 'completed' | 'failed'
  results?: TestResult[]
  error?: string
  startedAt?: number
  completedAt?: number
}

interface PartnerTestBlockProps {
  block: TestBlock
  referenceImages: string[] // base64 URLs
  onUpdate: (id: string, updates: Partial<TestBlock>) => void
  onRemove: (id: string) => void
  isOnlyBlock?: boolean
  onAddToPack?: (prompt: string, previewUrl: string) => void
  quotaRemaining?: number
  onQuotaUpdate?: (newRemaining: number) => void
}

export function PartnerTestBlock({
  block,
  referenceImages,
  onUpdate,
  onRemove,
  isOnlyBlock = false,
  onAddToPack,
  quotaRemaining = 200,
  onQuotaUpdate,
}: PartnerTestBlockProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [addedToPack, setAddedToPack] = useState(false)

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(block.id, { prompt: e.target.value })
    setAddedToPack(false)
  }

  const handlePhotoCountChange = (count: 1 | 2 | 3 | 4) => {
    onUpdate(block.id, { photoCount: count })
  }

  const handleGenerate = async () => {
    if (!block.prompt.trim() || referenceImages.length === 0) {
      alert("Введите промпт и загрузите референсные изображения")
      return
    }

    if (block.photoCount > quotaRemaining) {
      alert(`Недостаточно генераций. Осталось: ${quotaRemaining}, запрошено: ${block.photoCount}`)
      return
    }

    setIsGenerating(true)
    onUpdate(block.id, { status: "generating", startedAt: Date.now() })
    setAddedToPack(false)

    try {
      const response = await fetch("/api/partner/test-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          referenceImages,
          prompt: block.prompt,
          photoCount: block.photoCount,
          aspectRatio: "3:4",
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        // Handle middleware auth error (returns {error: "Unauthorized"})
        if (data.error === "Unauthorized") {
          throw new Error("Сессия истекла. Пожалуйста, войдите заново.")
        }
        throw new Error(data.error?.userMessage || data.message || data.error || "Ошибка генерации")
      }

      onUpdate(block.id, {
        status: "completed",
        results: data.results,
        completedAt: Date.now(),
      })

      // Update quota if callback provided
      if (onQuotaUpdate && data.quota) {
        onQuotaUpdate(data.quota.remaining)
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

  const handleAddToPack = () => {
    if (!block.results?.length || !onAddToPack) return

    const selectedImage = block.results[selectedImageIndex] || block.results[0]
    onAddToPack(block.prompt, selectedImage.imageUrl)
    setAddedToPack(true)
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
  const canGenerate = block.prompt.trim() && referenceImages.length >= 5 && !isGenerating && block.photoCount <= quotaRemaining

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative">
      {/* Remove button */}
      {!isOnlyBlock && (
        <button
          onClick={() => onRemove(block.id)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
          aria-label="Удалить блок"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="space-y-4">
        {/* Prompt input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Промпт
          </label>
          <textarea
            value={block.prompt}
            onChange={handlePromptChange}
            disabled={block.status === "generating"}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Например: Professional portrait in studio lighting, elegant pose..."
          />
        </div>

        {/* Photo count selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Количество фото
          </label>
          <div className="flex gap-2">
            {([1, 2, 3, 4] as const).map((count) => (
              <button
                key={count}
                onClick={() => handlePhotoCountChange(count)}
                disabled={block.status === "generating" || count > quotaRemaining}
                className={
                  "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed " +
                  (block.photoCount === count
                    ? "bg-pink-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700")
                }
              >
                {count}
              </button>
            ))}
          </div>
          {quotaRemaining < 4 && (
            <p className="text-xs text-amber-600 mt-1">
              Осталось {quotaRemaining} генераций
            </p>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700">
                  {block.error}
                </p>
                <button
                  onClick={handleGenerate}
                  className="mt-2 text-xs text-red-600 underline hover:no-underline"
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
              <p className="text-sm font-medium text-slate-800">
                Результаты ({block.results!.length} фото)
              </p>
              <p className="text-xs text-slate-500">
                Среднее время: {(avgLatency / 1000).toFixed(1)}s
              </p>
            </div>

            {/* Image selection hint */}
            {block.results!.length > 1 && (
              <p className="text-xs text-slate-500">
                Выберите фото для добавления в пак (активно: #{selectedImageIndex + 1})
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {block.results!.map((result, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`aspect-[3/4] rounded-lg bg-slate-100 overflow-hidden relative group cursor-pointer transition-all ${
                    selectedImageIndex === index
                      ? "ring-2 ring-pink-500 ring-offset-2"
                      : "hover:ring-2 hover:ring-slate-300"
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
                    <div className="absolute top-2 right-2 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
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

            {/* Add to pack button */}
            {onAddToPack && (
              <button
                onClick={handleAddToPack}
                disabled={addedToPack}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                  addedToPack
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200"
                }`}
              >
                {addedToPack ? (
                  <>
                    <Check className="w-4 h-4" />
                    Добавлено в пак
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    Добавить в пак
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
