"use client"

import type React from "react"
import { useState, useCallback, useRef } from "react"
import { ArrowLeft, Plus, X, Loader2, Sparkles, Camera } from "lucide-react"
import type { Persona, ReferencePhoto } from "./types"

export interface AvatarDetailViewProps {
  persona: Persona
  referencePhotos: ReferencePhoto[]
  onBack: () => void
  onGoToResults: () => void
  onAddPhotos: (files: File[]) => Promise<void>
  onDeletePhoto: (photoId: number) => Promise<void>
  onStartGeneration: () => void
  onUpdateName?: (name: string) => void
  isLoading?: boolean
  telegramUserId?: number
  isGenerating?: boolean
}

export const AvatarDetailView: React.FC<AvatarDetailViewProps> = ({
  persona,
  referencePhotos,
  onBack,
  onGoToResults,
  onAddPhotos,
  onDeletePhoto,
  onStartGeneration,
  onUpdateName,
  isLoading = false,
  isGenerating = false,
}) => {
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MIN_PHOTOS = 5
  const MAX_PHOTOS = 20
  const hasGeneratedPhotos = persona.generatedAssets.length > 0
  const hasActiveGeneration = persona.status === "processing" || isGenerating
  const canGenerate = referencePhotos.length >= MIN_PHOTOS
  const progress = Math.min(100, (referencePhotos.length / MAX_PHOTOS) * 100)

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return

      setIsUploading(true)
      try {
        await onAddPhotos(files)
      } finally {
        setIsUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [onAddPhotos]
  )

  const handleDelete = useCallback(
    async (photoId: number) => {
      setDeletingIds((prev) => new Set(prev).add(photoId))
      try {
        await onDeletePhoto(photoId)
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev)
          next.delete(photoId)
          return next
        })
      }
    },
    [onDeletePhoto]
  )

  const handleAction = () => {
    if (hasGeneratedPhotos || hasActiveGeneration) {
      onGoToResults()
    } else if (canGenerate) {
      onStartGeneration()
    }
  }

  const getButtonText = () => {
    if (hasActiveGeneration) {
      return "Смотреть прогресс генерации"
    }
    if (hasGeneratedPhotos) {
      return `Смотреть результат (${persona.generatedAssets.length})`
    }
    return "Сгенерировать"
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      {/* Header - matching UploadView */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center hover:bg-muted active:bg-muted/80 rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95 touch-manipulation"
          aria-label="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <input
            value={persona.name}
            onChange={(e) => onUpdateName?.(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none p-0 focus:ring-0 outline-none w-full"
            placeholder="Название аватара..."
            aria-label="Название аватара"
          />
          <div className="flex items-center gap-2 mt-1">
            <div
              className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]"
              role="progressbar"
              aria-valuenow={referencePhotos.length}
              aria-valuemin={0}
              aria-valuemax={MAX_PHOTOS}
            >
              <div
                className={"h-full transition-all duration-500 " + (canGenerate ? "bg-green-500" : "bg-primary")}
                style={{ width: progress + "%" }}
              />
            </div>
            <span className={"text-xs " + (canGenerate ? "text-green-600 font-medium" : "text-muted-foreground")}>
              {referencePhotos.length}/{MAX_PHOTOS} фото
            </span>
          </div>
        </div>
      </div>

      {/* Tips block - matching UploadView */}
      <div className="p-4 glass rounded-2xl hover-lift">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 hover-glow transition-all">
            <Camera className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Советы для лучшего результата</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>- Хорошее освещение лица</li>
              <li>- Разные ракурсы и выражения</li>
              <li>- Без солнечных очков и головных уборов</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Photos grid - matching UploadView responsive columns */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3 px-0.5">
          {/* Add photo button */}
          {referencePhotos.length < MAX_PHOTOS && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 active:border-primary/60 hover:bg-muted/50 active:bg-muted/70 transition-all flex flex-col items-center justify-center gap-1.5 group touch-manipulation min-h-[80px] hover-lift active-press"
              aria-label="Добавить фото"
            >
              {isUploading ? (
                <Loader2 className="w-7 h-7 sm:w-6 sm:h-6 animate-spin text-primary" />
              ) : (
                <>
                  <Plus className="w-7 h-7 sm:w-6 sm:h-6 text-muted-foreground group-hover:text-primary" />
                  <span className="text-[11px] sm:text-[10px] text-muted-foreground font-medium">Добавить</span>
                </>
              )}
            </button>
          )}

          {/* Photos */}
          {referencePhotos.map((photo) => (
            <div
              key={photo.id}
              className="aspect-square rounded-xl bg-muted overflow-hidden relative group min-h-[80px] hover-scale transition-all"
            >
              <img
                src={photo.imageUrl}
                alt="Reference"
                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                loading="lazy"
              />
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={deletingIds.has(photo.id)}
                className="absolute top-1.5 right-1.5 w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-red-500 active:bg-red-600 rounded-lg text-white opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
                aria-label="Удалить фото"
              >
                {deletingIds.has(photo.id) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Fixed bottom button - matching UploadView */}
      <div className="fixed bottom-0 left-0 right-0 p-4 glass-strong border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
        <button
          onClick={handleAction}
          disabled={!canGenerate && !hasActiveGeneration && !hasGeneratedPhotos}
          className="w-full sm:w-auto btn-premium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {hasActiveGeneration ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {getButtonText()}
        </button>
        {!canGenerate && !hasActiveGeneration && !hasGeneratedPhotos && (
          <p className="text-xs text-center text-muted-foreground mt-2 sm:hidden">
            Нужно ещё {MIN_PHOTOS - referencePhotos.length} фото
          </p>
        )}
      </div>
    </div>
  )
}

export default AvatarDetailView
