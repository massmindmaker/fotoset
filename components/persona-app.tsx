"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Sparkles,
  Plus,
  ArrowLeft,
  ArrowRight,
  Camera,
  Loader2,
  X,
  CheckCircle2,
  Download,
  Images,
  Palette,
  Upload,
  User,
  Zap,
  Shield,
  Star,
  ChevronRight,
  Lock,
  Briefcase,
  Sunset,
  Brush,
} from "lucide-react"

// Types
interface UploadedImage {
  id: string
  base64: string
  mimeType: string
  previewUrl: string
}

interface GeneratedAsset {
  id: string
  type: "PHOTO"
  url: string
  styleId: string
  prompt?: string
  createdAt: number
}

interface Persona {
  id: string
  name: string
  status: "draft" | "processing" | "ready"
  images: UploadedImage[]
  generatedAssets: GeneratedAsset[]
  thumbnailUrl?: string
}

interface StylePreset {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  imageUrl: string
}

const STYLE_PRESETS: StylePreset[] = [
  {
    id: "professional",
    name: "Профессиональный",
    description: "Деловые портреты для LinkedIn, резюме и корпоративных материалов",
    icon: <Briefcase className="w-5 h-5" />,
    imageUrl: "/professional-business-portrait-man-suit-office.jpg",
  },
  {
    id: "lifestyle",
    name: "Lifestyle",
    description: "Естественные casual-фото для Instagram и социальных сетей",
    icon: <Sunset className="w-5 h-5" />,
    imageUrl: "/lifestyle-casual-portrait-outdoor-sunset.jpg",
  },
  {
    id: "creative",
    name: "Креативный",
    description: "Художественные портреты для творческих проектов и портфолио",
    icon: <Brush className="w-5 h-5" />,
    imageUrl: "/creative-artistic-portrait-colorful-studio.jpg",
  },
]

const EXAMPLE_WORKS = [
  {
    before: "/selfie-casual-photo.jpg",
    after: "/professional-headshot.png",
    style: "Профессиональный",
  },
  {
    before: "/home-selfie.jpg",
    after: "/lifestyle-outdoor-portrait.jpg",
    style: "Lifestyle",
  },
  {
    before: "/mirror-selfie.jpg",
    after: "/artistic-creative-portrait.jpg",
    style: "Креативный",
  },
]

type ViewState =
  | { view: "ONBOARDING" }
  | { view: "DASHBOARD" }
  | { view: "CREATE_PERSONA_UPLOAD"; personaId: string }
  | { view: "SELECT_STYLE"; personaId: string }
  | { view: "GENERATING"; personaId: string; progress: number }
  | { view: "RESULTS"; personaId: string }

function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  let deviceId = localStorage.getItem("photoset_device_id")
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem("photoset_device_id", deviceId)
  }
  return deviceId
}

export default function PersonaApp() {
  const [viewState, setViewState] = useState<ViewState>({ view: "ONBOARDING" })
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [isPro, setIsPro] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [deviceId, setDeviceId] = useState("")
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const id = getDeviceId()
    setDeviceId(id)

    // Проверяем локальный кэш Pro статуса
    const cachedPro = localStorage.getItem("photoset_is_pro")
    if (cachedPro === "true") {
      setIsPro(true)
    }

    // Проверяем онбординг сразу
    const hasSeenOnboarding = localStorage.getItem("photoset_onboarding_complete")
    if (hasSeenOnboarding) {
      setViewState({ view: "DASHBOARD" })
    }

    setIsReady(true)

    // Проверяем статус на сервере в фоне (не блокируем UI)
    fetch(`/api/payment/status?device_id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.isPro) {
          setIsPro(true)
          localStorage.setItem("photoset_is_pro", "true")
        }
      })
      .catch((err) => {
        console.error("[v0] Payment status check failed:", err)
        // Не блокируем UI при ошибке
      })
  }, [])

  const completeOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("photoset_onboarding_complete", "true")
    }
    setViewState({ view: "DASHBOARD" })
  }

  const handleCreatePersona = () => {
    const newId = Date.now().toString()
    const newPersona: Persona = {
      id: newId,
      name: "Мой аватар",
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
    if (confirm("Удалить этот аватар?")) {
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
    setGenerationProgress(0)
    setViewState({ view: "GENERATING", personaId: p.id, progress: 0 })

    try {
      // Получаем base64 референсных изображений
      const referenceImages = p.images.slice(0, 5).map((img) => img.base64)

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          avatarId: p.id,
          styleId: style.id,
          referenceImages,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Generation failed")
      }

      const data = await response.json()

      // Создаем assets из полученных фото
      const newAssets: GeneratedAsset[] = data.photos.map((url: string, index: number) => ({
        id: `${Date.now()}-${index}`,
        type: "PHOTO" as const,
        url,
        styleId: style.id,
        createdAt: Date.now(),
      }))

      updatePersona(p.id, {
        status: "ready",
        generatedAssets: [...newAssets, ...p.generatedAssets],
        thumbnailUrl: p.thumbnailUrl || newAssets[0]?.url,
      })

      setViewState({ view: "RESULTS", personaId: p.id })
    } catch (e: unknown) {
      console.error(e)
      alert(e instanceof Error ? e.message : "Ошибка генерации")
      setViewState({ view: "SELECT_STYLE", personaId: p.id })
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }

  const handlePayment = async () => {
    try {
      const p = getActivePersona()
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          avatarId: p?.id,
        }),
      })

      if (!response.ok) {
        throw new Error("Payment creation failed")
      }

      const data = await response.json()

      if (data.confirmationUrl) {
        // Редирект на страницу оплаты YooKassa
        window.location.href = data.confirmationUrl
      }
    } catch (error) {
      console.error("Payment error:", error)
      alert("Ошибка создания платежа. Попробуйте позже.")
    }
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {viewState.view === "ONBOARDING" ? (
        <OnboardingView onComplete={completeOnboarding} onStart={handleCreatePersona} />
      ) : viewState.view === "GENERATING" ? (
        <GeneratingView progress={generationProgress} totalPhotos={23} />
      ) : (
        <>
          {/* Header */}
          <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border safe-area-inset-top">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg">Photoset</span>
                {isPro && (
                  <span className="text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full font-medium">
                    PRO
                  </span>
                )}
              </div>
              {viewState.view === "DASHBOARD" && (
                <button
                  onClick={handleCreatePersona}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity active:scale-95"
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
              <DashboardView
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
                onUpgrade={handlePayment}
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
        </>
      )}

      {isPaymentOpen && (
        <PaymentModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} onPayment={handlePayment} />
      )}
    </div>
  )
}

// --- GENERATING VIEW ---
const GeneratingView: React.FC<{
  progress: number
  totalPhotos: number
}> = ({ progress, totalPhotos }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-8">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>

      <h1 className="text-2xl font-bold text-center mb-2">Генерируем ваши фото</h1>
      <p className="text-muted-foreground text-center mb-8">Создаём {totalPhotos} уникальных изображений...</p>

      <div className="w-full max-w-xs">
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(progress / totalPhotos) * 100}%` }}
          />
        </div>
        <p className="text-sm text-center text-muted-foreground">
          {progress} из {totalPhotos} фото
        </p>
      </div>

      <p className="text-xs text-muted-foreground mt-8 text-center max-w-sm">
        Это может занять 5-10 минут. Вы можете закрыть эту страницу - мы отправим уведомление когда будет готово.
      </p>
    </div>
  )
}

// --- ONBOARDING VIEW ---
const OnboardingView: React.FC<{
  onComplete: () => void
  onStart: () => void
}> = ({ onComplete, onStart }) => {
  // Демонстрационные портреты для кругового отображения
  const examplePortraits = [
    "/professional-business-portrait-man-suit-office.jpg",
    "/lifestyle-casual-portrait-outdoor-sunset.jpg",
    "/creative-artistic-portrait-colorful-studio.jpg",
    "/professional-headshot.png",
    "/lifestyle-outdoor-portrait.jpg",
    "/artistic-creative-portrait.jpg",
    "/selfie-casual-photo.jpg",
    "/home-selfie.jpg",
    "/mirror-selfie.jpg",
    "/professional-business-portrait-man-suit-office.jpg",
    "/lifestyle-casual-portrait-outdoor-sunset.jpg",
    "/creative-artistic-portrait-colorful-studio.jpg",
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden bg-gradient-to-b from-background via-background to-primary/5">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
        {/* Circular Portrait Layout */}
        <div className="relative w-full aspect-square max-w-sm mb-12">
          {/* Center large portrait */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-4 border-background shadow-2xl ring-2 ring-primary/20">
            <img
              src={examplePortraits[0] || "/placeholder.svg"}
              alt="AI Portrait"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Orbiting portraits */}
          {examplePortraits.slice(1, 12).map((src, index) => {
            const angle = (index * 360) / 11
            const radius = 42 // percentage from center
            const size = index % 3 === 0 ? "w-16 h-16 sm:w-20 sm:h-20" : index % 2 === 0 ? "w-14 h-14 sm:w-16 sm:h-16" : "w-12 h-12 sm:w-14 sm:h-14"
            const roundness = index % 4 === 0 ? "rounded-2xl" : index % 3 === 0 ? "rounded-full" : "rounded-xl"

            return (
              <div
                key={index}
                className={`absolute ${size} ${roundness} overflow-hidden border-2 border-background shadow-lg`}
                style={{
                  left: `${50 + radius * Math.cos((angle * Math.PI) / 180)}%`,
                  top: `${50 + radius * Math.sin((angle * Math.PI) / 180)}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <img src={src || "/placeholder.svg"} alt={`Portrait ${index}`} className="w-full h-full object-cover" />
              </div>
            )
          })}
        </div>

        {/* Text Content */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Вдохновляющие портреты
          </h1>
          <p className="text-muted-foreground max-w-md">
            Создавайте профессиональные AI-фотографии для бизнеса, соцсетей и творческих проектов
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={onStart}
          className="w-full max-w-xs py-4 px-8 bg-foreground text-background font-semibold text-lg rounded-3xl hover:opacity-90 transition-all active:scale-95 shadow-xl"
        >
          Начать!
        </button>

        {/* Skip link */}
        <button
          onClick={onComplete}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Пропустить
        </button>
      </div>
    </div>
  )
}

// --- DASHBOARD VIEW ---
const DashboardView: React.FC<{
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

      {personas.length === 0 ? (
        <div className="space-y-6">
          {/* Hero Card */}
          <button
            onClick={onCreate}
            className="w-full p-6 sm:p-8 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 rounded-3xl border-2 border-dashed border-primary/30 hover:border-primary/50 transition-all group text-left"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-center justify-center">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">Создать первый аватар</h3>
                <p className="text-muted-foreground text-sm">
                  Загрузите 10-20 своих фото и получите 23 профессиональных портрета
                </p>
              </div>
              <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors hidden sm:block" />
            </div>
          </button>

          {/* Examples Section */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Примеры работ</h3>
            <div className="grid grid-cols-3 gap-3">
              {STYLE_PRESETS.map((style) => (
                <div key={style.id} className="space-y-2">
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-muted">
                    <img
                      src={style.imageUrl || "/placeholder.svg"}
                      alt={style.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">{style.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-card rounded-2xl border border-border">
              <Zap className="w-5 h-5 text-amber-500 mb-2" />
              <p className="text-sm font-medium">23 фото</p>
              <p className="text-xs text-muted-foreground">За одну генерацию</p>
            </div>
            <div className="p-4 bg-card rounded-2xl border border-border">
              <Shield className="w-5 h-5 text-green-500 mb-2" />
              <p className="text-sm font-medium">Безопасно</p>
              <p className="text-xs text-muted-foreground">Фото не сохраняются</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Create New Card */}
          <button
            onClick={onCreate}
            className="aspect-[4/5] rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-3 group active:scale-95"
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
              className="aspect-[4/5] bg-card rounded-2xl overflow-hidden relative cursor-pointer group shadow-sm border border-border hover:shadow-md transition-all active:scale-[0.98]"
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
                className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- UPLOAD VIEW ---
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
    <div className="space-y-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"
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
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
              <div
                className={`h-full transition-all duration-500 ${isReady ? "bg-green-500" : "bg-primary"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={`text-xs ${isReady ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
              {persona.images.length}/20 фото
            </span>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
        <div className="flex gap-3">
          <Camera className="w-5 h-5 text-primary shrink-0 mt-0.5" />
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

      {/* Photo Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-1 group active:scale-95"
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
              className="absolute top-1 right-1 p-1.5 bg-black/50 hover:bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Next Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
        <button
          onClick={onNext}
          disabled={!isReady}
          className="w-full sm:w-auto px-6 py-3.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Выбрать стиль
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

// --- STYLE SELECT VIEW ---
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
          className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold">Выберите стиль</h2>
          <p className="text-sm text-muted-foreground">Будет сгенерировано 23 фото</p>
        </div>
      </div>

      <div className="space-y-3">
        {STYLE_PRESETS.map((style) => (
          <button
            key={style.id}
            onClick={() => setSelectedStyle(style)}
            className={`w-full flex gap-4 p-3 rounded-2xl transition-all border-2 text-left active:scale-[0.99] ${
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
          </button>
        ))}
      </div>

      {/* Generate Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
        {isPro ? (
          <button
            onClick={() => selectedStyle && onGenerate(selectedStyle)}
            disabled={!selectedStyle || isGenerating}
            className="w-full sm:w-auto px-6 py-3.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Генерация...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Сгенерировать 23 фото
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onUpgrade}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-foreground font-medium rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Lock className="w-4 h-4" />
            Оплатить 500₽ и сгенерировать
          </button>
        )}
      </div>
    </div>
  )
}

// --- RESULTS VIEW ---
const ResultsView: React.FC<{
  persona: Persona
  onBack: () => void
  onGenerateMore: () => void
}> = ({ persona, onBack, onGenerateMore }) => {
  const assets = [...persona.generatedAssets].sort((a, b) => b.createdAt - a.createdAt)
  const [selectedPhoto, setSelectedPhoto] = useState(assets[0]?.url || null)

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onGenerateMore}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          <span>Создать ещё</span>
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Нет сгенерированных фото</p>
        </div>
      ) : (
        <>
          {/* Desktop Layout: Two-column with large preview */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-6">
            {/* Left: Large Preview */}
            <div className="space-y-4">
              <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-muted relative group">
                <img
                  src={selectedPhoto || assets[0]?.url || "/placeholder.svg"}
                  alt="Selected"
                  className="w-full h-full object-cover"
                />
                <a
                  href={selectedPhoto || assets[0]?.url}
                  download
                  target="_blank"
                  className="absolute bottom-4 right-4 p-3 bg-background/90 backdrop-blur-sm hover:bg-primary text-foreground hover:text-primary-foreground rounded-2xl opacity-0 group-hover:opacity-100 transition-all"
                  rel="noreferrer"
                >
                  <Download className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Right: Profile Card & Grid */}
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="p-6 bg-card border border-border rounded-3xl space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary">
                    <img
                      src={persona.thumbnailUrl || assets[0]?.url || "/placeholder.svg"}
                      alt={persona.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{persona.name}</h3>
                    <p className="text-sm text-muted-foreground">AI Generated</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{assets.length}</div>
                    <div className="text-xs text-muted-foreground">Фотографий</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">23</div>
                    <div className="text-xs text-muted-foreground">В наборе</div>
                  </div>
                </div>
              </div>

              {/* Thumbnail Grid */}
              <div className="grid grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedPhoto(asset.url)}
                    className={`aspect-square rounded-2xl overflow-hidden bg-card border-2 transition-all hover:scale-105 ${
                      selectedPhoto === asset.url ? "border-primary ring-2 ring-primary/20" : "border-transparent"
                    }`}
                  >
                    <img src={asset.url || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Layout: Simple Grid */}
          <div className="lg:hidden space-y-4">
            {/* Profile Summary */}
            <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary">
                <img
                  src={persona.thumbnailUrl || assets[0]?.url || "/placeholder.svg"}
                  alt={persona.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{persona.name}</h3>
                <p className="text-sm text-muted-foreground">{assets.length} фотографий</p>
              </div>
            </div>

            {/* Photo Grid */}
            <div className="grid grid-cols-2 gap-3">
              {assets.map((asset) => (
                <div key={asset.id} className="rounded-2xl overflow-hidden bg-card shadow-sm border border-border group">
                  <div className="aspect-square relative">
                    <img src={asset.url || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                    <a
                      href={asset.url}
                      download
                      target="_blank"
                      className="absolute top-2 right-2 p-2.5 bg-black/50 hover:bg-primary text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      rel="noreferrer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// --- PAYMENT MODAL ---
const PaymentModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onPayment: () => void
}> = ({ isOpen, onClose, onPayment }) => {
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handlePaymentClick = async () => {
    setIsLoading(true)
    await onPayment()
    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl border border-border overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold">Photoset Pro</h2>
              <p className="text-muted-foreground text-sm">23 AI-фотографии</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4 px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-lg text-center">
            Тестовый режим - оплата не требуется
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm">23 уникальных фотографии</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm">Профессиональное качество</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm">Скачивание в высоком разрешении</span>
            </div>
          </div>

          <div className="text-center mb-6">
            <span className="text-4xl font-bold">500₽</span>
            <p className="text-sm text-muted-foreground">единоразовый платёж</p>
          </div>

          <button
            onClick={handlePaymentClick}
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-foreground font-semibold rounded-2xl hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? "Перенаправление..." : "Оплатить через T-Bank"}
          </button>

          <p className="text-xs text-center text-muted-foreground mt-4">Безопасная оплата через T-Bank</p>
        </div>
      </div>
    </div>
  )
}
