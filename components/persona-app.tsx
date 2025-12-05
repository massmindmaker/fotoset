"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Sparkles, Plus, ArrowLeft, ArrowRight, Camera, Loader2, X, CheckCircle2,
  Download, User, Zap, Shield, Star, ChevronRight, Lock, Crown,
} from "lucide-react"
import { PaymentModal } from "./payment-modal"

export interface PricingTier { id: string; photos: number; price: number; popular?: boolean }

export const PRICING_TIERS: PricingTier[] = [
  { id: "starter", photos: 7, price: 499 },
  { id: "standard", photos: 15, price: 999, popular: true },
  { id: "premium", photos: 23, price: 1499 },
]

const DEMO_PHOTOS = [
  "/demo/Screenshot_1.png", "/demo/Screenshot_2.png", "/demo/Screenshot_3.png",
  "/demo/Screenshot_4.png", "/demo/Screenshot_5.png", "/demo/Screenshot_6.png",
  "/demo/Screenshot_7.png", "/demo/Screenshot_8.png", "/demo/Screenshot_9.png",
  "/demo/Screenshot_10.png", "/demo/Screenshot_11.png",
]

interface UploadedImage { id: string; base64: string; mimeType: string; previewUrl: string }
interface GeneratedAsset { id: string; type: "PHOTO"; url: string; styleId: string; prompt?: string; createdAt: number }
interface Persona { id: string; name: string; status: "draft" | "processing" | "ready"; images: UploadedImage[]; generatedAssets: GeneratedAsset[]; thumbnailUrl?: string }

type ViewState =
  | { view: "ONBOARDING" } | { view: "DASHBOARD" }
  | { view: "CREATE_PERSONA_UPLOAD"; personaId: string }
  | { view: "SELECT_TIER"; personaId: string }
  | { view: "GENERATING"; personaId: string; progress: number }
  | { view: "RESULTS"; personaId: string }

function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  let deviceId = localStorage.getItem("pinglass_device_id")
  if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem("pinglass_device_id", deviceId) }
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
  const [selectedTier, setSelectedTier] = useState<PricingTier>(PRICING_TIERS[1])

  useEffect(() => {
    if (typeof window === "undefined") return
    const id = getDeviceId()
    setDeviceId(id)
    if (localStorage.getItem("pinglass_is_pro") === "true") setIsPro(true)
    if (localStorage.getItem("pinglass_onboarding_complete")) setViewState({ view: "DASHBOARD" })
    setIsReady(true)
    fetch("/api/payment/status?device_id=" + id).then(r => r.json()).then(d => { if (d.isPro) { setIsPro(true); localStorage.setItem("pinglass_is_pro", "true") } }).catch(() => {})
  }, [])

  const completeOnboarding = () => { localStorage.setItem("pinglass_onboarding_complete", "true"); setViewState({ view: "DASHBOARD" }) }
  const handleCreatePersona = () => {
    const newId = Date.now().toString()
    setPersonas([...personas, { id: newId, name: "Мой аватар", status: "draft", images: [], generatedAssets: [] }])
    setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: newId })
  }
  const updatePersona = (id: string, updates: Partial<Persona>) => { setPersonas(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)) }
  const deletePersona = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Удалить?")) { setPersonas(prev => prev.filter(p => p.id !== id)); if ("personaId" in viewState && viewState.personaId === id) setViewState({ view: "DASHBOARD" }) }
  }
  const getActivePersona = () => "personaId" in viewState ? personas.find(p => p.id === viewState.personaId) : null

  const handleGenerate = async (tier: PricingTier) => {
    const p = getActivePersona()!
    setIsGenerating(true); setGenerationProgress(0)
    setViewState({ view: "GENERATING", personaId: p.id, progress: 0 })
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, avatarId: p.id, styleId: "pinglass", photoCount: tier.photos, referenceImages: p.images.slice(0,5).map(i => i.base64) }) })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      const data = await res.json()
      const newAssets: GeneratedAsset[] = data.photos.map((url: string, i: number) => ({ id: Date.now() + "-" + i, type: "PHOTO" as const, url, styleId: "pinglass", createdAt: Date.now() }))
      updatePersona(p.id, { status: "ready", generatedAssets: [...newAssets, ...p.generatedAssets], thumbnailUrl: p.thumbnailUrl || newAssets[0]?.url })
      setViewState({ view: "RESULTS", personaId: p.id })
    } catch (e) { alert(e instanceof Error ? e.message : "Ошибка"); setViewState({ view: "SELECT_TIER", personaId: p.id }) }
    finally { setIsGenerating(false); setGenerationProgress(0) }
  }

  const handlePaymentSuccess = () => { setIsPro(true); localStorage.setItem("pinglass_is_pro", "true"); setIsPaymentOpen(false); if (viewState.view === "SELECT_TIER") handleGenerate(selectedTier) }

  if (!isReady) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  return (
    <div className="min-h-screen bg-background text-foreground">
      {viewState.view === "ONBOARDING" ? <OnboardingView onComplete={completeOnboarding} onStart={handleCreatePersona} />
       : viewState.view === "GENERATING" ? <GeneratingView progress={generationProgress} totalPhotos={selectedTier.photos} />
       : (<>
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center"><Sparkles className="w-4 h-4 text-primary-foreground" /></div>
              <span className="font-semibold text-lg">PinGlass</span>
              {isPro && <span className="text-xs bg-gradient-to-r from-primary to-accent text-white px-2 py-0.5 rounded-full">PRO</span>}
            </div>
            {viewState.view === "DASHBOARD" && <button onClick={handleCreatePersona} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium"><Plus className="w-4 h-4" />Создать</button>}
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">
          {viewState.view === "DASHBOARD" && <DashboardView personas={personas} onCreate={handleCreatePersona} onSelect={id => { const p = personas.find(x => x.id === id); setViewState(p?.status === "draft" ? { view: "CREATE_PERSONA_UPLOAD", personaId: id } : { view: "RESULTS", personaId: id }) }} onDelete={deletePersona} />}
          {viewState.view === "CREATE_PERSONA_UPLOAD" && getActivePersona() && <UploadView persona={getActivePersona()!} updatePersona={updatePersona} onBack={() => setViewState({ view: "DASHBOARD" })} onNext={() => setViewState({ view: "SELECT_TIER", personaId: viewState.personaId })} />}
          {viewState.view === "SELECT_TIER" && getActivePersona() && <TierSelectView persona={getActivePersona()!} onBack={() => setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: viewState.personaId })} onGenerate={handleGenerate} isGenerating={isGenerating} isPro={isPro} onUpgrade={t => { setSelectedTier(t); setIsPaymentOpen(true) }} selectedTier={selectedTier} onSelectTier={setSelectedTier} />}
          {viewState.view === "RESULTS" && getActivePersona() && <ResultsView persona={getActivePersona()!} onBack={() => setViewState({ view: "DASHBOARD" })} onGenerateMore={() => setViewState({ view: "SELECT_TIER", personaId: viewState.personaId })} />}
        </main>
      </>)}
      {isPaymentOpen && <PaymentModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} onSuccess={handlePaymentSuccess} deviceId={deviceId} tier={selectedTier} />}
    </div>
  )
}

const GeneratingView: React.FC<{ progress: number; totalPhotos: number }> = ({ progress, totalPhotos }) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-mesh">
    <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 animate-pulse-glow">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
    </div>
    <h1 className="text-2xl font-bold text-center mb-2">Генерируем ваши фото</h1>
    <p className="text-muted-foreground text-center mb-8">Создаём {totalPhotos} уникальных изображений...</p>
    <div className="w-full max-w-xs">
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
        <div className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: ((progress / totalPhotos) * 100) + "%" }} />
      </div>
      <p className="text-sm text-center text-muted-foreground">{progress} из {totalPhotos} фото</p>
    </div>
  </div>
)

const OnboardingView: React.FC<{ onComplete: () => void; onStart: () => void }> = ({ onComplete, onStart }) => {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 100)
    const t2 = setTimeout(() => setStage(2), 1200)
    const t3 = setTimeout(() => setStage(3), 1800)
    const t4 = setTimeout(() => setStage(4), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden bg-gradient-mesh">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-accent/10 blur-3xl animate-float" style={{ animationDelay: "-2s" }} />
      </div>
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
        <div className="relative w-full aspect-square max-w-sm mb-8">
          <div className={"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-primary/30 blur-3xl transition-all duration-1000 " + (stage >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-50")} />
          <div className={"absolute top-1/2 left-1/2 w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden holographic-shine border-4 border-transparent animate-holographic-border shadow-2xl " + (stage >= 1 ? "animate-main-image-enter" : "opacity-0")} style={stage < 1 ? { transform: "translate(-50%, -50%) scale(0.3)" } : undefined}>
            <img src={DEMO_PHOTOS[0]} alt="AI Portrait" className="w-full h-full object-cover" />
          </div>
          <div className={"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full " + (stage >= 2 ? "animate-orbit-ring-enter" : "opacity-0")}>
            <div className="absolute inset-0 animate-orbit-smooth" style={{ "--orbit-duration": "25s" } as React.CSSProperties}>
              {DEMO_PHOTOS.slice(1, 5).map((src, i) => (
                <div key={"inner-" + i} className={"absolute w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-lg " + (i % 2 === 0 ? "neon-frame" : "neon-frame-alt")} style={{ left: "50%", top: "50%", transform: "rotate(" + (i * 90 + 45) + "deg) translateX(95px) rotate(-" + (i * 90 + 45) + "deg) translate(-50%, -50%)", animationDelay: (i * 0.3) + "s" }}>
                  <img src={src} alt={"Portrait " + i} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
          <div className={"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full " + (stage >= 3 ? "animate-orbit-ring-enter" : "opacity-0")} style={{ animationDelay: "0.2s" }}>
            <div className="absolute inset-0 animate-orbit-smooth-reverse" style={{ "--orbit-duration": "35s" } as React.CSSProperties}>
              {DEMO_PHOTOS.slice(5, 11).map((src, i) => (
                <div key={"outer-" + i} className={"absolute w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-md " + (i % 2 === 1 ? "neon-frame-alt" : "neon-frame")} style={{ left: "50%", top: "50%", transform: "rotate(" + (i * 60 + 30) + "deg) translateX(145px) rotate(-" + (i * 60 + 30) + "deg) translate(-50%, -50%)", animationDelay: (i * 0.2 + 0.5) + "s" }}>
                  <img src={src} alt={"Portrait outer " + i} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={"flex flex-col items-center mb-8 transition-all duration-1000 " + (stage >= 4 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 rounded-full overflow-hidden animate-logo-breathe border-2 border-primary/30">
            <img src="/logo-cheetah.png" alt="PinGlass Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold"><span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">PINGLASS</span></h1>
          <p className="text-muted-foreground max-w-md text-lg text-center mt-2">Создавайте впечатляющие AI-фотографии в розовых очках</p>
        </div>
        <button onClick={onStart} className={"w-full max-w-xs py-4 px-8 bg-gradient-to-r from-primary to-accent text-white font-semibold text-lg rounded-3xl hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-primary/25 " + (stage >= 4 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")} style={{ transitionDelay: "200ms" }}>
          <span className="flex items-center justify-center gap-2"><Sparkles className="w-5 h-5" />Начать!</span>
        </button>
        <button onClick={onComplete} className={"mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors " + (stage >= 4 ? "opacity-100" : "opacity-0")} style={{ transitionDelay: "400ms" }}>Пропустить</button>
      </div>
    </div>
  )
}

const DashboardView: React.FC<{ personas: Persona[]; onCreate: () => void; onSelect: (id: string) => void; onDelete: (id: string, e: React.MouseEvent) => void }> = ({ personas, onCreate, onSelect, onDelete }) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Мои аватары</h1>
      <p className="text-muted-foreground text-sm mt-1">Создавайте AI-фотографии в стиле PINGLASS</p>
    </div>
    {personas.length === 0 ? (
      <div className="space-y-6">
        <button onClick={onCreate} className="w-full p-6 sm:p-8 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 rounded-3xl border-2 border-dashed border-primary/30 hover:border-primary/50 transition-all group text-left">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-center justify-center"><Plus className="w-8 h-8 text-primary" /></div>
            <div className="flex-1"><h3 className="text-lg font-semibold text-foreground mb-1">Создать первый аватар</h3><p className="text-muted-foreground text-sm">Загрузите 10-20 своих фото и получите до 23 профессиональных портрета</p></div>
            <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors hidden sm:block" />
          </div>
        </button>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Тарифы</h3>
          <div className="grid grid-cols-3 gap-3">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.id} className={"p-4 rounded-2xl border " + (tier.popular ? "bg-primary/5 border-primary/30" : "bg-card border-border")}>
                {tier.popular && <div className="text-xs text-primary font-medium mb-1 flex items-center gap-1"><Star className="w-3 h-3" /> Популярный</div>}
                <div className="text-2xl font-bold">{tier.photos}</div>
                <div className="text-xs text-muted-foreground">фото</div>
                <div className="text-sm font-semibold mt-2">{tier.price} ₽</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-card rounded-2xl border border-border"><Zap className="w-5 h-5 text-primary mb-2" /><p className="text-sm font-medium">До 23 фото</p><p className="text-xs text-muted-foreground">На выбор</p></div>
          <div className="p-4 bg-card rounded-2xl border border-border"><Shield className="w-5 h-5 text-green-500 mb-2" /><p className="text-sm font-medium">Безопасно</p><p className="text-xs text-muted-foreground">Фото не сохраняются</p></div>
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <button onClick={onCreate} className="aspect-[4/5] rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-3 group active:scale-95">
          <div className="w-12 h-12 rounded-full bg-muted group-hover:bg-primary/10 transition-colors flex items-center justify-center"><Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" /></div>
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Новый аватар</span>
        </button>
        {personas.map((persona) => (
          <div key={persona.id} onClick={() => onSelect(persona.id)} className="aspect-[4/5] bg-card rounded-2xl overflow-hidden relative cursor-pointer group shadow-sm border border-border hover:shadow-md transition-all active:scale-[0.98]">
            {persona.thumbnailUrl ? <img src={persona.thumbnailUrl} alt={persona.name} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" /> : <div className="w-full h-full bg-muted flex flex-col items-center justify-center p-4 text-center"><div className="w-14 h-14 rounded-full bg-background mb-3 flex items-center justify-center"><User className="w-7 h-7 text-muted-foreground" /></div></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 flex flex-col justify-end">
              <h3 className="text-sm font-semibold text-white truncate">{persona.name}</h3>
              <div className="flex items-center gap-1.5 mt-1"><span className={"w-1.5 h-1.5 rounded-full " + (persona.status === "ready" ? "bg-green-400" : "bg-amber-400")} /><span className="text-[10px] text-white/80">{persona.status === "ready" ? persona.generatedAssets.length + " фото" : "Черновик"}</span></div>
            </div>
            <button onClick={(e) => onDelete(persona.id, e)} className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    )}
  </div>
)

const UploadView: React.FC<{ persona: Persona; updatePersona: (id: string, data: Partial<Persona>) => void; onBack: () => void; onNext: () => void }> = ({ persona, updatePersona, onBack, onNext }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || typeof window === "undefined") return
    const newImages: UploadedImage[] = []
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i]
      const base64 = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = (ev) => { resolve((ev.target?.result as string).split(",")[1]) }; reader.readAsDataURL(file) })
      newImages.push({ id: Math.random().toString(), base64, mimeType: file.type, previewUrl: URL.createObjectURL(file) })
    }
    const updates: Partial<Persona> = { images: [...persona.images, ...newImages] }
    if (!persona.thumbnailUrl && newImages.length > 0) updates.thumbnailUrl = newImages[0].previewUrl
    updatePersona(persona.id, updates)
  }
  const removeImage = (imgId: string) => { updatePersona(persona.id, { images: persona.images.filter((i) => i.id !== imgId) }) }
  const progress = Math.min(100, (persona.images.length / 20) * 100)
  const isReady = persona.images.length >= 10

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <input value={persona.name} onChange={(e) => updatePersona(persona.id, { name: e.target.value })} className="text-lg font-semibold bg-transparent border-none p-0 focus:ring-0 outline-none w-full" placeholder="Название аватара..." />
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]"><div className={"h-full transition-all duration-500 " + (isReady ? "bg-green-500" : "bg-primary")} style={{ width: progress + "%" }} /></div>
            <span className={"text-xs " + (isReady ? "text-green-600 font-medium" : "text-muted-foreground")}>{persona.images.length}/20 фото</span>
          </div>
        </div>
      </div>
      <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
        <div className="flex gap-3">
          <Camera className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div><p className="text-sm font-medium text-foreground mb-1">Советы для лучшего результата</p><ul className="text-xs text-muted-foreground space-y-1"><li>• Хорошее освещение лица</li><li>• Разные ракурсы и выражения</li><li>• Без солнечных очков и головных уборов</li></ul></div>
        </div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
        <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-1 group active:scale-95"><Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" /><span className="text-[10px] text-muted-foreground">Добавить</span></button>
        <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
        {persona.images.map((img) => (<div key={img.id} className="aspect-square rounded-xl bg-muted overflow-hidden relative group"><img src={img.previewUrl} alt="" className="w-full h-full object-cover" /><button onClick={() => removeImage(img.id)} className="absolute top-1 right-1 p-1.5 bg-black/50 hover:bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all"><X className="w-3.5 h-3.5" /></button></div>))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
        <button onClick={onNext} disabled={!isReady} className="w-full sm:w-auto px-6 py-3.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-[0.98]">Выбрать пакет<ArrowRight className="w-4 h-4" /></button>
        {!isReady && <p className="text-xs text-center text-muted-foreground mt-2 sm:hidden">Нужно ещё {10 - persona.images.length} фото</p>}
      </div>
    </div>
  )
}

const TierSelectView: React.FC<{ persona: Persona; onBack: () => void; onGenerate: (tier: PricingTier) => void; isGenerating: boolean; isPro: boolean; onUpgrade: (tier: PricingTier) => void; selectedTier: PricingTier; onSelectTier: (tier: PricingTier) => void }> = ({ onBack, onGenerate, isGenerating, isPro, onUpgrade, selectedTier, onSelectTier }) => (
  <div className="space-y-6 pb-24 sm:pb-6">
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"><ArrowLeft className="w-5 h-5" /></button>
      <div><h2 className="text-lg font-semibold">Выберите пакет</h2><p className="text-sm text-muted-foreground">PINGLASS</p></div>
    </div>
    <div className="space-y-3">
      {PRICING_TIERS.map((tier) => (
        <button key={tier.id} onClick={() => onSelectTier(tier)} className={"w-full p-4 sm:p-5 rounded-2xl transition-all border-2 text-left active:scale-[0.99] " + (selectedTier?.id === tier.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-transparent bg-card hover:bg-muted/50")}>
          <div className="flex items-center gap-4">
            <div className={"w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 " + (selectedTier?.id === tier.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><span className="text-2xl font-bold">{tier.photos}</span></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1"><h3 className="font-semibold text-lg text-foreground">{tier.photos} фотографий</h3>{tier.popular && <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs font-medium rounded-full flex items-center gap-1"><Star className="w-3 h-3" /> Хит</span>}</div>
              <p className="text-sm text-muted-foreground">{tier.id === "starter" ? "Попробовать AI-фото" : tier.id === "standard" ? "Оптимальный выбор" : "Максимум возможностей"}</p>
            </div>
            <div className="text-right shrink-0"><div className="text-2xl font-bold text-foreground">{tier.price} ₽</div><div className="text-xs text-muted-foreground">{Math.round(tier.price / tier.photos)} ₽/фото</div></div>
          </div>
          {selectedTier?.id === tier.id && <div className="flex items-center gap-1 mt-3 text-primary text-sm"><CheckCircle2 className="w-4 h-4" />Выбрано</div>}
        </button>
      ))}
    </div>
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 safe-area-inset-bottom">
      {isPro ? (
        <button onClick={() => selectedTier && onGenerate(selectedTier)} disabled={!selectedTier || isGenerating} className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-primary to-accent text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
          {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Генерация...</> : <><Sparkles className="w-4 h-4" />Сгенерировать {selectedTier.photos} фото</>}
        </button>
      ) : (
        <button onClick={() => selectedTier && onUpgrade(selectedTier)} disabled={!selectedTier} className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-primary to-accent text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-primary/25">
          <Crown className="w-4 h-4" />Оплатить {selectedTier?.price} ₽
        </button>
      )}
    </div>
  </div>
)

const ResultsView: React.FC<{ persona: Persona; onBack: () => void; onGenerateMore: () => void }> = ({ persona, onBack, onGenerateMore }) => {
  const assets = [...persona.generatedAssets].sort((a, b) => b.createdAt - a.createdAt)
  const [selectedPhoto, setSelectedPhoto] = useState(assets[0]?.url || null)

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-95"><ArrowLeft className="w-5 h-5" /></button>
        <button onClick={onGenerateMore} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity active:scale-95"><Sparkles className="w-4 h-4" /><span>Создать ещё</span></button>
      </div>
      {assets.length === 0 ? <div className="text-center py-12"><p className="text-muted-foreground">Нет сгенерированных фото</p></div> : (
        <>
          <div className="hidden lg:grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-muted relative group">
                <img src={selectedPhoto || assets[0]?.url} alt="Selected" className="w-full h-full object-cover" />
                <a href={selectedPhoto || assets[0]?.url} download target="_blank" className="absolute bottom-4 right-4 p-3 bg-background/90 backdrop-blur-sm hover:bg-primary text-foreground hover:text-primary-foreground rounded-2xl opacity-0 group-hover:opacity-100 transition-all" rel="noreferrer"><Download className="w-5 h-5" /></a>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-6 bg-card border border-border rounded-3xl space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary"><img src={persona.thumbnailUrl || assets[0]?.url} alt={persona.name} className="w-full h-full object-cover" /></div>
                  <div className="flex-1"><h3 className="font-semibold text-lg">{persona.name}</h3><p className="text-sm text-muted-foreground">PINGLASS</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="text-center"><div className="text-2xl font-bold">{assets.length}</div><div className="text-xs text-muted-foreground">Фотографий</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-primary">AI</div><div className="text-xs text-muted-foreground">Генерация</div></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2">
                {assets.map((asset) => (<button key={asset.id} onClick={() => setSelectedPhoto(asset.url)} className={"aspect-square rounded-2xl overflow-hidden bg-card border-2 transition-all hover:scale-105 " + (selectedPhoto === asset.url ? "border-primary ring-2 ring-primary/20" : "border-transparent")}><img src={asset.url} alt="" className="w-full h-full object-cover" /></button>))}
              </div>
            </div>
          </div>
          <div className="lg:hidden space-y-4">
            <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary"><img src={persona.thumbnailUrl || assets[0]?.url} alt={persona.name} className="w-full h-full object-cover" /></div>
              <div className="flex-1"><h3 className="font-semibold">{persona.name}</h3><p className="text-sm text-muted-foreground">{assets.length} фотографий</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {assets.map((asset) => (<div key={asset.id} className="rounded-2xl overflow-hidden bg-card shadow-sm border border-border group"><div className="aspect-square relative"><img src={asset.url} alt="" className="w-full h-full object-cover" /><a href={asset.url} download target="_blank" className="absolute top-2 right-2 p-2.5 bg-black/50 hover:bg-primary text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all" rel="noreferrer"><Download className="w-4 h-4" /></a></div></div>))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
