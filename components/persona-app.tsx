"use client"

import type React from "react"
import { useState, useEffect, lazy, Suspense } from "react"
import { Loader2, Sun, Moon, Gift, Plus } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"

// Import types and constants
import type { Persona, ViewState, PricingTier } from "./views/types"
import { PRICING_TIERS } from "./views/dashboard-view"

// Export for other components
export { PRICING_TIERS } from "./views/dashboard-view"
export type { PricingTier } from "./views/types"

// Loading fallback component
const ComponentLoader = () => (
  <div className="flex items-center justify-center py-4">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
)

// Lazy load view components with dynamic imports
const OnboardingView = dynamic(() => import("./views/onboarding-view"), {
  loading: () => <ComponentLoader />,
  ssr: false,
})

const DashboardView = dynamic(() => import("./views/dashboard-view"), {
  loading: () => <ComponentLoader />,
})

const UploadView = dynamic(() => import("./views/upload-view"), {
  loading: () => <ComponentLoader />,
})

const TierSelectView = dynamic(() => import("./views/tier-select-view"), {
  loading: () => <ComponentLoader />,
})

const ResultsView = dynamic(() => import("./views/results-view"), {
  loading: () => <ComponentLoader />,
})

// Lazy load heavy components
const PaymentModal = lazy(() => import("./payment-modal").then((m) => ({ default: m.PaymentModal })))
const ReferralPanel = lazy(() => import("./referral-panel").then((m) => ({ default: m.ReferralPanel })))
const AnimatedLogoCompact = lazy(() => import("./animated-logo").then((m) => ({ default: m.AnimatedLogoCompact })))

function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  let deviceId = localStorage.getItem("pinglass_device_id")
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem("pinglass_device_id", deviceId)
  }
  return deviceId
}

export default function PersonaApp() {
  const [viewState, setViewState] = useState<ViewState>({ view: "ONBOARDING" })
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 })
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [deviceId, setDeviceId] = useState("")
  const [isReady, setIsReady] = useState(false)
  const [selectedTier, setSelectedTier] = useState<PricingTier>(PRICING_TIERS[1])
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [isReferralOpen, setIsReferralOpen] = useState(false)

  // Load avatars from server
  const loadAvatarsFromServer = async (deviceIdParam: string): Promise<Persona[]> => {
    try {
      // Use include_photos=true (default) to get all avatars with photos in ONE request
      const res = await fetch(`/api/avatars?device_id=${deviceIdParam}`)
      if (!res.ok) return []

      const data = await res.json()
      if (!data.avatars || data.avatars.length === 0) return []

      // Map avatars directly - photos are already included in response
      const loadedPersonas: Persona[] = data.avatars.map(
        (avatar: {
          id: number
          name: string
          status: string
          thumbnailUrl?: string
          generatedPhotos?: Array<{
            id: number
            styleId: string
            prompt?: string
            imageUrl: string
            createdAt: string
          }>
        }) => ({
          id: String(avatar.id),
          name: avatar.name,
          status: avatar.status as "draft" | "processing" | "ready",
          images: [],
          generatedAssets: (avatar.generatedPhotos || []).map((photo) => ({
            id: String(photo.id),
            type: "PHOTO" as const,
            url: photo.imageUrl,
            styleId: photo.styleId,
            prompt: photo.prompt,
            createdAt: new Date(photo.createdAt).getTime(),
          })),
          thumbnailUrl: avatar.thumbnailUrl,
        })
      )

      setPersonas(loadedPersonas)
      return loadedPersonas
    } catch (err) {
      console.error("[Init] Failed to load avatars:", err)
      return []
    }
  }

  const saveViewState = (state: ViewState) => {
    if (typeof window === "undefined") return
    localStorage.setItem("pinglass_view_state", JSON.stringify(state))
  }

  const loadViewState = (): ViewState | null => {
    if (typeof window === "undefined") return null
    try {
      const saved = localStorage.getItem("pinglass_view_state")
      if (!saved) return null
      return JSON.parse(saved) as ViewState
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const initApp = async () => {
      let currentDeviceId = getDeviceId()
      setDeviceId(currentDeviceId)

      try {
        const savedTheme = localStorage.getItem("pinglass_theme") as "dark" | "light" | null
        if (savedTheme) {
          setTheme(savedTheme)
          document.documentElement.classList.toggle("light", savedTheme === "light")
        }

        // Telegram auth with timeout to prevent blank screen
        try {
          const tg = window.Telegram?.WebApp
          if (tg?.initData) {
            // Add 5s timeout for Telegram auth to prevent hanging
            const authPromise = fetch("/api/telegram/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ initData: tg.initData }),
            })
            const timeoutPromise = new Promise<Response>((_, reject) =>
              setTimeout(() => reject(new Error("Telegram auth timeout")), 5000)
            )

            const authRes = await Promise.race([authPromise, timeoutPromise])

            if (authRes.ok) {
              const authData = await authRes.json()
              if (authData.deviceId) {
                // Update deviceId to Telegram-based ID for persistence across sessions
                localStorage.setItem("pinglass_device_id", authData.deviceId)
                currentDeviceId = authData.deviceId
                setDeviceId(authData.deviceId)
                console.log("[TG Auth] Using Telegram deviceId:", authData.deviceId)
              }
            }

            const telegramRefCode = tg.initDataUnsafe?.start_param
            if (telegramRefCode && !localStorage.getItem("pinglass_referral_applied")) {
              localStorage.setItem("pinglass_pending_referral", telegramRefCode)
              console.log("Telegram referral code detected:", telegramRefCode)
            }

            tg.ready()
            tg.expand()
          }
        } catch (e) {
          console.error("Failed to process Telegram auth:", e)
        }

        // Use the current deviceId (may have been updated by Telegram auth)
        // Add timeout to prevent blank screen if API hangs
        const loadAvatarsWithTimeout = Promise.race([
          loadAvatarsFromServer(currentDeviceId),
          new Promise<Persona[]>((resolve) => setTimeout(() => resolve([]), 10000)) // 10s timeout
        ])
        let loadedAvatars = await loadAvatarsWithTimeout

        // Check if onboarding was completed (flag OR has avatars)
        const onboardingComplete = localStorage.getItem("pinglass_onboarding_complete") === "true"
        const hasAvatars = loadedAvatars && loadedAvatars.length > 0

        // Check for pending payment after redirect from T-Bank
        const urlParams = new URLSearchParams(window.location.search)
        const resumePayment = urlParams.get("resume_payment") === "true"

        if (resumePayment) {
          // Clean URL without reload
          window.history.replaceState({}, "", window.location.pathname)

          try {
            const pendingPaymentStr = localStorage.getItem("pinglass_pending_payment")
            if (pendingPaymentStr) {
              const pendingPayment = JSON.parse(pendingPaymentStr)
              const { personaId, tierPhotos, timestamp } = pendingPayment

              // Only use if less than 24 hours old (increased from 1 hour for slow payments)
              if (timestamp && Date.now() - timestamp < 86400000) {
                localStorage.removeItem("pinglass_pending_payment")

                // Find the persona - try exact match first
                let targetPersona = loadedAvatars.find(p => String(p.id) === String(personaId))

                // Fallback: if not found by ID (timestamp vs DB ID mismatch), use most recent non-processing persona
                if (!targetPersona && loadedAvatars.length > 0) {
                  console.warn("[Resume Payment] Persona not found by ID, searching for suitable fallback. Searched for:", personaId, "Available:", loadedAvatars.map(p => ({ id: p.id, status: p.status })))

                  // Filter out personas that are already processing
                  const availablePersonas = loadedAvatars.filter(p => p.status !== 'processing')

                  if (availablePersonas.length > 0) {
                    // Use the most recently created (highest ID)
                    targetPersona = availablePersonas.reduce((latest, current) =>
                      Number(current.id) > Number(latest.id) ? current : latest
                    )
                    console.log("[Resume Payment] Using fallback persona:", targetPersona.id)
                  }
                }

                // If no persona found (DB was cleared), user needs to re-upload photos
                // because reference photos are stored with the persona in DB
                if (!targetPersona) {
                  console.log("[Resume Payment] No avatars found - user must re-upload photos")
                  console.log("[Resume Payment] Payment was successful, reference photos need to be uploaded again")

                  // Mark user as Pro so they don't have to pay again after upload
                  localStorage.setItem("pinglass_is_pro", "true")

                  // Show upload view - user will upload photos and proceed to generation
                  setPersonas([])
                  setViewState({ view: "CREATE_PERSONA_UPLOAD" })
                  setIsReady(true)
                  return // Exit - user will complete flow via normal upload path
                }

                if (targetPersona) {
                  console.log("[Resume Payment] Starting generation for persona:", targetPersona.id, "photos:", tierPhotos)

                  // Set UI state for generation
                  setPersonas(loadedAvatars)
                  setViewState({ view: "RESULTS", personaId: targetPersona.id })
                  setIsGenerating(true)
                  setGenerationProgress({ completed: 0, total: tierPhotos || 23 })
                  setIsReady(true)

                  // Start generation using stored reference photos
                  fetch("/api/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      deviceId: currentDeviceId,
                      avatarId: targetPersona.id,
                      styleId: "pinglass",
                      photoCount: tierPhotos || 23,
                      useStoredReferences: true,
                    }),
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data.success) {
                        console.log("[Resume Payment] Generation started, jobId:", data.data?.jobId)
                      } else {
                        console.error("[Resume Payment] Generation failed:", data.error)
                        setIsGenerating(false)
                      }
                    })
                    .catch(err => {
                      console.error("[Resume Payment] Generation request failed:", err)
                      setIsGenerating(false)
                    })

                  return // Skip normal flow - generation started
                }
                // Note: if !targetPersona, we already returned above (line 254)
              } else {
                // Expired - clean up
                localStorage.removeItem("pinglass_pending_payment")
              }
            }
            
            // If resume_payment but no valid pending payment data - go to dashboard
            console.log("[Resume Payment] No valid pending payment, showing dashboard")
            setPersonas(loadedAvatars)
            setViewState({ view: hasAvatars ? "DASHBOARD" : "ONBOARDING" })
            setIsReady(true)
            return // Exit after handling resume_payment
            
          } catch (e) {
            console.error("[Resume Payment] Error:", e)
            localStorage.removeItem("pinglass_pending_payment")
            // On error, show dashboard instead of onboarding
            setPersonas(loadedAvatars)
            setViewState({ view: hasAvatars ? "DASHBOARD" : "ONBOARDING" })
            setIsReady(true)
            return
          }
        }

        // Normal flow (NOT resume_payment):
        // ALWAYS show onboarding on app start (user requested)
        // User can proceed via "Начать" button which calls completeOnboarding() or handleCreatePersona()
        setViewState({ view: "ONBOARDING" })
      } catch (e) {
        console.error("[Init] Critical error:", e)
        // On any error, show onboarding as fallback
        setViewState({ view: "ONBOARDING" })
      } finally {
        // ALWAYS show UI - never leave user on blank screen
        setIsReady(true)
      }
    }

    initApp()
  }, [])

  useEffect(() => {
    if (isReady) {
      saveViewState(viewState)
    }
  }, [viewState, isReady])

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    localStorage.setItem("pinglass_theme", newTheme)
    document.documentElement.classList.toggle("light", newTheme === "light")
  }

  const completeOnboarding = () => {
    localStorage.setItem("pinglass_onboarding_complete", "true")
    setViewState({ view: "DASHBOARD" })
  }

  const handleCreatePersona = () => {
    // Mark onboarding as complete when user starts creating
    localStorage.setItem("pinglass_onboarding_complete", "true")
    const newId = Date.now().toString()
    setPersonas([
      ...personas,
      { id: newId, name: "Мой аватар", status: "draft", images: [], generatedAssets: [] },
    ])
    setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: newId })
  }

  const updatePersona = (id: string, updates: Partial<Persona>) => {
    setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }

  const deletePersona = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Удалить?")) {
      setPersonas((prev) => prev.filter((p) => p.id !== id))
      if ("personaId" in viewState && viewState.personaId === id) setViewState({ view: "DASHBOARD" })
    }
  }

  const getActivePersona = () =>
    "personaId" in viewState ? personas.find((p) => p.id === viewState.personaId) : null

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        if (result) {
          resolve(result.split(",")[1])
        } else {
          reject(new Error("Empty file"))
        }
      }
      reader.onerror = () => reject(reader.error || new Error("Read failed"))
      reader.readAsDataURL(file)
    })
  }


  // Sync persona to server: create avatar in DB and upload photos
  // Returns the DB avatar ID (numeric string like "123")
  const syncPersonaToServer = async (persona: Persona): Promise<string> => {
    // Check if already synced (has numeric DB ID, not timestamp)
    const parsedId = parseInt(persona.id)
    const isDbId = !isNaN(parsedId) && parsedId > 0 && parsedId <= 2147483647
    
    if (isDbId) {
      console.log("[Sync] Persona already has DB ID:", persona.id)
      return persona.id
    }

    console.log("[Sync] Creating avatar in DB for persona:", persona.id)

    try {
      // Step 1: Create avatar in DB
      const createRes = await fetch("/api/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          name: persona.name || "Мой аватар",
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || "Failed to create avatar")
      }

      const avatarData = await createRes.json()
      const dbAvatarId = String(avatarData.id)
      console.log("[Sync] Avatar created with DB ID:", dbAvatarId)

      // Step 2: Upload reference photos if any
      if (persona.images && persona.images.length > 0) {
        console.log("[Sync] Uploading", persona.images.length, "reference photos")
        
        const referenceImages = await Promise.all(
          persona.images.slice(0, 14).map((img) => fileToBase64(img.file))
        )

        // RELIABILITY: Retry upload up to 3 times
        let uploadSuccess = false
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const uploadRes = await fetch(`/api/avatars/${dbAvatarId}/references`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deviceId,
                referenceImages,
              }),
            })

            if (uploadRes.ok) {
              console.log("[Sync] Reference photos uploaded successfully")
              uploadSuccess = true
              break
            }
            console.warn(`[Sync] Upload attempt ${attempt} failed, status: ${uploadRes.status}`)
          } catch (uploadError) {
            console.warn(`[Sync] Upload attempt ${attempt} error:`, uploadError)
          }

          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 1000 * attempt)) // Exponential backoff
          }
        }

        if (!uploadSuccess) {
          console.error("[Sync] Failed to upload references after 3 attempts - photos will be sent during generation")
          // Note: handleGenerate will re-send photos from local memory as fallback
        }
      }

      // Step 3: Update local persona with DB ID
      setPersonas((prev) =>
        prev.map((p) =>
          p.id === persona.id
            ? { ...p, id: dbAvatarId }
            : p
        )
      )

      return dbAvatarId
    } catch (error) {
      console.error("[Sync] Error syncing persona:", error)
      throw error
    }
  }


  // Handle transition from Upload to SelectTier - sync first!
  const handleUploadComplete = async () => {
    const persona = getActivePersona()
    if (!persona) {
      console.error("[Upload] No active persona")
      return
    }

    if (persona.images.length < 10) {
      alert("Загрузите минимум 10 фото")
      return
    }

    try {
      setIsGenerating(true) // Show loading state
      const dbId = await syncPersonaToServer(persona)
      setViewState({ view: "SELECT_TIER", personaId: dbId })
    } catch (error) {
      alert("Ошибка сохранения. Попробуйте ещё раз.")
      console.error("[Upload] Sync failed:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerate = async (tier: PricingTier) => {
    const p = getActivePersona()!
    setIsGenerating(true)
    setGenerationProgress({ completed: 0, total: tier.photos })

    setViewState({ view: "RESULTS", personaId: p.id })
    updatePersona(p.id, { status: "processing" })

    try {
      const referenceImages = await Promise.all(p.images.slice(0, 14).map((img) => fileToBase64(img.file)))

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          avatarId: p.id,
          styleId: "pinglass",
          photoCount: tier.photos,
          referenceImages,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      const data = await res.json()

      if (data.photos && data.photos.length > 0) {
        const newAssets = data.photos.map((url: string, i: number) => ({
          id: `${data.jobId}-${i}`,
          type: "PHOTO" as const,
          url,
          styleId: "pinglass",
          createdAt: Date.now(),
        }))
        updatePersona(p.id, {
          status: "ready",
          generatedAssets: [...newAssets, ...p.generatedAssets],
          thumbnailUrl: p.thumbnailUrl || newAssets[0]?.url,
        })
        setGenerationProgress({ completed: data.photos.length, total: tier.photos })
        setIsGenerating(false)
        return
      }

      if (data.jobId) {
        let lastPhotoCount = 0
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/generate?job_id=${data.jobId}`)
            const statusData = await statusRes.json()

            setGenerationProgress({
              completed: statusData.progress?.completed || 0,
              total: statusData.progress?.total || tier.photos,
            })

            if (statusData.photos && statusData.photos.length > lastPhotoCount) {
              const newPhotos = statusData.photos.slice(lastPhotoCount)
              const newAssets = newPhotos.map((url: string, i: number) => ({
                id: `${data.jobId}-${lastPhotoCount + i}`,
                type: "PHOTO" as const,
                url,
                styleId: "pinglass",
                createdAt: Date.now(),
              }))

              setPersonas((prev) =>
                prev.map((persona) =>
                  persona.id === p.id
                    ? {
                        ...persona,
                        generatedAssets: [...newAssets, ...persona.generatedAssets],
                        thumbnailUrl: persona.thumbnailUrl || newAssets[0]?.url,
                      }
                    : persona
                )
              )
              lastPhotoCount = statusData.photos.length
            }

            if (statusData.status === "completed" || statusData.status === "failed") {
              clearInterval(pollInterval)
              updatePersona(p.id, { status: statusData.status === "completed" ? "ready" : "draft" })
              setIsGenerating(false)
              setGenerationProgress({ completed: 0, total: 0 })

              if (statusData.status === "failed") {
                alert(statusData.error || "Генерация не удалась")
              }
            }
          } catch (pollError) {
            console.error("Polling error:", pollError)
          }
        }, 3000)

        setTimeout(() => {
          clearInterval(pollInterval)
          setIsGenerating(false)
        }, 15 * 60 * 1000)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка генерации")
      updatePersona(p.id, { status: "draft" })
      setViewState({ view: "SELECT_TIER", personaId: p.id })
      setIsGenerating(false)
      setGenerationProgress({ completed: 0, total: 0 })
    }
  }

  const handlePaymentSuccess = () => {
    setIsPaymentOpen(false)
    if (viewState.view === "SELECT_TIER") handleGenerate(selectedTier)
  }

  if (!isReady)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {viewState.view === "ONBOARDING" ? (
        <OnboardingView onComplete={completeOnboarding} onStart={handleCreatePersona} />
      ) : (
        <>
          <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Suspense fallback={<div className="w-10 h-10" />}>
                  <AnimatedLogoCompact
                    size={40}
                    className="shadow-xl shadow-primary/30 rounded-2xl ring-2 ring-primary/20"
                  />
                </Suspense>
                <span className="font-bold text-lg drop-shadow-sm">PinGlass</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsReferralOpen(true)}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 hover:from-amber-500/30 hover:to-orange-500/20 text-amber-600 hover:text-amber-500 transition-all shadow-md shadow-amber-500/10"
                  title="Партнёрская программа"
                >
                  <Gift className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleTheme}
                  className="p-2.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-md shadow-black/5"
                >
                  {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                {viewState.view === "DASHBOARD" && (
                  <button
                    onClick={handleCreatePersona}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-2xl text-sm font-semibold shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.02] transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Создать
                  </button>
                )}
              </div>
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-4 py-6">
            {viewState.view === "DASHBOARD" && (
              <DashboardView
                personas={personas}
                onCreate={handleCreatePersona}
                onSelect={(id) => {
                  const p = personas.find((x) => x.id === id)
                  setViewState(
                    p?.status === "draft"
                      ? { view: "CREATE_PERSONA_UPLOAD", personaId: id }
                      : { view: "RESULTS", personaId: id }
                  )
                }}
                onDelete={deletePersona}
              />
            )}
            {viewState.view === "CREATE_PERSONA_UPLOAD" && getActivePersona() && (
              <UploadView
                persona={getActivePersona()!}
                updatePersona={updatePersona}
                onBack={() => setViewState({ view: "DASHBOARD" })}
                onNext={handleUploadComplete}
              />
            )}
            {viewState.view === "SELECT_TIER" && getActivePersona() && (
              <TierSelectView
                persona={getActivePersona()!}
                onBack={() => setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: viewState.personaId })}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                onUpgrade={(t) => {
                  setSelectedTier(t)
                  setIsPaymentOpen(true)
                }}
                selectedTier={selectedTier}
                onSelectTier={setSelectedTier}
              />
            )}
            {viewState.view === "RESULTS" && getActivePersona() && (
              <ResultsView
                persona={getActivePersona()!}
                onBack={() => setViewState({ view: "DASHBOARD" })}
                onGenerateMore={() => setViewState({ view: "SELECT_TIER", personaId: viewState.personaId })}
                isGenerating={isGenerating}
                generationProgress={generationProgress}
              />
            )}
          </main>
          <footer className="mt-auto py-6 px-4 border-t border-border/50">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <Link href="/oferta" className="hover:text-foreground transition-colors">
                  Публичная оферта
                </Link>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Политика конфиденциальности
                </Link>
              </div>
              <div className="text-center sm:text-right">
                <p>ИП Бобров С.Н. ИНН 772790586848</p>
              </div>
            </div>
          </footer>
        </>
      )}
      {isPaymentOpen && (
        <Suspense fallback={<ComponentLoader />}>
          <PaymentModal
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            onSuccess={handlePaymentSuccess}
            deviceId={deviceId}
            tier={selectedTier}
            personaId={"personaId" in viewState ? String(viewState.personaId) : undefined}
          />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <ReferralPanel deviceId={deviceId} isOpen={isReferralOpen} onClose={() => setIsReferralOpen(false)} />
      </Suspense>
    </div>
  )
}
