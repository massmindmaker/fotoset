"use client"

import type React from "react"
import { useRef } from "react"
import { ArrowLeft, Camera, Loader2, Plus, Sparkles, X } from "lucide-react"
import type { Persona } from "./types"

export interface UploadViewProps {
  persona: Persona
  updatePersona: (id: string, data: Partial<Persona>) => void
  onBack: () => void
  onNext: () => void
  isLoading?: boolean
}

export const UploadView: React.FC<UploadViewProps> = ({ persona, updatePersona, onBack, onNext, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || typeof window === "undefined") return
    const newImages: Array<{ id: string; file: File; previewUrl: string }> = []
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    const VALID_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]

    for (let i = 0; i < e.target.files.length; i++) {
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
  const progress = Math.min(100, (persona.images.length / 20) * 100)
  const isReady = persona.images.length >= MIN_PHOTOS

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
            <div
              className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]"
              role="progressbar"
              aria-valuenow={persona.images.length}
              aria-valuemin={0}
              aria-valuemax={20}
            >
              <div
                className={"h-full transition-all duration-500 " + (isReady ? "bg-green-500" : "bg-primary")}
                style={{ width: progress + "%" }}
              />
            </div>
            <span className={"text-xs " + (isReady ? "text-green-600 font-medium" : "text-muted-foreground")}>
              {persona.images.length}/20 фото
            </span>
          </div>
        </div>
      </div>
      <div className="p-4 glass rounded-2xl hover-lift">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 hover-glow transition-all">
            <Camera className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Советы для лучшего результата</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Хорошее освещение лица</li>
              <li>• Разные ракурсы и выражения</li>
              <li>• Без солнечных очков и головных уборов</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 active:border-primary/60 hover:bg-muted/50 active:bg-muted/70 transition-all flex flex-col items-center justify-center gap-1.5 group touch-manipulation min-h-[80px] hover-lift active-press"
          aria-label="Добавить фото"
        >
          <Plus className="w-7 h-7 sm:w-6 sm:h-6 text-muted-foreground group-hover:text-primary" />
          <span className="text-[11px] sm:text-[10px] text-muted-foreground font-medium">Добавить</span>
        </button>
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
          <div key={img.id} className="aspect-square rounded-xl bg-muted overflow-hidden relative group min-h-[80px] hover-scale transition-all">
            <img src={img.previewUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" loading="lazy" />
            <button
              onClick={() => removeImage(img.id)}
              className="absolute top-1.5 right-1.5 w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-red-500 active:bg-red-600 rounded-lg text-white opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
              aria-label="Удалить фото"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 glass-strong border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
        <button
          onClick={onNext}
          disabled={!isReady || isLoading}
          className="w-full sm:w-auto btn-premium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Сгенерировать фото
            </>
          )}
        </button>
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
