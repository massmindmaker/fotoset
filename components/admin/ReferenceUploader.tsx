"use client"

import { useRef } from "react"
import { Plus, X, Image as ImageIcon } from "lucide-react"
import type { ReferenceImage } from "@/lib/admin/types"

/**
 * ReferenceUploader Component
 *
 * Upload 5-10 reference images for KIE AI prompt testing
 *
 * Features:
 * - Drag-n-drop file input
 * - Photo preview grid (3-5 columns)
 * - Delete button per photo
 * - Progress indicator (X/10 photos)
 * - File validation (JPEG/PNG/WebP, max 10MB)
 *
 * Reuses patterns from: components/views/upload-view.tsx
 */

interface ReferenceUploaderProps {
  images: ReferenceImage[]
  onImagesChange: (images: ReferenceImage[]) => void
  minPhotos?: number
  maxPhotos?: number
}

export function ReferenceUploader({
  images,
  onImagesChange,
  minPhotos = 5,
  maxPhotos = 10,
}: ReferenceUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || typeof window === "undefined") return

    const newImages: ReferenceImage[] = []
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"]

    // Check if we can add more photos
    const availableSlots = maxPhotos - images.length
    if (availableSlots <= 0) {
      alert(`Максимум ${maxPhotos} фото`)
      return
    }

    for (let i = 0; i < Math.min(e.target.files.length, availableSlots); i++) {
      const file = e.target.files[i]

      // Validate file type
      if (!VALID_TYPES.includes(file.type) && !file.name.match(/\\.(jpg|jpeg|png|webp)$/i)) {
        console.warn(`[ReferenceUploader] Skipping invalid file type: ${file.name}`)
        continue
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`[ReferenceUploader] Skipping large file (>10MB): ${file.name}`)
        continue
      }

      newImages.push({
        id: `${Date.now()}-${i}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }

    if (newImages.length === 0) return

    onImagesChange([...images, ...newImages])

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeImage = (imgId: string) => {
    const img = images.find((i) => i.id === imgId)
    if (img) {
      URL.revokeObjectURL(img.previewUrl)
    }
    onImagesChange(images.filter((i) => i.id !== imgId))
  }

  const progress = Math.min(100, (images.length / maxPhotos) * 100)
  const isReady = images.length >= minPhotos
  const isFull = images.length >= maxPhotos

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Референсные изображения
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Загрузите {minPhotos}-{maxPhotos} фото для генерации
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-24 h-1.5 bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={images.length}
            aria-valuemin={0}
            aria-valuemax={maxPhotos}
          >
            <div
              className={
                "h-full transition-all duration-500 " +
                (isReady ? "bg-green-500" : "bg-primary")
              }
              style={{ width: `${progress}%` }}
            />
          </div>
          <span
            className={
              "text-xs font-medium " +
              (isReady ? "text-green-600" : "text-muted-foreground")
            }
          >
            {images.length}/{maxPhotos}
          </span>
        </div>
      </div>

      {/* Tips */}
      <div className="p-3 glass rounded-xl border border-border">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ImageIcon className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-1">
              Советы для лучшего результата
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• Хорошее освещение лица</li>
              <li>• Разные ракурсы и выражения</li>
              <li>• Без солнечных очков и головных уборов</li>
              <li>• Форматы: JPEG, PNG, WebP (макс. 10MB)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {/* Upload button */}
        {!isFull && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 active:border-primary/60 hover:bg-muted/50 active:bg-muted/70 transition-all flex flex-col items-center justify-center gap-1.5 group touch-manipulation min-h-[100px] hover-lift active-press"
            aria-label="Добавить фото"
          >
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
            <span className="text-xs text-muted-foreground font-medium">
              Добавить
            </span>
          </button>
        )}

        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
          aria-label="Выбрать файлы"
        />

        {/* Image previews */}
        {images.map((img) => (
          <div
            key={img.id}
            className="aspect-square rounded-xl bg-muted overflow-hidden relative group min-h-[100px] hover-scale transition-all"
          >
            <img
              src={img.previewUrl}
              alt=""
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
              loading="lazy"
            />
            <button
              onClick={() => removeImage(img.id)}
              className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center bg-black/60 hover:bg-red-500 active:bg-red-600 rounded-lg text-white opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
              aria-label="Удалить фото"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Status message */}
      {!isReady && images.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Нужно ещё {minPhotos - images.length} фото для начала тестирования
        </p>
      )}

      {isReady && (
        <p className="text-xs text-center text-green-600 font-medium">
          ✓ Готово! Можно начинать тестирование промптов
        </p>
      )}
    </div>
  )
}
