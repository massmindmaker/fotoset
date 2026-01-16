"use client"

import type React from "react"
import { useRef, useEffect } from "react"
import { ArrowLeft, Camera, Loader2, Plus, Sparkles, X, CheckCircle2 } from "lucide-react"
import type { Persona } from "./types"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface UploadViewProps {
  persona: Persona
  updatePersona: (id: string, data: Partial<Persona>) => void
  onBack: () => void
  onNext: () => void
  isLoading?: boolean
}

export const UploadView: React.FC<UploadViewProps> = ({ persona, updatePersona, onBack, onNext, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // FIX: Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      persona.images.forEach(img => {
        URL.revokeObjectURL(img.previewUrl)
      })
    }
  }, []) // Empty deps: cleanup only on unmount

  const MAX_PHOTOS = 8 // Kie.ai API limit: max 8 reference images

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || typeof window === "undefined") return
    const newImages: Array<{ id: string; file: File; previewUrl: string }> = []
    const MAX_FILE_SIZE = 30 * 1024 * 1024
    const VALID_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]

    // Calculate available slots (silently limit to MAX_PHOTOS)
    const availableSlots = MAX_PHOTOS - persona.images.length
    if (availableSlots <= 0) return

    for (let i = 0; i < e.target.files.length && newImages.length < availableSlots; i++) {
      const file = e.target.files[i]

      if (!VALID_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
        continue // Skip invalid file type
      }

      if (file.size > MAX_FILE_SIZE) {
        continue // Skip large file (>10MB)
      }

      newImages.push({
        id: Math.random().toString(),
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }

    if (newImages.length === 0) return
    const updates: Partial<Persona> = { images: [...persona.images, ...newImages] }
    if (!persona.thumbnailUrl && newImages.length > 0) updates.thumbnailUrl = newImages[0].previewUrl
    updatePersona(persona.id, updates)
  }

  const removeImage = (imgId: string) => {
    const img = persona.images.find((i) => i.id === imgId)
    if (img) URL.revokeObjectURL(img.previewUrl)
    updatePersona(persona.id, { images: persona.images.filter((i) => i.id !== imgId) })
  }

  const MIN_PHOTOS = 5  // Minimum photos required to proceed
  const progress = Math.min(100, (persona.images.length / MAX_PHOTOS) * 100)
  const isReady = persona.images.length >= MIN_PHOTOS
  const isFull = persona.images.length >= MAX_PHOTOS

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
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
            onChange={(e) => updatePersona(persona.id, { name: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none p-0 focus:ring-0 outline-none w-full"
            placeholder="Название аватара..."
            aria-label="Название аватара"
          />
          <div className="flex items-center gap-2 mt-1">
            <Progress
              value={progress}
              className={cn(
                "flex-1 h-2 max-w-[140px] transition-all",
                isReady && "[&>div]:bg-green-500"
              )}
            />
            <div className="flex items-center gap-1">
              {isReady && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              <span className={cn(
                "text-xs transition-colors",
                isReady ? "text-green-600 font-medium" : "text-muted-foreground"
              )}>
                {persona.images.length}/{MAX_PHOTOS} фото
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Info Card - v4 design: warm yellow background with orange accent */}
      <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 shadow-[var(--shadow-sm)]">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5 text-warning-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1.5">Советы для лучшего результата</p>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="text-warning-foreground">•</span>
                <span>Хорошее освещение лица</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-warning-foreground">•</span>
                <span>Разные ракурсы и выражения</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-warning-foreground">•</span>
                <span>Без солнечных очков и головных уборов</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      {/* Photo Grid - v4 design: rounded-lg, better spacing */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {!isFull && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 active:border-primary/60 hover:bg-primary/5 active:bg-primary/10 transition-all flex flex-col items-center justify-center gap-1.5 group touch-manipulation min-h-[80px] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
            aria-label="Добавить фото"
          >
            <Plus className="w-7 h-7 sm:w-6 sm:h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-[11px] sm:text-[10px] text-muted-foreground group-hover:text-primary font-medium transition-colors">Добавить</span>
          </button>
        )}
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
          aria-label="Выбрать файлы"
        />
        {persona.images.map((img) => (
          <div key={img.id} className="aspect-square rounded-lg bg-muted overflow-hidden relative group min-h-[80px] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow">
            <img src={img.previewUrl} alt="" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy" />
            <button
              onClick={() => removeImage(img.id)}
              className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center bg-black/60 hover:bg-destructive active:bg-destructive/90 rounded-full text-white opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
              aria-label="Удалить фото"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {/* Skeleton placeholders для визуализации оставшихся слотов */}
        {!isFull && persona.images.length < MIN_PHOTOS && Array.from({ length: Math.min(3, MIN_PHOTOS - persona.images.length) }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-xl overflow-hidden relative cursor-pointer group"
          >
            <Skeleton className="w-full h-full" />
            <div className="absolute inset-0 flex items-center justify-center opacity-50 group-hover:opacity-80 transition-opacity">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
      {/* Fixed bottom CTA - v4 design */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t border-border/50 sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
        <Button
          onClick={onNext}
          disabled={!isReady || isLoading}
          variant={isReady ? "gradient" : "default"}
          size="xl"
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Загрузка...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Создать
            </>
          )}
        </Button>
        {!isReady && (
          <p className="text-xs text-center text-muted-foreground mt-2 sm:hidden">
            Нужно ещё {MIN_PHOTOS - persona.images.length} фото
          </p>
        )}
      </div>
    </div>
  )
}

export default UploadView
