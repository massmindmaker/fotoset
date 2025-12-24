"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react"
import { Loader2, Sun, Moon, Gift, Plus } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"

// Import types and constants
import type { Persona, ViewState, PricingTier, ReferencePhoto } from "./views/types"
import { getErrorMessage } from "@/lib/error-utils"
import { PRICING_TIERS } from "./views/dashboard-view"

// Import custom hooks
import { useAuth, useAvatars, useGeneration, usePayment, usePolling, useSync } from "./hooks"
import { useNetworkStatus } from "@/lib/network-status"

// Import error handling components
import { ErrorModal, OfflineBanner } from "./error-modal"
import { PaymentSuccess } from "./payment-success"

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

const AvatarDetailView = dynamic(() => import("./views/avatar-detail-view"), {
  loading: () => <ComponentLoader />,
})

// Lazy load heavy components
const PaymentModal = lazy(() => import("./payment-modal").then((m) => ({ default: m.PaymentModal })))
const ReferralPanel = lazy(() => import("./referral-panel").then((m) => ({ default: m.ReferralPanel })))
const AnimatedLogoCompact = lazy(() => import("./animated-logo").then((m) => ({ default: m.AnimatedLogoCompact })))

export default function PersonaApp() {
  // CRITICAL: Check for payment redirect BEFORE anything else
  // Extract all params synchronously on first render
  const [paymentRedirectData] = useState(() => {
    if (typeof window === "undefined") return null
    const urlParams = new URLSearchParams(window.location.search)
    const isPaymentRedirect = urlParams.get("resume_payment") === "true"

    if (isPaymentRedirect) {
      const tier = urlParams.get("tier") || "premium"
      const tgId = urlParams.get("telegram_user_id")

      // Mark onboarding as complete
      localStorage.setItem("pinglass_onboarding_complete", "true")

      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname)

      console.log("[Payment Redirect] Detected, tier:", tier, "tgId:", tgId)
      return { tier, telegramUserId: tgId ? parseInt(tgId, 10) : null }
    }
    return null
  })

  // Custom hooks
  const { userIdentifier, authStatus, telegramUserId, theme, toggleTheme, showMessage } = useAuth()
  const { personas, setPersonas, loadAvatarsFromServer, createPersona, updatePersona, deletePersona, getPersona } = useAvatars()
  const { isGenerating, setIsGenerating, generationProgress, setGenerationProgress, fileToBase64 } = useGeneration()
  const { isPaymentOpen, setIsPaymentOpen, selectedTier, setSelectedTier } = usePayment()
  const { startPolling, stopPolling } = usePolling()
  const { isSyncing, setIsSyncing, syncPersonaToServer } = useSync()
  const { isOnline } = useNetworkStatus()

  // Check for payment redirect SYNCHRONOUSLY before first render to prevent onboarding flash
  const getInitialViewState = (): ViewState => {
    if (typeof window === "undefined") return { view: "ONBOARDING" }
    return { view: "ONBOARDING" }
  }

  // Local state
  const [viewState, setViewState] = useState<ViewState>(getInitialViewState)
  const [isReady, setIsReady] = useState(false)
  const [isReferralOpen, setIsReferralOpen] = useState(false)

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean
    title?: string
    message: string
    onRetry?: () => void
  }>({ isOpen: false, message: "" })

  // Payment success celebration state
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)

  // Reference photos state for Avatar Detail View
  const [referencePhotos, setReferencePhotos] = useState<ReferencePhoto[]>([])
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)

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

  // PAYMENT REDIRECT: Start generation IMMEDIATELY without waiting for auth
  useEffect(() => {
    if (!paymentRedirectData) return
    if (typeof window === "undefined") return

    const startGenerationAfterPayment = async () => {
      const { tier, telegramUserId: tgId } = paymentRedirectData

      if (!tgId) {
        console.error("[Payment Redirect] No telegram_user_id in redirect")
        setViewState({ view: "DASHBOARD" })
        setIsReady(true)
        return
      }

      console.log("[Payment Redirect] Starting generation immediately, tgId:", tgId, "tier:", tier)

      // Get tier photo count
      const TIER_PHOTOS: Record<string, number> = { starter: 7, standard: 15, premium: 23 }
      const tierPhotos = TIER_PHOTOS[tier] || 23

      // Show generation screen immediately
      setIsGenerating(true)
      setGenerationProgress({ completed: 0, total: tierPhotos })
      setIsReady(true)

      // Find or create avatar and start generation
      try {
        // First, get user's avatars
        const avatarsRes = await fetch(`/api/avatars?telegram_user_id=${tgId}`)
        const avatarsData = await avatarsRes.json()
        const avatars = avatarsData.data || []

        console.log("[Payment Redirect] Loaded avatars:", avatars.length)

        let targetAvatarId: string | null = null

        if (avatars.length > 0) {
          // Use most recent avatar
          const mostRecent = avatars.reduce((a: { id: number }, b: { id: number }) =>
            Number(b.id) > Number(a.id) ? b : a
          )
          targetAvatarId = String(mostRecent.id)
          console.log("[Payment Redirect] Using avatar:", targetAvatarId)

          // Update personas state
          setPersonas(avatars.map((a: { id: number; name?: string; status?: string; thumbnail_url?: string }) => ({
            id: String(a.id),
            name: a.name || "Мой аватар",
            status: a.status || "draft",
            thumbnailUrl: a.thumbnail_url,
            generatedAssets: [],
          })))

          // Set view to RESULTS with this persona
          setViewState({ view: "RESULTS", personaId: targetAvatarId })
        } else {
          // No avatar - show dashboard
          console.log("[Payment Redirect] No avatars, showing dashboard")
          setIsGenerating(false)
          setViewState({ view: "DASHBOARD" })
          return
        }

        // Start generation
        console.log("[Payment Redirect] Calling /api/generate")
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegramUserId: tgId,
            avatarId: targetAvatarId,
            styleId: "pinglass",
            photoCount: tierPhotos,
            useStoredReferences: true,
          }),
        })
        const genData = await genRes.json()

        if (genData.success && genData.data?.jobId) {
          console.log("[Payment Redirect] Generation started, jobId:", genData.data.jobId)
          const jobId = genData.data.jobId
          let lastPhotoCount = 0

          // Poll for progress
          startPolling(
            `payment-gen-${jobId}`,
            async () => {
              const statusRes = await fetch(`/api/generate?job_id=${jobId}`)
              const statusData = await statusRes.json()

              setGenerationProgress({
                completed: statusData.progress?.completed || 0,
                total: statusData.progress?.total || tierPhotos,
              })

              // Update photos as they arrive
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
                    persona.id === targetAvatarId
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
                stopPolling(`payment-gen-${jobId}`)
                setIsGenerating(false)

                if (statusData.status === "completed") {
                  console.log("[Payment Redirect] Generation completed!")
                }
              }
            },
            { intervalMs: 3000, maxAttempts: 200 }
          )
        } else {
          console.error("[Payment Redirect] Generation failed:", genData.error)
          setIsGenerating(false)
        }
      } catch (err) {
        console.error("[Payment Redirect] Error:", err)
        setIsGenerating(false)
        setViewState({ view: "DASHBOARD" })
      }
    }

    startGenerationAfterPayment()
  }, [paymentRedirectData, setIsGenerating, setGenerationProgress, setPersonas, startPolling, stopPolling])

  // Initialize app (normal flow - skip if payment redirect)
  useEffect(() => {
    if (paymentRedirectData) return // Skip - handled by payment redirect effect
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

        // Normal flow: check if onboarding already completed
        const onboardingComplete = localStorage.getItem("pinglass_onboarding_complete") === "true"

        if (!checkMounted()) return
        setPersonas(loadedAvatars)

        if (onboardingComplete && loadedAvatars.length > 0) {
          console.log("[Init] Onboarding complete, showing DASHBOARD", {
            avatarsCount: loadedAvatars.length
          })
          setViewState({ view: "DASHBOARD" })
        } else {
          console.log("[Init] Showing ONBOARDING", {
            onboardingComplete,
            avatarsCount: loadedAvatars?.length || 0
          })
          setViewState({ view: "ONBOARDING" })
        }
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

      const data = await res.json()

      if (!res.ok) {
        // Handle LIMIT_REACHED with user-friendly message
        if (data.error?.code === "LIMIT_REACHED") {
          showMessage("Достигнут лимит аватаров (3). Удалите существующий аватар.")
          return
        }
        throw new Error(data.error?.message || "Не удалось создать аватар")
      }
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

  // Delete persona handler with Telegram-native confirm
  const handleDeletePersona = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const performDelete = async () => {
      const success = await deletePersona(id, telegramUserId)
      if (success) {
        if ("personaId" in viewState && viewState.personaId === id) {
          setViewState({ view: "DASHBOARD" })
        }
      } else {
        showMessage("Не удалось удалить аватар")
      }
    }

    // Use Telegram.WebApp.showConfirm for native Mini App UX
    const tg = window.Telegram?.WebApp
    if (tg?.showConfirm) {
      tg.showConfirm("Удалить этот аватар?", (confirmed: boolean) => {
        if (confirmed) {
          performDelete()
        }
      })
    } else {
      // Fallback for non-Telegram environment
      if (confirm("Удалить?")) {
        performDelete()
      }
    }
  }, [deletePersona, viewState, telegramUserId, showMessage])

  // Load reference photos for Avatar Detail View
  const loadReferencePhotos = useCallback(async (avatarId: string) => {
    if (!telegramUserId) return

    setIsLoadingReferences(true)
    try {
      const response = await fetch(`/api/avatars/${avatarId}/references`, {
        headers: {
          "X-Telegram-User-Id": String(telegramUserId),
        },
      })

      if (response.ok) {
        const data = await response.json()
        setReferencePhotos(data.references || [])
      }
    } catch (error) {
      console.error("[AvatarDetail] Failed to load references:", error)
    } finally {
      setIsLoadingReferences(false)
    }
  }, [telegramUserId])

  // Add photos to avatar
  const handleAddPhotos = useCallback(async (files: File[]) => {
    const activePersona = getActivePersona()
    if (!activePersona || !telegramUserId) return

    // Convert files to base64
    const base64Images = await Promise.all(
      files.slice(0, 20 - referencePhotos.length).map((file) => fileToBase64(file))
    )

    const response = await fetch(`/api/avatars/${activePersona.id}/references`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-User-Id": String(telegramUserId),
      },
      body: JSON.stringify({
        referenceImages: base64Images,
        telegramUserId,
      }),
    })

    if (response.ok) {
      // Reload reference photos and avatars to get updated thumbnail
      await loadReferencePhotos(activePersona.id)
      if (userIdentifier) await loadAvatarsFromServer(userIdentifier)
    } else {
      showMessage("Ошибка при загрузке фото")
    }
  }, [getActivePersona, telegramUserId, userIdentifier, referencePhotos.length, fileToBase64, loadReferencePhotos, loadAvatarsFromServer, showMessage])

  // Delete single reference photo
  const handleDeleteReferencePhoto = useCallback(async (photoId: number) => {
    const activePersona = getActivePersona()
    if (!activePersona || !telegramUserId) return

    const response = await fetch(`/api/avatars/${activePersona.id}/references/${photoId}`, {
      method: "DELETE",
      headers: {
        "X-Telegram-User-Id": String(telegramUserId),
      },
    })

    if (response.ok) {
      setReferencePhotos((prev) => prev.filter((p) => p.id !== photoId))
      // Reload avatars to get updated thumbnail
      if (userIdentifier) await loadAvatarsFromServer(userIdentifier)
    } else {
      showMessage("Ошибка при удалении фото")
    }
  }, [getActivePersona, telegramUserId, userIdentifier, loadAvatarsFromServer, showMessage])

  // Open Avatar Detail View
  const handleSelectAvatar = useCallback((id: string) => {
    const p = getPersona(id)
    if (!p) return

    // If avatar has reference photos, show detail view
    // If it's draft without refs, go to upload
    // If it's ready, go to results
    if (p.status === "ready" && p.generatedAssets.length > 0) {
      setViewState({ view: "AVATAR_DETAIL", personaId: id })
      loadReferencePhotos(id)
    } else if (p.status === "draft" && (!p.referenceCount || p.referenceCount === 0)) {
      setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: id })
    } else {
      // Has references but not ready - show detail
      setViewState({ view: "AVATAR_DETAIL", personaId: id })
      loadReferencePhotos(id)
    }
  }, [getPersona, loadReferencePhotos])

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

    try {
      // Check network before sync
      if (!isOnline) {
        setErrorModal({
          isOpen: true,
          title: "Нет соединения",
          message: "Проверьте подключение к интернету и попробуйте снова",
          onRetry: () => {
            setErrorModal({ isOpen: false, message: "" })
            handleUploadComplete()
          },
        })
        return
      }

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

      // Show error modal with retry option
      setErrorModal({
        isOpen: true,
        title: "Ошибка загрузки",
        message: errorMessage,
        onRetry: () => {
          setErrorModal({ isOpen: false, message: "" })
          handleUploadComplete()
        },
      })
    } finally {
      setIsSyncing(false)
      setIsGenerating(false)
    }
  }, [viewState, getActivePersona, getPersona, syncPersonaToServer, telegramUserId, showMessage, setIsSyncing, setIsGenerating, updatePersona, isOnline])

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
          {
            intervalMs: 3000,
            timeoutMs: 15 * 60 * 1000,
          }
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
    // Show celebration first, then generate
    setShowPaymentSuccess(true)
  }, [])

  // Handle payment success celebration complete
  const handlePaymentCelebrationComplete = useCallback(() => {
    setShowPaymentSuccess(false)
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
              href="https://t.me/Pinglass_bot"
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
      {/* Offline Banner */}
      <OfflineBanner isVisible={!isOnline} />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: "" })}
        onRetry={errorModal.onRetry}
        title={errorModal.title}
        message={errorModal.message}
        isOffline={!isOnline}
      />

      {/* Payment Success Celebration */}
      <PaymentSuccess
        isVisible={showPaymentSuccess}
        tier={selectedTier || PRICING_TIERS[1]}
        onContinue={handlePaymentCelebrationComplete}
      />

      {viewState.view === "ONBOARDING" ? (
        <OnboardingView
          onComplete={completeOnboarding}
          onStart={handleStartOnboarding}
          isAuthPending={authStatus === 'pending'}
          authError={authStatus === 'failed'}
          isTelegramWebApp={(authStatus as string) !== 'not_in_telegram'}
        />
      ) : (
        <>
          <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5 safe-area-inset-top">
            <div className="max-w-5xl mx-auto px-7 py-3 flex items-center justify-between safe-area-inset-x">
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
          <main className="max-w-5xl mx-auto px-7 py-6 safe-area-inset-x">
            {viewState.view === "DASHBOARD" && (
              <DashboardView
                personas={personas}
                onCreate={handleCreatePersona}
                onSelect={handleSelectAvatar}
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
                  isProcessingPayment={isPaymentOpen}
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
            {viewState.view === "AVATAR_DETAIL" && (
              getActivePersona() ? (
                <AvatarDetailView
                  persona={getActivePersona()!}
                  referencePhotos={referencePhotos}
                  onBack={() => setViewState({ view: "DASHBOARD" })}
                  onGoToResults={() => setViewState({ view: "RESULTS", personaId: viewState.personaId })}
                  onAddPhotos={handleAddPhotos}
                  onDeletePhoto={handleDeleteReferencePhoto}
                  onStartGeneration={() => setViewState({ view: "SELECT_TIER", personaId: viewState.personaId })}
                  onUpdateName={(name) => updatePersona(viewState.personaId, { name })}
                  isLoading={isLoadingReferences}
                  telegramUserId={telegramUserId}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )
            )}
          </main>
          <footer className="mt-auto py-6 px-6 border-t border-border/50">
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
