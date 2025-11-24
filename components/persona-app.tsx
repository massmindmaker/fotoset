"use client"

import type React from "react"
import { useState, useRef } from "react"
import {
  Plus,
  ArrowLeft,
  ImageIcon,
  Video,
  Download,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  User,
  AlertCircle,
  Crown,
  Zap,
  Lock,
} from "lucide-react"
import { PaymentModal } from "@/components/payment-modal"

// --- TYPES ---
export interface UploadedImage {
  id: string
  previewUrl: string
  base64: string
  mimeType: string
}

export interface GeneratedAsset {
  id: string
  type: "VIDEO" | "PHOTO"
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
  type: "PHOTO" | "VIDEO"
  isNew?: boolean
  isPopular?: boolean
  requiresPro?: boolean
}

export type ViewState =
  | { view: "DASHBOARD" }
  | { view: "CREATE_PERSONA_UPLOAD"; personaId: string }
  | { view: "SELECT_STYLE"; personaId: string }
  | { view: "RESULTS"; personaId: string }

// --- STYLE PRESETS ---
const STYLE_PRESETS: StylePreset[] = [
  {
    id: "linkedin-pro",
    name: "LinkedIn Executive",
    description: "High-end corporate headshot, confident and trustworthy",
    imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400",
    prompt:
      "Professional corporate headshot of the subject, wearing a sharp tailored navy suit, crisp white shirt, soft studio lighting, neutral grey gradient background, shot on 85mm lens, f/1.8, razor sharp focus on eyes, 8k resolution, confident executive look",
    type: "PHOTO",
    isPopular: true,
  },
  {
    id: "tech-founder",
    name: "Tech Founder",
    description: "Modern, casual yet professional Silicon Valley look",
    imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400",
    prompt:
      "Portrait of a modern tech entrepreneur, wearing a high-quality black t-shirt and casual blazer, modern open-plan office background with blurred glass walls, natural window lighting, confident and visionary expression, cinematic depth of field, 4k",
    type: "PHOTO",
  },
  {
    id: "studio-bw",
    name: "Studio Noir B&W",
    description: "Dramatic high-contrast black and white portrait",
    imageUrl: "https://images.unsplash.com/photo-1504198458649-3128b932f49e?auto=format&fit=crop&q=80&w=400",
    prompt:
      "Artistic black and white portrait in the style of Peter Lindbergh, high contrast, dramatic shadows, moody atmosphere, rich textures, emotional expression, classic film grain, studio photography",
    type: "PHOTO",
  },
  {
    id: "cyberpunk-neon",
    name: "Cyberpunk City",
    description: "Futuristic neon lights, rain, high-tech vibe",
    imageUrl: "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&q=80&w=400",
    prompt:
      "Cinematic shot in a Cyberpunk 2077 style, neon blue and pink lighting reflecting on wet skin, futuristic city street background with rain, wearing a high-tech tactical jacket with glowing collar, dramatic atmosphere, volumetric fog, highly detailed, 8k",
    type: "PHOTO",
    isPopular: true,
    requiresPro: true,
  },
  {
    id: "vogue-cover",
    name: "Vogue Editorial",
    description: "High fashion, sharp, glamorous",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
    prompt:
      "High fashion magazine cover shoot, subject wearing avant-garde couture fashion, dramatic studio lighting, sharp focus, glossy skin finish, confident pose, clean minimalist background, aesthetics of Vogue editorial, 8k",
    type: "PHOTO",
    isPopular: true,
  },
  {
    id: "pixar-3d",
    name: "3D Animation",
    description: "Cute 3D character, big eyes, soft light",
    imageUrl: "https://images.unsplash.com/photo-1633511090164-b43840ea1607?auto=format&fit=crop&q=80&w=400",
    prompt:
      "3D animated character style, Pixar or Disney style, large expressive eyes, soft smooth skin texture, bright and cheerful lighting, colorful background, cute and appealing look, 4k render, octave render",
    type: "PHOTO",
    isPopular: true,
  },
  {
    id: "fantasy-elf",
    name: "High Elf",
    description: "Lord of the Rings style, magical forest",
    imageUrl: "https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?auto=format&fit=crop&q=80&w=400",
    prompt:
      "High fantasy portrait, subject as an ethereal Elf Lord/Lady, wearing intricate silver armor and velvet robes, magical ancient forest background with glowing particles, long flowing hair, pointed ears, soft mystical lighting, 8k fantasy art",
    type: "PHOTO",
  },
  {
    id: "space-ranger-video",
    name: "Space Ranger",
    description: "Animated sci-fi video in space suit",
    imageUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&q=80&w=400",
    prompt:
      "Cinematic video of a space ranger pilot, wearing a futuristic white and orange space suit, inside a spaceship cockpit, looking out at a nebula and stars, reflections on the helmet visor, 4k video output",
    type: "VIDEO",
    requiresPro: true,
  },
  {
    id: "anime-sky",
    name: "Anime Sky",
    description: "Makoto Shinkai style, vibrant clouds",
    imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=400",
    prompt:
      "Anime style portrait, Makoto Shinkai art style, vibrant blue sky with massive cumulus clouds in background, lens flare, emotional and beautiful, high quality 2D animation style, detailed hair and eyes",
    type: "PHOTO",
  },
  {
    id: "oil-painting",
    name: "Classic Oil Paint",
    description: "Museum quality renaissance portrait",
    imageUrl: "https://images.unsplash.com/photo-1578321272176-b7bbc0679853?auto=format&fit=crop&q=80&w=400",
    prompt:
      "Oil painting on canvas, style of Rembrandt or Sargent, visible brushstrokes, rich deep colors, dramatic chiaroscuro lighting, subject posing in renaissance clothing, museum quality art, textured finish",
    type: "PHOTO",
    requiresPro: true,
  },
  {
    id: "gta-loading",
    name: "GTA Loading Screen",
    description: "Vector illustration, cel-shaded, vibrant",
    imageUrl: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=400",
    prompt:
      "Grand Theft Auto loading screen art style, digital vector illustration, heavy black outlines, cel-shaded coloring, vibrant sunset background with palm trees, cool and dangerous attitude, stylized realism",
    type: "PHOTO",
  },
  {
    id: "wes-anderson",
    name: "Symmetry Pastel",
    description: "Quirky, centered, pastel colors, retro vibe",
    imageUrl: "https://images.unsplash.com/photo-1485230405346-71acb9518d9c?auto=format&fit=crop&q=80&w=400",
    prompt:
      "Portrait in the style of a Wes Anderson movie, perfectly symmetrical composition, pastel color palette (pink and baby blue), flat lighting, subject wearing vintage 70s clothing, quirky deadpan expression, whimsical background, highly stylized",
    type: "PHOTO",
    isNew: true,
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
      name: "New Avatar",
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
    if (confirm("Are you sure you want to delete this avatar?")) {
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
      // Demo: generate mock assets
      const newAssets: GeneratedAsset[] = []

      if (style.type === "VIDEO") {
        newAssets.push({
          id: Date.now().toString(),
          type: "VIDEO",
          url: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
          styleId: style.id,
          createdAt: Date.now(),
        })
      } else {
        // Simulate image generation with placeholder
        newAssets.push({
          id: Date.now().toString(),
          type: "PHOTO",
          url: style.imageUrl,
          styleId: style.id,
          createdAt: Date.now(),
        })
      }

      updatePersona(p.id, {
        status: "ready",
        generatedAssets: [...newAssets, ...p.generatedAssets],
        thumbnailUrl: p.thumbnailUrl || newAssets[0].url,
      })

      setViewState({ view: "RESULTS", personaId: p.id })
    } catch (e: unknown) {
      console.error(e)
      alert(e instanceof Error ? e.message : "Generation failed.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden font-sans selection:bg-purple-500/30">
      {/* SIDEBAR */}
      <aside className="w-20 md:w-72 bg-[#0f172a] border-r border-slate-800 flex flex-col shrink-0 transition-all duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden md:block">
            Persona<span className="text-purple-400">AI</span>
          </span>
          {isPro && (
            <span className="hidden md:inline-flex bg-gradient-to-r from-amber-400 to-orange-500 text-[10px] text-black font-bold px-1.5 py-0.5 rounded ml-auto">
              UNLOCKED
            </span>
          )}
        </div>

        <div className="px-4 mb-4 hidden md:block">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">My Avatars</h3>
          <button
            onClick={handleCreatePersona}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-xl p-3 flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 group"
          >
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium">Create Avatar</span>
          </button>
        </div>

        {/* Mobile add button */}
        <div className="px-2 mb-4 md:hidden flex justify-center">
          <button
            onClick={handleCreatePersona}
            className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {personas.map((persona) => (
            <div
              key={persona.id}
              onClick={() => {
                if (persona.status === "draft") setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: persona.id })
                else setViewState({ view: "RESULTS", personaId: persona.id })
              }}
              className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border border-transparent ${
                "personaId" in viewState && viewState.personaId === persona.id
                  ? "bg-slate-800 border-slate-700"
                  : "hover:bg-slate-800/50"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-700 overflow-hidden shrink-0 relative">
                {persona.thumbnailUrl ? (
                  <img
                    src={persona.thumbnailUrl || "/placeholder.svg"}
                    alt={persona.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0f172a] ${
                    persona.status === "ready" ? "bg-green-500" : "bg-amber-500"
                  }`}
                />
              </div>

              <div className="hidden md:block flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate text-slate-200 group-hover:text-white">{persona.name}</h4>
                <p className="text-xs text-slate-500 truncate">
                  {persona.status === "draft" ? "Draft" : `${persona.generatedAssets.length} generated`}
                </p>
              </div>

              <button
                onClick={(e) => deletePersona(persona.id, e)}
                className="hidden md:block opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 space-y-3">
          {!isPro && (
            <button
              onClick={() => setIsPaymentOpen(true)}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 hover:border-purple-500/50 rounded-lg text-purple-200 hover:text-white transition-all flex items-center justify-center gap-2 group"
            >
              <Zap className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold hidden md:inline">Buy Generation (500₽)</span>
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {viewState.view === "DASHBOARD" && (
          <DashboardView
            personas={personas}
            onCreate={handleCreatePersona}
            onSelect={(id) => {
              const p = personas.find((x) => x.id === id)
              if (p?.status === "draft") setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: id })
              else setViewState({ view: "RESULTS", personaId: id })
            }}
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

      <PaymentModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} onSuccess={() => setIsPro(true)} />
    </div>
  )
}

// --- SUB-VIEWS ---

const DashboardView: React.FC<{
  personas: Persona[]
  onCreate: () => void
  onSelect: (id: string) => void
}> = ({ personas, onCreate, onSelect }) => {
  return (
    <div className="flex-1 overflow-y-auto p-8 md:p-12">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-2">My Avatars</h1>
        <p className="text-slate-400">Manage your digital personas and generate new content.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <button
          onClick={onCreate}
          className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-700 hover:border-purple-500 hover:bg-slate-800/30 transition-all flex flex-col items-center justify-center gap-4 group"
        >
          <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-purple-600 transition-colors flex items-center justify-center">
            <Plus className="w-8 h-8 text-slate-400 group-hover:text-white" />
          </div>
          <span className="font-medium text-slate-300 group-hover:text-white">Create New Avatar</span>
        </button>

        {personas.map((persona) => (
          <div
            key={persona.id}
            onClick={() => onSelect(persona.id)}
            className="aspect-[3/4] bg-slate-800 rounded-2xl overflow-hidden relative cursor-pointer group shadow-xl hover:shadow-2xl hover:shadow-purple-900/10 transition-all hover:-translate-y-1"
          >
            {persona.thumbnailUrl ? (
              <img
                src={persona.thumbnailUrl || "/placeholder.svg"}
                alt={persona.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
              />
            ) : (
              <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-700 mb-4 flex items-center justify-center">
                  <User className="w-10 h-10 text-slate-500" />
                </div>
                <p className="text-slate-500 text-sm">Upload photos to complete setup</p>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-5 flex flex-col justify-end">
              <h3 className="text-xl font-bold text-white mb-1">{persona.name}</h3>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                    persona.status === "ready" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {persona.status === "ready" ? "Ready" : "Draft"}
                </span>
                {persona.generatedAssets.length > 0 && (
                  <span className="text-xs text-slate-400">{persona.generatedAssets.length} assets</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
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
    if (!e.target.files) return
    const newImages: UploadedImage[] = []

    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i]
      const reader = new FileReader()
      await new Promise<void>((resolve) => {
        reader.onload = (ev) => {
          newImages.push({
            id: Math.random().toString(),
            base64: (ev.target?.result as string).split(",")[1],
            mimeType: file.type,
            previewUrl: URL.createObjectURL(file),
          })
          resolve()
        }
        reader.readAsDataURL(file)
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

  const progress = Math.min(100, (persona.images.length / 5) * 100)
  const isReady = persona.images.length >= 3

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19]">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#0f172a]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Create your avatar</h2>
            <input
              value={persona.name}
              onChange={(e) => updatePersona(persona.id, { name: e.target.value })}
              className="bg-transparent border-none p-0 text-sm text-slate-400 focus:text-white focus:ring-0 placeholder-slate-600 outline-none"
              placeholder="Name your avatar..."
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 mb-1">Photos uploaded {persona.images.length}/5 (min 3)</p>
          <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3 text-blue-200 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>
              Upload 3-20 photos of yourself. Clear face visibility, different angles, and good lighting work best.
              Avoid accessories like sunglasses.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-slate-700 hover:border-purple-500 hover:bg-slate-800/50 transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-purple-600 transition-colors flex items-center justify-center">
                <Plus className="w-5 h-5 text-slate-400 group-hover:text-white" />
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-white">Add Photo</span>
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
              <div key={img.id} className="aspect-square rounded-2xl bg-slate-800 overflow-hidden relative group">
                <img src={img.previewUrl || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-800 bg-[#0f172a] flex justify-end">
        <button
          onClick={onNext}
          disabled={!isReady}
          className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          Next Step
          <ArrowLeft className="w-4 h-4 rotate-180" />
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
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19]">
      <div className="p-6 border-b border-slate-800 flex items-center gap-4 bg-[#0f172a]">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-white">Choose a style</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {STYLE_PRESETS.map((style) => (
            <div
              key={style.id}
              onClick={() => setSelectedStyle(style)}
              className={`relative aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer group border-2 transition-all ${
                selectedStyle?.id === style.id
                  ? "border-purple-500 shadow-xl shadow-purple-900/20 scale-[1.02]"
                  : "border-transparent hover:border-slate-600"
              }`}
            >
              <img src={style.imageUrl || "/placeholder.svg"} alt={style.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 flex flex-col justify-end">
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {style.name}
                      {style.isNew && <span className="bg-blue-500 text-xs px-1.5 py-0.5 rounded text-white">NEW</span>}
                      {style.requiresPro && (
                        <span className="bg-amber-500 text-black text-xs px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                          <Crown className="w-3 h-3" /> PRO
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-slate-300 line-clamp-2">{style.description}</p>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      selectedStyle?.id === style.id ? "bg-purple-600 text-white" : "bg-white/10 text-white"
                    }`}
                  >
                    {selectedStyle?.id === style.id ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : style.type === "VIDEO" ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 border-t border-slate-800 bg-[#0f172a] flex justify-between items-center">
        <div className="text-sm text-slate-400 hidden sm:block">
          {selectedStyle ? `Selected: ${selectedStyle.name}` : "Select a style to continue"}
        </div>

        {isPro ? (
          <button
            onClick={() => selectedStyle && onGenerate(selectedStyle)}
            disabled={!selectedStyle || isGenerating}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-900/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Art
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onUpgrade}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:shadow-lg hover:shadow-orange-900/25 transition-all flex items-center gap-2"
          >
            <Lock className="w-5 h-5" />
            Unlock Generation (500₽)
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
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19]">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#0f172a]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">{persona.name}</h2>
            <p className="text-xs text-slate-400">{assets.length} generated assets</p>
          </div>
        </div>
        <button
          onClick={onGenerateMore}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Generate New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-700 group"
            >
              <div className="aspect-square relative bg-black/50">
                {asset.type === "VIDEO" ? (
                  <video src={asset.url} controls className="w-full h-full object-cover" />
                ) : (
                  <img src={asset.url || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={asset.url}
                    download
                    target="_blank"
                    className="p-2 bg-black/50 hover:bg-white text-white hover:text-black rounded-lg backdrop-blur-md transition-colors"
                    rel="noreferrer"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                  {asset.type === "VIDEO" ? "Veo Video" : "Gemini Image"}
                </span>
                <span className="text-xs text-slate-500">{new Date(asset.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
