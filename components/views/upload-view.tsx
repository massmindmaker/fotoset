"use client"

import type React from "react"
import { useRef } from "react"
import { ArrowLeft, ArrowRight, Camera, Plus, X } from "lucide-react"
import type { Persona } from "./types"

export interface UploadViewProps {
  persona: Persona
  updatePersona: (id: string, data: Partial<Persona>) => void
  onBack: () => void
  onNext: () => void
}

export const UploadView: React.FC<UploadViewProps> = ({ persona, updatePersona, onBack, onNext }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || typeof window === "undefined") return
    const newImages: Array<{ id: string; file: File; previewUrl: string }> = []
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    const VALID_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]

    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i]

      if (!VALID_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
        console.warn(`[Upload] Skipped invalid file type: ${file.name} (${file.type})`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        console.warn(`[Upload] Skipped large file: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`)
        continue
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

  const progress = Math.min(100, (persona.images.length / 20) * 100)
  const isReady = persona.images.length >= 10

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"
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
      <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
        <div className="flex gap-3">
          <Camera className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
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
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-1 group active:scale-95"
          aria-label="Добавить фото"
        >
          <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
          <span className="text-[10px] text-muted-foreground">Добавить</span>
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
          <div key={img.id} className="aspect-square rounded-xl bg-muted overflow-hidden relative group">
            <img src={img.previewUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            <button
              onClick={() => removeImage(img.id)}
              className="absolute top-1 right-1 p-1.5 bg-black/50 hover:bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Удалить фото"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
        <button
          onClick={onNext}
          disabled={!isReady}
          className="w-full sm:w-auto px-6 py-3.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Далее
          <ArrowRight className="w-4 h-4" />
        </button>
        {!isReady && (
          <p className="text-xs text-center text-muted-foreground mt-2 sm:hidden">
            Нужно ещё {10 - persona.images.length} фото
          </p>
        )}
      </div>
    </div>
  )
}

export default UploadView
