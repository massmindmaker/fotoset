"use client"

import type React from "react"
import { useState, useRef } from "react"
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  ImageIcon,
  Download,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  User,
  Camera,
  Briefcase,
  Palette,
  Lock,
} from "lucide-react"

// --- TYPES ---
export interface UploadedImage {
  id: string
  previewUrl: string
  base64: string
  mimeType: string
}

export interface GeneratedAsset {
  id: string
  type: "PHOTO"
  url: string
  styleId: string
  createdAt: number
}

export interface Persona {
  id: string
  name: string
  status: "draft" | "ready" | "processing"
  thumbnailUrl?: string
  images: UploadedImage[]
  generatedAssets: GeneratedAsset[]
}

export interface StylePreset {
  id: string
  name: string
  description: string
  imageUrl: string
  prompt: string
  icon: React.ReactNode
}

export type ViewState =
  | { view: "DASHBOARD" }
  | { view: "CREATE_PERSONA_UPLOAD"; personaId: string }
  | { view: "SELECT_STYLE"; personaId: string }
  | { view: "RESULTS"; personaId: string }

const STYLE_PRESETS: StylePreset[] = [
  {
    id: "professional-headshot",
    name: "Профессиональный портрет",
    description: "Деловой портрет для LinkedIn и резюме",
    imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=600",
    icon: <Briefcase className="w-5 h-5" />,
    prompt: `Professional corporate headshot portrait photography.
Subject wearing a tailored navy blue suit with a crisp white dress shirt.
Soft, diffused studio lighting from 45-degree angle creating gentle shadows.
Clean gradient background transitioning from light gray to white.
Shot on Canon EOS R5 with 85mm f/1.4 lens at f/2.8.
Sharp focus on eyes with natural skin texture preserved.
Confident, approachable expression with slight smile.
Color grading: neutral tones with subtle warmth.
Resolution: 8K, professional retouching maintaining natural appearance.
Composition: head and shoulders, rule of thirds positioning.`,
  },
  {
    id: "lifestyle-casual",
    name: "Lifestyle портрет",
    description: "Естественный портрет для социальных сетей",
    imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=600",
    icon: <Camera className="w-5 h-5" />,
    prompt: `Natural lifestyle portrait photography in urban environment.
Subject in casual premium clothing: high-quality cotton t-shirt, minimal accessories.
Golden hour natural lighting, sun positioned behind subject creating rim light.
Modern city cafe or co-working space background with bokeh effect.
Shot on Sony A7IV with 50mm f/1.2 lens at f/1.8.
Candid, relaxed pose as if caught mid-conversation.
Warm color palette with teal and orange color grading.
Authentic expression showing genuine personality.
Film grain overlay for organic texture.
Resolution: 4K, minimal editing preserving natural skin tones.
Environmental portrait style with context and story.`,
  },
  {
    id: "creative-artistic",
    name: "Креативный портрет",
    description: "Художественный портрет для творческих проектов",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600",
    icon: <Palette className="w-5 h-5" />,
    prompt: `High-fashion editorial portrait photography.
Subject with bold, confident expression and dynamic pose.
Dramatic studio lighting: key light with strong contrast, accent rim light.
Minimalist solid color backdrop in deep charcoal or pure white.
Shot on Hasselblad H6D-100c medium format with 80mm f/2.8.
Fashion-forward styling with contemporary designer elements.
High contrast black and white conversion option available.
Inspired by Peter Lindbergh and Annie Leibovitz aesthetics.
Sharp detail on facial features with intentional shadow play.
Magazine cover composition with space for typography.
Resolution: 8K, professional color grading with rich tonal range.
Emphasis on texture, emotion, and artistic vision.`,
  },
]

// --- MAIN APP COMPONENT ---
export default function PersonaApp() {
  const [viewState, setViewState] = useState<ViewState>({ view: "DASHBOARD" })
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPro, setIsPro] = useState(false)

  const handleCreatePersona = () => {
    const newId = Date.now().toString()
    const newPersona: Persona = {
      id: newId,
      name: "Новый проект",
      status: "draft",
      images: [],
      generatedAssets: [],
    }
    setPersonas([...personas, newPersona])
    setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: newId })
  }

  const updatePersona = (id: string, updates: Partial<Persona>) => {
    setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }

  const deletePersona = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Удалить этот проект?")) {
      setPersonas((prev) => prev.filter((p) => p.id !== id))
      if ("personaId" in viewState && viewState.personaId === id) {
        setViewState({ view: "DASHBOARD" })
      }
    }
  }

  const getActivePersona = () => {
    if ("personaId" in viewState) {
      return personas.find((p) => p.id === viewState.personaId)
    }
    return null
  }

  const handleGenerate = async (style: StylePreset) => {
    const p = getActivePersona()!
    setIsGenerating(true)
    try {
      // Demo: simulate generation delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const newAsset: GeneratedAsset = {
        id: Date.now().toString(),
        type: "PHOTO",
        url: style.imageUrl,
        styleId: style.id,
        createdAt: Date.now(),
      }

      updatePersona(p.id, {
        status: "ready",
        generatedAssets: [newAsset, ...p.generatedAssets],
        thumbnailUrl: p.thumbnailUrl || newAsset.url,
      })

      setViewState({ view: "RESULTS", personaId: p.id })
    } catch (e: unknown) {
      console.error(e)
      alert(e instanceof Error ? e.message : "Ошибка генерации")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header - мобильный */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Photoset</span>
          </div>
          {viewState.view === "DASHBOARD" && (
            <button
              onClick={handleCreatePersona}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Создать</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {viewState.view === "DASHBOARD" && (
          <AvatarsView
            personas={personas}
            onCreate={handleCreatePersona}
            onSelect={(id) => {
              const p = personas.find((x) => x.id === id)
              if (p?.status === "draft") setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: id })
              else setViewState({ view: "RESULTS", personaId: id })
            }}
            onDelete={deletePersona}
          />
        )}

        {viewState.view === "CREATE_PERSONA_UPLOAD" && getActivePersona() && (
          <UploadView
            persona={getActivePersona()!}
            updatePersona={updatePersona}
            onBack={() => setViewState({ view: "DASHBOARD" })}
            onNext={() => setViewState({ view: "SELECT_STYLE", personaId: viewState.personaId })}
          />
        )}

        {viewState.view === "SELECT_STYLE" && getActivePersona() && (
          <StyleSelectView
            persona={getActivePersona()!}
            onBack={() => setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: viewState.personaId })}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            isPro={isPro}
            onUpgrade={() => setIsPaymentOpen(true)}
          />
        )}

        {viewState.view === "RESULTS" && getActivePersona() && (
          <ResultsView
            persona={getActivePersona()!}
            onBack={() => setViewState({ view: "DASHBOARD" })}
            onGenerateMore={() => setViewState({ view: "SELECT_STYLE", personaId: viewState.personaId })}
          />
        )}
      </main>

      {isPaymentOpen && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          onSuccess={() => {
            setIsPro(true)
            setIsPaymentOpen(false)
          }}
        />
      )}
    </div>
  )
}

// --- SUB-VIEWS ---

const AvatarsView: React.FC<{
  personas: Persona[]
  onCreate: () => void
  onSelect: (id: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}> = ({ personas, onCreate, onSelect, onDelete }) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Мои аватары</h1>
        <p className="text-muted-foreground text-sm mt-1">Создавайте AI-фотографии в разных стилях</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Create New Card */}
        <button
          onClick={onCreate}
          className="aspect-[4/5] rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-3 group"
        >
          <div className="w-12 h-12 rounded-full bg-muted group-hover:bg-primary/10 transition-colors flex items-center justify-center">
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Новый аватар</span>
        </button>

        {personas.map((persona) => (
          <div
            key={persona.id}
            onClick={() => onSelect(persona.id)}
            className="aspect-[4/5] bg-card rounded-2xl overflow-hidden relative cursor-pointer group shadow-sm border border-border hover:shadow-md transition-all"
          >
            {persona.thumbnailUrl ? (
              <img
                src={persona.thumbnailUrl || "/placeholder.svg"}
                alt={persona.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
              />
            ) : (
              <div className="w-full h-full bg-muted flex flex-col items-center justify-center p-4 text-center">
                <div className="w-14 h-14 rounded-full bg-background mb-3 flex items-center justify-center">
                  <User className="w-7 h-7 text-muted-foreground" />
                </div>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 flex flex-col justify-end">
              <h3 className="text-sm font-semibold text-white truncate">{persona.name}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${persona.status === "ready" ? "bg-green-400" : "bg-amber-400"}`}
                />
                <span className="text-[10px] text-white/80">
                  {persona.status === "ready" ? `${persona.generatedAssets.length} фото` : "Черновик"}
                </span>
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={(e) => onDelete(persona.id, e)}
              className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {personas.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Загрузите свои фото</p>
        </div>
      )}
    </div>
  )
}

const UploadView: React.FC<{
  persona: Persona
  updatePersona: (id: string, data: Partial<Persona>) => void
  onBack: () => void
  onNext: () => void
}> = ({ persona, updatePersona, onBack, onNext }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || typeof window === "undefined") return
    const newImages: UploadedImage[] = []

    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i]

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          resolve((ev.target?.result as string).split(",")[1])
        }
        reader.readAsDataURL(file)
      })

      newImages.push({
        id: Math.random().toString(),
        base64,
        mimeType: file.type,
        previewUrl: URL.createObjectURL(file),
      })
    }

    const updates: Partial<Persona> = {
      images: [...persona.images, ...newImages],
    }
    if (!persona.thumbnailUrl && newImages.length > 0) {
      updates.thumbnailUrl = newImages[0].previewUrl
    }
    updatePersona(persona.id, updates)
  }

  const removeImage = (imgId: string) => {
    updatePersona(persona.id, {
      images: persona.images.filter((i) => i.id !== imgId),
    })
  }

  const progress = Math.min(100, (persona.images.length / 20) * 100)
  const isReady = persona.images.length >= 10

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <input
            value={persona.name}
            onChange={(e) => updatePersona(persona.id, { name: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none p-0 focus:ring-0 outline-none w-full"
            placeholder="Название аватара..."
          />
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[120px]">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{persona.images.length}/20 фото</span>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-sm text-foreground/80">
        Загрузите 10-20 фотографий с хорошим освещением и видимым лицом
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-1 group"
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
        />

        {persona.images.map((img) => (
          <div key={img.id} className="aspect-square rounded-xl bg-muted overflow-hidden relative group">
            <img src={img.previewUrl || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => removeImage(img.id)}
              className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Next Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0">
        <button
          onClick={onNext}
          disabled={!isReady}
          className="w-full sm:w-auto px-6 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          Выбрать стиль
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

const StyleSelectView: React.FC<{
  persona: Persona
  onBack: () => void
  onGenerate: (style: StylePreset) => void
  isGenerating: boolean
  isPro: boolean
  onUpgrade: () => void
}> = ({ onBack, onGenerate, isGenerating, isPro, onUpgrade }) => {
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null)

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold">Выберите стиль</h2>
          <p className="text-sm text-muted-foreground">3 профессиональных пресета</p>
        </div>
      </div>

      <div className="space-y-3">
        {STYLE_PRESETS.map((style) => (
          <div
            key={style.id}
            onClick={() => setSelectedStyle(style)}
            className={`flex gap-4 p-3 rounded-2xl cursor-pointer transition-all border-2 ${
              selectedStyle?.id === style.id
                ? "border-primary bg-primary/5"
                : "border-transparent bg-card hover:bg-muted/50"
            }`}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0">
              <img src={style.imageUrl || "/placeholder.svg"} alt={style.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 py-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-muted-foreground">{style.icon}</span>
                <h3 className="font-medium text-foreground">{style.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{style.description}</p>
            </div>
            <div className="shrink-0 self-center">
              {selectedStyle?.id === style.id ? (
                <CheckCircle2 className="w-6 h-6 text-primary" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-border" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Generate Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0">
        {isPro ? (
          <button
            onClick={() => selectedStyle && onGenerate(selectedStyle)}
            disabled={!selectedStyle || isGenerating}
            className="w-full sm:w-auto px-6 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Генерация...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Сгенерировать
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onUpgrade}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-medium rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Разблокировать генерацию (500₽)
          </button>
        )}
      </div>
    </div>
  )
}

const ResultsView: React.FC<{
  persona: Persona
  onBack: () => void
  onGenerateMore: () => void
}> = ({ persona, onBack, onGenerateMore }) => {
  const assets = [...persona.generatedAssets].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">{persona.name}</h2>
            <p className="text-sm text-muted-foreground">{assets.length} фото</p>
          </div>
        </div>
        <button
          onClick={onGenerateMore}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Ещё</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {assets.map((asset) => (
          <div key={asset.id} className="rounded-xl overflow-hidden bg-card shadow-sm border border-border group">
            <div className="aspect-square relative">
              <img src={asset.url || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
              <a
                href={asset.url}
                download
                target="_blank"
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-primary text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                rel="noreferrer"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
            <div className="p-2 text-center">
              <span className="text-xs text-muted-foreground">
                {new Date(asset.createdAt).toLocaleDateString("ru-RU")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {assets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Нет сгенерированных фото</p>
        </div>
      )}
    </div>
  )
}

// Placeholder for PaymentModal if it's defined elsewhere or needs to be added
// import { PaymentModal } from "@/components/payment-modal"; // Uncomment if PaymentModal is external

const PaymentModal: React.FC<{ isOpen: boolean; onClose: () => void; onSuccess: () => void }> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Mock implementation for PaymentModal
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-xl shadow-xl border border-border">
        <h2 className="text-lg font-semibold mb-4">Unlock Pro Features</h2>
        <p className="text-muted-foreground mb-4">This requires a one-time payment of 500₽.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => {
              onSuccess()
              onClose()
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  )
}
