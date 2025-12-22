"use client"

import type React from "react"
import { useState, useCallback, useRef } from "react"
import { ArrowLeft, Plus, X, Loader2, Sparkles, Image as ImageIcon } from "lucide-react"
import type { Persona, ReferencePhoto } from "./types"

export interface AvatarDetailViewProps {
  persona: Persona
  referencePhotos: ReferencePhoto[]
  onBack: () => void
  onGoToResults: () => void
  onAddPhotos: (files: File[]) => Promise<void>
  onDeletePhoto: (photoId: number) => Promise<void>
  onStartGeneration: () => void
  isLoading?: boolean
  telegramUserId?: number
}

export const AvatarDetailView: React.FC<AvatarDetailViewProps> = ({
  persona,
  referencePhotos,
  onBack,
  onGoToResults,
  onAddPhotos,
  onDeletePhoto,
  onStartGeneration,
  isLoading = false,
  telegramUserId,
}) => {
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasGeneratedPhotos = persona.generatedAssets.length > 0
  const canGenerate = referencePhotos.length >= 5

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          aria-label="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">{persona.name}</h1>
        <div className="w-10" />
      </div>

      {/* Thumbnail */}
      <div className="flex justify-center">
        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted border-2 border-border shadow-lg">
          {persona.thumbnailUrl ? (
            <img
              src={persona.thumbnailUrl}
              alt={persona.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {hasGeneratedPhotos && (
          <button
            onClick={onGoToResults}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-2xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            Перейти к фото ({persona.generatedAssets.length})
          </button>
        )}
        {canGenerate && !hasGeneratedPhotos && (
          <button
            onClick={onStartGeneration}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-2xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            Сгенерировать фото
          </button>
        )}
      </div>

      {/* Reference photos section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Референсные фото ({referencePhotos.length}/20)
          </h2>
          {!canGenerate && (
            <span className="text-xs text-amber-500">
              Минимум 5 фото для генерации
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {/* Add photo button */}
            {referencePhotos.length < 20 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="aspect-square rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex items-center justify-center group"
              >
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                ) : (
                  <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </button>
            )}

            {/* Photos grid */}
            {referencePhotos.map((photo) => (
              <div
                key={photo.id}
                className="aspect-square rounded-2xl overflow-hidden bg-muted relative group"
              >
                <img
                  src={photo.imageUrl}
                  alt="Reference"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <button
                  onClick={() => handleDelete(photo.id)}
                  disabled={deletingIds.has(photo.id)}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all active:scale-95 sm:opacity-0 touch:opacity-100"
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
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

export default AvatarDetailView
