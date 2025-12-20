"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react"
import { Loader2, Sun, Moon, Gift, Plus } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"

// Import types and constants
import type { Persona, ViewState, PricingTier } from "./views/types"
import { getErrorMessage } from "@/lib/error-utils"
import { PRICING_TIERS } from "./views/dashboard-view"

// Import custom hooks
import { useAuth, useAvatars, useGeneration, usePayment, usePolling, useSync } from "./hooks"

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

export default function PersonaApp() {
  // Custom hooks
  const { userIdentifier, authStatus, telegramUserId, theme, toggleTheme, showMessage } = useAuth()
  const { personas, setPersonas, loadAvatarsFromServer, createPersona, updatePersona, deletePersona, getPersona } = useAvatars()
  const { isGenerating, setIsGenerating, generationProgress, setGenerationProgress, fileToBase64 } = useGeneration()
  const { isPaymentOpen, setIsPaymentOpen, selectedTier, setSelectedTier } = usePayment()
  const { startPolling, stopPolling } = usePolling()
  const { isSyncing, setIsSyncing, syncPersonaToServer } = useSync()

  // Local state
  const [viewState, setViewState] = useState<ViewState>({ view: "ONBOARDING" })
  const [isReady, setIsReady] = useState(false)
  const [isReferralOpen, setIsReferralOpen] = useState(false)

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null)

  // View state persistence
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

  // Get active persona helper
  const getActivePersona = useCallback(() => {
    return "personaId" in viewState ? getPersona(viewState.personaId) : null
  }, [viewState, getPersona])

  // Initialize app
  useEffect(() => {
    if (typeof window === "undefined") return

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const initApp = async () => {
      const checkMounted = () => {
        if (abortController.signal.aborted) {
          console.log("[Init] Component unmounted, aborting async operations")
          return false
        }
        return true
      }

      try {
        // Wait for auth to complete
        if (authStatus === 'pending') {
          console.log("[Init] Waiting for auth...")
          return
        }

        if (!userIdentifier) {
          console.log("[Init] No user identifier yet")
          return
        }

        // Load avatars with timeout
        const loadAvatarsWithTimeout = Promise.race([
          loadAvatarsFromServer(userIdentifier),
          new Promise<Persona[]>((resolve) => setTimeout(() => resolve([]), 10000))
        ])
        let loadedAvatars = await loadAvatarsWithTimeout

        console.log("[Init] Loaded avatars:", {
          count: loadedAvatars?.length || 0,
          statuses: loadedAvatars?.map(a => ({ id: a.id, status: a.status, photosCount: a.generatedAssets?.length || 0 })) || [],
          telegramUserId: userIdentifier?.telegramUserId
        })

        // Check for pending payment after redirect from T-Bank
        const urlParams = new URLSearchParams(window.location.search)
        const resumePayment = urlParams.get("resume_payment") === "true"
        const urlTelegramUserId = urlParams.get("telegram_user_id")

        if (resumePayment) {
          window.history.replaceState({}, "", window.location.pathname)

          try {
            const tgId = userIdentifier.telegramUserId || (urlTelegramUserId ? parseInt(urlTelegramUserId) : null)

            if (!tgId) {
              console.error("[Resume Payment] No valid Telegram user ID")
              showMessage("Ошибка аутентификации. Пожалуйста, перезапустите приложение в Telegram.")
              if (!checkMounted()) return
              setViewState({ view: "DASHBOARD" })
              setIsReady(true)
              return
            }

            // Reload avatars if URL has telegram_user_id
            if (urlTelegramUserId) {
              console.log("[Resume Payment] Reloading avatars with URL tgId:", tgId)
              loadedAvatars = await loadAvatarsFromServer(userIdentifier)
              if (!checkMounted()) return
            }

            console.log("[Resume Payment] telegramUserId:", tgId, "avatars:", loadedAvatars.length)

            // Find target persona for generation
            let targetPersona: Persona | null = null

            if (loadedAvatars.length > 0) {
              targetPersona = loadedAvatars.reduce((latest, current) =>
                Number(current.id) > Number(latest.id) ? current : latest
              )
              console.log("[Resume Payment] Found most recent avatar:", targetPersona.id, "status:", targetPersona.status)

              // Check if avatar has reference photos
              try {
                const refRes = await fetch(`/api/avatars/${targetPersona.id}/references?telegram_user_id=${tgId}`)
                if (refRes.ok) {
                  const refData = await refRes.json()
                  const refCount = refData.data?.count || refData.count || 0
                  console.log("[Resume Payment] Avatar", targetPersona.id, "has", refCount, "reference photos")

                  if (refCount === 0) {
                    showMessage("Оплата прошла успешно! Загрузите фото для генерации.")
                    if (!checkMounted()) return
                    setPersonas(loadedAvatars)
                    setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: targetPersona.id })
                    setIsReady(true)
                    return
                  }
                }
              } catch (err) {
                console.error("[Resume Payment] Error checking references:", err)
              }
            }

            if (!targetPersona) {
              console.log("[Resume Payment] No avatars found after payment, showing dashboard")
              showMessage("Оплата прошла успешно! Создайте аватар и загрузите фото.")
              localStorage.setItem("pinglass_onboarding_complete", "true")
              if (!checkMounted()) return
              setViewState({ view: "DASHBOARD" })
              setIsReady(true)
              return
            }

            console.log("[Resume Payment] Starting generation for persona:", targetPersona.id)

            const tierPhotos = 23

            if (!checkMounted()) return
            setPersonas(loadedAvatars)
            setViewState({ view: "RESULTS", personaId: targetPersona.id })
            setIsGenerating(true)
            setGenerationProgress({ completed: 0, total: tierPhotos })
            setIsReady(true)

            // Start generation with retry logic
            const startGeneration = async () => {
              const MAX_RETRIES = 3
              const RETRY_DELAY = 2000

              for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                  console.log(`[Resume Payment] Generation attempt ${attempt}/${MAX_RETRIES}`)
                  const res = await fetch("/api/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      telegramUserId: tgId,
                      avatarId: targetPersona.id,
                      styleId: "pinglass",
                      photoCount: tierPhotos,
                      useStoredReferences: true,
                    }),
                  })
                  const data = await res.json()

                  if (data.success && data.data?.jobId) {
                    return data
                  }

                  if (data.error === "PAYMENT_REQUIRED" && attempt < MAX_RETRIES) {
                    console.log(`[Resume Payment] PAYMENT_REQUIRED, retrying in ${RETRY_DELAY}ms...`)
                    await new Promise(r => setTimeout(r, RETRY_DELAY))
                    continue
                  }

                  return data
                } catch (err) {
                  console.error(`[Resume Payment] Attempt ${attempt} failed:`, err)
                  if (attempt === MAX_RETRIES) {
                    return { success: false, error: String(err) }
                  }
                  await new Promise(r => setTimeout(r, RETRY_DELAY))
                }
              }
              return { success: false, error: "Max retries exceeded" }
            }

            startGeneration()
              .then(data => {
                if (data.success && data.data?.jobId) {
                  console.log("[Resume Payment] Generation started, jobId:", data.data.jobId)
                  const jobId = data.data.jobId
                  const personaId = targetPersona.id
                  let lastPhotoCount = 0

                  startPolling(
                    `resume-payment-${jobId}`,
                    async () => {
                      const statusRes = await fetch(`/api/generate?job_id=${jobId}`)
                      const statusData = await statusRes.json()

                      setGenerationProgress({
                        completed: statusData.progress?.completed || 0,
                        total: statusData.progress?.total || tierPhotos,
                      })

                      if (statusData.photos && statusData.photos.length > lastPhotoCount) {
                        const newPhotos = statusData.photos.slice(lastPhotoCount)
                        const newAssets = newPhotos.map((url: string, i: number) => ({
                          id: `${jobId}-${lastPhotoCount + i}`,
                          type: "PHOTO" as const,
                          url,
                          styleId: "pinglass",
                          createdAt: Date.now(),
                        }))

                        setPersonas((prev) =>
                          prev.map((persona) =>
                            persona.id === personaId
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
                        stopPolling(`resume-payment-${jobId}`)
                        setIsGenerating(false)
                        setGenerationProgress({ completed: 0, total: 0 })
                        console.log("[Resume Payment] Generation completed:", statusData.status)
                      }
                    },
                    3000,
                    15 * 60 * 1000
                  )
                } else if (!data.success) {
                  console.error("[Resume Payment] Generation failed:", data.error)
                  if (!checkMounted()) return
                  setIsGenerating(false)

                  if (data.error === "PAYMENT_REQUIRED") {
                    showMessage("Оплата не подтверждена. Попробуйте ещё раз.")
                  } else {
                    showMessage("Ошибка генерации: " + (data.error || "Попробуйте позже"))
                  }

                  setTimeout(() => {
                    if (!checkMounted()) return
                    setViewState({ view: "DASHBOARD" })
                  }, 2000)
                }
              })
              .catch(err => {
                console.error("[Resume Payment] Generation request failed:", err)
                if (!checkMounted()) return
                setIsGenerating(false)
              })

            return
          } catch (e) {
            console.error("[Resume Payment] Error:", e)
            if (!checkMounted()) return
            setPersonas(loadedAvatars)
            setViewState({ view: loadedAvatars.length > 0 ? "DASHBOARD" : "ONBOARDING" })
            setIsReady(true)
            return
          }
        }

        // Normal flow: always show onboarding on app start
        console.log("[Init] Showing ONBOARDING (always shown on app start)", {
          avatarsCount: loadedAvatars?.length || 0
        })
        if (!checkMounted()) return
        setPersonas(loadedAvatars)
        setViewState({ view: "ONBOARDING" })
      } catch (e) {
        console.error("[Init] Critical error:", e)
        if (!checkMounted()) return
        setViewState({ view: "ONBOARDING" })
      } finally {
        if (!checkMounted()) return
        setIsReady(true)
      }
    }

    initApp()

    return () => {
      abortController.abort()
    }
  }, [authStatus, userIdentifier, loadAvatarsFromServer, setPersonas, setIsGenerating, setGenerationProgress, showMessage, startPolling, stopPolling])

  // Save view state when it changes
  useEffect(() => {
    if (isReady) {
      saveViewState(viewState)
    }
  }, [viewState, isReady])

  // Recovery: if view requires persona but it's missing, redirect to DASHBOARD
  useEffect(() => {
    if (!isReady || isGenerating || isSyncing) return
    const viewsRequiringPersona = ["CREATE_PERSONA_UPLOAD", "SELECT_TIER", "RESULTS"]
    if (viewsRequiringPersona.includes(viewState.view) && "personaId" in viewState) {
      const persona = getPersona(viewState.personaId)
      if (!persona) {
        const timeout = setTimeout(() => {
          const stillMissing = !getPersona(viewState.personaId)
          if (stillMissing && !isSyncing && !isGenerating) {
            console.warn("[Recovery] Persona not found, redirecting to DASHBOARD:", viewState.personaId)
            setViewState({ view: "DASHBOARD" })
          }
        }, 500)
        return () => clearTimeout(timeout)
      }
    }
  }, [isReady, viewState, getPersona, isGenerating, isSyncing])

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    localStorage.setItem("pinglass_onboarding_complete", "true")

    if (telegramUserId && userIdentifier) {
      console.log("[Onboarding] Reloading avatars for user:", telegramUserId)
      try {
        const avatars = await loadAvatarsFromServer(userIdentifier)
        console.log("[Onboarding] Loaded", avatars.length, "avatars")
      } catch (err) {
        console.error("[Onboarding] Failed to reload avatars:", err)
      }
    }

    setViewState({ view: "DASHBOARD" })
  }, [telegramUserId, userIdentifier, loadAvatarsFromServer])

  // Create user on onboarding start
  const handleStartOnboarding = useCallback(async () => {
    const tg = window.Telegram?.WebApp
    const initData = tg?.initData

    if (!initData) {
      console.error("[Onboarding] No Telegram initData available")
      showMessage("Откройте приложение через Telegram @Pinglass_bot")
      return
    }

    const tgUser = tg?.initDataUnsafe?.user
    if (!tgUser?.id) {
      console.error("[Onboarding] No telegram user in initDataUnsafe!")
      showMessage("Не удалось получить данные Telegram. Перезапустите приложение.")
      return
    }

    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramInitData: initData }),
      })

      if (!res.ok) {
        console.error("[Onboarding] Failed to create user, status:", res.status)
      } else {
        console.log("[Onboarding] User created successfully")
      }
    } catch (err) {
      console.error("[Onboarding] User creation error:", err)
    }

    console.log("[Onboarding] Reloading avatars after user creation...")
    try {
      const newIdentifier = {
        type: "telegram" as const,
        telegramUserId: tgUser.id,
        deviceId: `tg_${tgUser.id}`,
      }
      const avatars = await loadAvatarsFromServer(newIdentifier)
      console.log("[Onboarding] Loaded", avatars.length, "avatars")
    } catch (err) {
      console.error("[Onboarding] Failed to reload avatars:", err)
    }

    localStorage.setItem("pinglass_onboarding_complete", "true")
    setViewState({ view: "DASHBOARD" })
  }, [loadAvatarsFromServer, showMessage])

  // Create persona handler - immediately creates avatar on server
  const handleCreatePersona = useCallback(async () => {
    if (!telegramUserId) {
      showMessage("Ошибка: не удалось получить Telegram ID")
      return
    }

    try {
      // Create avatar on server immediately
      const res = await fetch("/api/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          name: "Мой аватар",
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create avatar")
      }

      const data = await res.json()
      const dbId = String(data.data?.id || data.id)

      // Create local persona with DB ID
      const newPersona: Persona = {
        id: dbId,
        name: "Мой аватар",
        status: "draft",
        images: [],
        generatedAssets: [],
      }

      setPersonas((prev) => [...prev, newPersona])
      setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: dbId })
    } catch (error) {
      showMessage(`Ошибка: ${error instanceof Error ? error.message : "Не удалось создать аватар"}`)
    }
  }, [telegramUserId, setPersonas, showMessage])

  // Delete persona handler
  const handleDeletePersona = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Удалить?")) {
      deletePersona(id)
      if ("personaId" in viewState && viewState.personaId === id) {
        setViewState({ view: "DASHBOARD" })
      }
    }
  }, [deletePersona, viewState])

  // Upload complete handler
  const handleUploadComplete = useCallback(async () => {
    console.log("[Upload] ===== BUTTON CLICKED =====")
    console.log("[Upload] viewState:", JSON.stringify(viewState))

    let persona = getActivePersona()
    console.log("[Upload] getActivePersona result:", persona?.id || "NULL")

    if (!persona && "personaId" in viewState) {
      console.log("[Upload] Fallback: searching personas for ID:", viewState.personaId)
      persona = getPersona(viewState.personaId)
      console.log("[Upload] Fallback result:", persona?.id || "NULL")
    }

    console.log("[Upload] Final persona:", persona?.id, "images:", persona?.images?.length)

    if (!persona) {
      console.error("[Upload] No active persona found!")
      showMessage("Ошибка: персона не найдена. Попробуйте создать заново.")
      setViewState({ view: "DASHBOARD" })
      return
    }

    if (persona.images.length < 5) {
      console.log("[Upload] Not enough photos:", persona.images.length)
      showMessage(`Загрузите минимум 5 фото (сейчас: ${persona.images.length})`)
      return
    }

    console.log("[Upload] Starting sync with", persona.images.length, "photos")
    showMessage("Загружаю фото...")

    try {
      setIsSyncing(true)
      setIsGenerating(true)
      const dbId = await syncPersonaToServer(persona, telegramUserId)
      console.log("[Upload] Sync complete, DB ID:", dbId)

      // Update persona with DB ID
      updatePersona(persona.id, { id: dbId })

      setViewState({ view: "SELECT_TIER", personaId: dbId })
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Ошибка сохранения")
      console.error("[Upload] Sync failed:", errorMessage, error)
      showMessage(`Ошибка: ${errorMessage}`)
    } finally {
      setIsSyncing(false)
      setIsGenerating(false)
    }
  }, [viewState, getActivePersona, getPersona, syncPersonaToServer, telegramUserId, showMessage, setIsSyncing, setIsGenerating, updatePersona])

  // Generate photos handler
  const handleGenerate = useCallback(async (tier: PricingTier) => {
    const p = getActivePersona()
    if (!p) return

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
          telegramUserId,
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

        startPolling(
          `generate-${data.jobId}`,
          async () => {
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
              stopPolling(`generate-${data.jobId}`)
              updatePersona(p.id, { status: statusData.status === "completed" ? "ready" : "draft" })
              setIsGenerating(false)
              setGenerationProgress({ completed: 0, total: 0 })

              if (statusData.status === "failed") {
                showMessage(statusData.error || "Генерация не удалась")
              }
            }
          },
          3000,
          15 * 60 * 1000
        )
      }
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Ошибка генерации")
      updatePersona(p.id, { status: "draft" })
      setViewState({ view: "SELECT_TIER", personaId: p.id })
      setIsGenerating(false)
      setGenerationProgress({ completed: 0, total: 0 })
    }
  }, [getActivePersona, telegramUserId, fileToBase64, updatePersona, setIsGenerating, setGenerationProgress, setPersonas, startPolling, stopPolling, showMessage])

  // Payment success handler
  const handlePaymentSuccess = useCallback(() => {
    setIsPaymentOpen(false)
    if (viewState.view === "SELECT_TIER" && selectedTier) {
      handleGenerate(selectedTier)
    }
  }, [viewState, selectedTier, handleGenerate])

  // Loading state
  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Block access if not in Telegram Mini App
  if (authStatus === 'not_in_telegram') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-md space-y-6">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Откройте в Telegram
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            PinGlass работает только внутри Telegram Mini App.<br />
            Откройте приложение через бота в Telegram.
          </p>
          <div className="pt-4">
            <a
              href="https://t.me/your_bot_name"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              Открыть в Telegram →
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {viewState.view === "ONBOARDING" ? (
        <OnboardingView
          onComplete={completeOnboarding}
          onStart={handleStartOnboarding}
          isAuthPending={authStatus === 'pending'}
          authError={authStatus === 'failed'}
        />
      ) : (
        <>
          <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5 safe-area-inset-top">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between safe-area-inset-x">
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
          <main className="max-w-5xl mx-auto px-4 py-6 safe-area-inset-x">
            {viewState.view === "DASHBOARD" && (
              <DashboardView
                personas={personas}
                onCreate={handleCreatePersona}
                onSelect={(id) => {
                  const p = getPersona(id)
                  setViewState(
                    p?.status === "draft"
                      ? { view: "CREATE_PERSONA_UPLOAD", personaId: id }
                      : { view: "RESULTS", personaId: id }
                  )
                }}
                onDelete={handleDeletePersona}
              />
            )}
            {viewState.view === "CREATE_PERSONA_UPLOAD" && (
              getActivePersona() ? (
                <UploadView
                  persona={getActivePersona()!}
                  updatePersona={updatePersona}
                  onBack={() => setViewState({ view: "DASHBOARD" })}
                  onNext={handleUploadComplete}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )
            )}
            {viewState.view === "SELECT_TIER" && (
              getActivePersona() ? (
                <TierSelectView
                  persona={getActivePersona()!}
                  onBack={() => setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: viewState.personaId })}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  onUpgrade={(t) => {
                    setSelectedTier(t)
                    setIsPaymentOpen(true)
                  }}
                  selectedTier={selectedTier || PRICING_TIERS[1]}
                  onSelectTier={setSelectedTier}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )
            )}
            {viewState.view === "RESULTS" && (
              getActivePersona() ? (
                <ResultsView
                  persona={getActivePersona()!}
                  onBack={() => setViewState({ view: "DASHBOARD" })}
                  onGenerateMore={() => setViewState({ view: "SELECT_TIER", personaId: viewState.personaId })}
                  isGenerating={isGenerating}
                  generationProgress={generationProgress}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )
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
            telegramUserId={telegramUserId}
            tier={selectedTier || PRICING_TIERS[1]}
            personaId={"personaId" in viewState ? String(viewState.personaId) : undefined}
          />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <ReferralPanel telegramUserId={telegramUserId} isOpen={isReferralOpen} onClose={() => setIsReferralOpen(false)} />
      </Suspense>
    </div>
  )
}
