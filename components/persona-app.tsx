"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react"
import { Loader2, Sun, Moon, Gift, Plus } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"

// Import types and constants
import type { Persona, ViewState, PricingTier, ReferencePhoto, GeneratedAsset, BottomTab } from "./views/types"
import { getErrorMessage } from "@/lib/error-utils"
import { PRICING_TIERS } from "./views/dashboard-view"

// Import custom hooks
import { useAuth, useAvatars, useGeneration, usePayment, usePolling, useSync, usePricing } from "./hooks"
import { useNetworkStatus } from "@/lib/network-status"

// Safe useSession wrapper - Neon Auth may not be configured for test environment
import { useSession } from "@/lib/auth/client"
const useSessionSafe = useSession

// Import error handling components
import { ErrorModal, OfflineBanner } from "./error-modal"
import { PaymentSuccess } from "./payment-success"

// Export for other components
export { PRICING_TIERS } from "./views/dashboard-view"
export type { PricingTier } from "./views/types"

// Utility for merging photos with deduplication by URL
const mergePhotosWithDedup = (
  existingAssets: GeneratedAsset[],
  newPhotoUrls: string[],
  jobId: number | string,
  startIndex: number
): { assets: GeneratedAsset[]; addedCount: number } => {
  const existingUrls = new Set(existingAssets.map((a) => a.url))
  const uniquePhotos = newPhotoUrls.filter((url) => !existingUrls.has(url))

  if (uniquePhotos.length === 0) {
    return { assets: existingAssets, addedCount: 0 }
  }

  const newAssets: GeneratedAsset[] = uniquePhotos.map((url, i) => ({
    id: `${jobId}-${startIndex + i}`,
    type: "PHOTO" as const,
    url,
    styleId: "pinglass",
    createdAt: Date.now(),
  }))

  return {
    assets: [...newAssets, ...existingAssets],
    addedCount: uniquePhotos.length,
  }
}

// Loading fallback component
const ComponentLoader = () => (
  <div className="flex items-center justify-center py-4">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
)

// Lazy load view components with dynamic imports
const OnboardingView = dynamic(() => import("./views/onboarding-view"), {
  loading: () => null, // No loader for onboarding - show instantly
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

// NEW: Styles views for dynamic pack system
const StylesListView = dynamic(() => import("./views/styles-list-view"), {
  loading: () => <ComponentLoader />,
})

const StyleDetailView = dynamic(() => import("./views/style-detail-view"), {
  loading: () => <ComponentLoader />,
})

// NEW: Bottom navigation component
const BottomNav = dynamic(() => import("./bottom-nav").then((mod) => mod.BottomNav), {
  loading: () => null,
  ssr: false,
})

// Lazy load heavy components
const PaymentModal = lazy(() => import("./payment-modal").then((m) => ({ default: m.PaymentModal })))
const ReferralPanel = lazy(() => import("./referral-panel").then((m) => ({ default: m.ReferralPanel })))

export default function PersonaApp() {
  // Custom hooks
  const { userIdentifier, authStatus, telegramUserId, isWebUser, isTelegramUser, neonUserId, theme, toggleTheme, showMessage, setWebUser, hapticImpact, hapticNotification, hapticSelection } = useAuth()
  const { data: neonSession, isPending: isNeonAuthPending } = useSessionSafe() // Neon Auth session for web users
  const { personas, setPersonas, loadAvatarsFromServer, createPersona, updatePersona, deletePersona, getPersona } = useAvatars()
  const { isGenerating, setIsGenerating, generationProgress, setGenerationProgress, fileToBase64 } = useGeneration()
  const { isPaymentOpen, setIsPaymentOpen, selectedTier, setSelectedTier } = usePayment()
  const { tiers: dynamicPricingTiers } = usePricing()
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
  const [activeTab, setActiveTab] = useState<BottomTab>('avatars') // NEW: Bottom nav active tab

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean
    title?: string
    message: string
    onRetry?: () => void
  }>({ isOpen: false, message: "" })

  // Payment success celebration state
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)

  // Confirmation dialog for deleting old photos before new generation
  const [deletePhotosConfirm, setDeletePhotosConfirm] = useState<{
    isOpen: boolean
    photoCount: number
    personaId: string | null
  }>({ isOpen: false, photoCount: 0, personaId: null })
  const [isDeletingPhotos, setIsDeletingPhotos] = useState(false)

  // Active generation job ID (for polling recovery)
  const [activeJobId, setActiveJobId] = useState<number | null>(null)

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

  // Memoized active persona (prevents multiple calls in render)
  const activePersona = useMemo(() => {
    if (!("personaId" in viewState)) return null
    return personas.find((p) => p.id === viewState.personaId) || null
  }, [viewState, personas])

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

        if (!checkMounted()) return
        setPersonas(loadedAvatars)

        // CRITICAL: Check for pending generation in DATABASE (survives WebApp redirects)
        const tgId = userIdentifier.telegramUserId
        if (tgId) {
          try {
            const pendingRes = await fetch(`/api/user/pending-generation?telegram_user_id=${tgId}`)
            const pendingData = await pendingRes.json()

            if (pendingData.hasPending && pendingData.tier && pendingData.avatarId) {
              console.log("[Init] Found pending generation in DB:", pendingData)

              // Mark onboarding complete since user paid
              localStorage.setItem("pinglass_onboarding_complete", "true")

              // Get tier photo count
              const TIER_PHOTOS: Record<string, number> = { starter: 7, standard: 15, premium: 23 }
              const tierPhotos = TIER_PHOTOS[pendingData.tier] || 23
              const targetAvatarId = String(pendingData.avatarId)

              // Show generation screen
              setViewState({ view: "RESULTS", personaId: targetAvatarId })
              setIsGenerating(true)
              // For pending generation recovery, startPhotoCount = 0 (fresh generation)
              setGenerationProgress({ completed: 0, total: tierPhotos, startPhotoCount: 0 })
              setIsReady(true)

              // Clear pending generation from DB
              await fetch(`/api/user/pending-generation?telegram_user_id=${tgId}`, { method: "DELETE" })

              // Start generation - get Telegram initData for secure authentication
              const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
              const initData = tg?.initData || ''

              console.log("[Init] Starting generation for avatar:", targetAvatarId, {
                hasInitData: !!initData,
                initDataLength: initData.length
              })

              const genRes = await fetch("/api/generate", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(initData && { "x-telegram-init-data": initData })
                },
                body: JSON.stringify({
                  avatarId: targetAvatarId,
                  styleId: "pinglass",
                  photoCount: tierPhotos,
                  useStoredReferences: true,
                  // Pass initData in body as fallback
                  initData: initData || undefined,
                  // Telegram auth fallback
                  telegramUserId: tg?.initDataUnsafe?.user?.id || undefined,
                }),
              })
              const genData = await genRes.json()

              if (genData.success && genData.data?.jobId) {
                console.log("[Init] Generation started, jobId:", genData.data.jobId)
                const jobId = genData.data.jobId
                let lastPhotoCount = 0

                // Poll for progress
                startPolling(
                  `pending-gen-${jobId}`,
                  async () => {
                    const statusRes = await fetch(`/api/generate?job_id=${jobId}`)
                    const statusData = await statusRes.json()

                    setGenerationProgress((prev) => ({
                      completed: statusData.progress?.completed || 0,
                      total: statusData.progress?.total || tierPhotos,
                      startPhotoCount: prev.startPhotoCount ?? 0,
                    }))

                    // Update photos as they arrive (with deduplication)
                    if (statusData.photos && statusData.photos.length > lastPhotoCount) {
                      const newPhotos = statusData.photos.slice(lastPhotoCount) as string[]

                      setPersonas((prev) => {
                        const targetPersona = prev.find((p) => String(p.id) === String(targetAvatarId))
                        if (!targetPersona) {
                          console.warn("[Init Polling] Persona not found:", targetAvatarId)
                          return prev
                        }

                        const { assets: mergedAssets, addedCount } = mergePhotosWithDedup(
                          targetPersona.generatedAssets,
                          newPhotos,
                          jobId,
                          lastPhotoCount
                        )

                        if (addedCount === 0) return prev

                        console.log("[Init Polling] Added", addedCount, "photos to persona:", targetAvatarId)

                        return prev.map((persona) =>
                          String(persona.id) === String(targetAvatarId)
                            ? {
                                ...persona,
                                generatedAssets: mergedAssets,
                                thumbnailUrl: persona.thumbnailUrl || mergedAssets[0]?.url,
                              }
                            : persona
                        )
                      })
                      lastPhotoCount = statusData.photos.length
                    }

                    if (statusData.status === "completed" || statusData.status === "failed") {
                      stopPolling(`pending-gen-${jobId}`)
                      setIsGenerating(false)
                      console.log("[Init] Generation completed:", statusData.status)
                    }
                  },
                  { intervalMs: 3000, maxAttempts: 200 }
                )
              } else {
                console.error("[Init] Generation failed:", genData.error)
                setIsGenerating(false)
                // Extract error message properly - genData.error can be string or object
                const errorMsg = typeof genData.error === 'string'
                  ? genData.error
                  : (genData.error?.message || genData.error?.userMessage || "Попробуйте позже")
                showMessage("Ошибка запуска генерации: " + errorMsg)
              }

              return // Exit early - generation started
            }
          } catch (err) {
            console.error("[Init] Error checking pending generation:", err)
          }
        }

        // Normal flow: check if onboarding already completed
        const onboardingComplete = localStorage.getItem("pinglass_onboarding_complete") === "true"

        // FIX: For web users, onboardingComplete alone is enough to skip onboarding
        // Don't require avatars - user may be new with no avatars yet
        if (onboardingComplete) {
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

  // Handle Neon Auth session for web users (after Google login redirect)
  // NOTE: Removed viewState.view and personas.length from deps to prevent infinite loops
  // These values are checked inside but shouldn't trigger re-runs
  useEffect(() => {
    const session = neonSession as { user?: { id?: string; email?: string } } | null
    console.log('[Auth] Neon session check:', {
      isPending: isNeonAuthPending,
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      authStatus,
    })

    if (isNeonAuthPending) return // Wait for session to load

    // Check if user logged in via Neon Auth (web version)
    if (session?.user?.id) {
      // CRITICAL: Set web user identity in useAuth hook
      // This creates userIdentifier which triggers avatar loading in main useEffect
      setWebUser(session.user.id, session.user.email ?? undefined)

      const urlParams = new URLSearchParams(window.location.search)
      const isAuthCallback = urlParams.get('auth') === 'success'

      console.log('[Auth] Neon user found:', session.user.email, 'isCallback:', isAuthCallback)

      if (isAuthCallback) {
        console.log('[Auth] Neon Auth success callback, redirecting to DASHBOARD')
        // Remove auth param from URL
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('auth')
        window.history.replaceState({}, '', newUrl.pathname)

        // Mark onboarding complete and show dashboard
        localStorage.setItem("pinglass_onboarding_complete", "true")
        setViewState({ view: "DASHBOARD" })
      }
      // Note: Skip auto-redirect to DASHBOARD from ONBOARDING -
      // main useEffect handles this based on loaded avatars
    }
  }, [neonSession, isNeonAuthPending, authStatus, setWebUser])

  // Save view state when it changes
  useEffect(() => {
    if (isReady) {
      saveViewState(viewState)
    }
  }, [viewState, isReady])

  // Load photos from server when navigating to RESULTS view
  // Also acts as aggressive fallback if polling doesn't update photos properly
  // NOTE: Using refs for values that change frequently to prevent dependency cycles
  const generationProgressRef = useRef(generationProgress)
  const isGeneratingRef = useRef(isGenerating)
  const personasRef = useRef(personas)

  useEffect(() => {
    generationProgressRef.current = generationProgress
    isGeneratingRef.current = isGenerating
    personasRef.current = personas
  }, [generationProgress, isGenerating, personas])

  useEffect(() => {
    const loadPhotosForResults = async () => {
      if (viewState.view !== "RESULTS" || !("personaId" in viewState)) return

      const avatarId = viewState.personaId
      const persona = personasRef.current.find((p) => p.id === avatarId)
      if (!persona) return

      const localPhotoCount = persona.generatedAssets?.length || 0
      const generating = isGeneratingRef.current

      // ALWAYS load during generation to ensure photos appear
      // Also load if no photos locally or status is ready
      const shouldLoad =
        generating ||  // Always check during generation
        localPhotoCount === 0 ||
        persona.status === "ready" ||
        persona.status === "processing"

      if (shouldLoad) {
        try {
          const res = await fetch(`/api/avatars/${avatarId}/photos`)
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.photos?.length > 0) {
              const serverPhotoCount = data.photos.length

              // Only update if server has more photos
              if (serverPhotoCount > localPhotoCount) {
                const newAssets = data.photos.map((p: { id: number; image_url: string; created_at: string }) => ({
                  id: p.id.toString(),
                  url: p.image_url,
                  type: "image" as const,
                  createdAt: new Date(p.created_at).getTime(),
                }))

                console.log("[Fallback] ✓ Updating UI with", serverPhotoCount, "photos (had", localPhotoCount, ")")
                updatePersona(avatarId, { generatedAssets: newAssets })

                // If we got all expected photos and were generating, mark as complete
                const progress = generationProgressRef.current
                if (generating && serverPhotoCount >= progress.total && progress.total > 0) {
                  console.log("[Fallback] All photos loaded, marking generation complete")
                  updatePersona(avatarId, { status: "ready" })
                  setIsGenerating(false)
                  setGenerationProgress({ completed: 0, total: 0 })
                }
              }
            }
          }
        } catch (err) {
          // Silent fail - polling is primary, this is backup
          console.debug("[Fallback] Photo check failed:", err)
        }
      }
    }

    // Initial load
    loadPhotosForResults()

    // Aggressive fallback: check server every 3 seconds during generation
    // This ensures photos appear even if main polling has issues
    let intervalId: NodeJS.Timeout | null = null
    if (viewState.view === "RESULTS" && "personaId" in viewState) {
      // Use faster interval during active generation (checked via ref)
      const intervalMs = isGeneratingRef.current ? 3000 : 10000
      intervalId = setInterval(loadPhotosForResults, intervalMs)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [viewState, updatePersona, setIsGenerating, setGenerationProgress])

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

  // ══════════════════════════════════════════════════════════════
  // TELEGRAM INTEGRATION: Back Button
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg?.BackButton) return

    // Show back button for non-root views
    const showBackButton = viewState.view !== 'DASHBOARD' && viewState.view !== 'ONBOARDING'

    if (showBackButton) {
      const handleBackClick = () => {
        hapticImpact('light')
        setViewState({ view: 'DASHBOARD' })
      }

      tg.BackButton.onClick(handleBackClick)
      tg.BackButton.show()
      console.log("[TG] Back button shown for view:", viewState.view)

      return () => {
        try {
          tg.BackButton.offClick(handleBackClick)
          tg.BackButton.hide()
        } catch { /* ignore */ }
      }
    } else {
      try {
        tg.BackButton.hide()
      } catch { /* ignore */ }
    }
  }, [viewState.view, hapticImpact])

  // ══════════════════════════════════════════════════════════════
  // TELEGRAM INTEGRATION: Closing Confirmation During Generation
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) return

    if (isGenerating) {
      try {
        tg.enableClosingConfirmation()
        console.log("[TG] Closing confirmation enabled during generation")
      } catch { /* ignore */ }
    } else {
      try {
        tg.disableClosingConfirmation()
      } catch { /* ignore */ }
    }

    return () => {
      try {
        tg.disableClosingConfirmation()
      } catch { /* ignore */ }
    }
  }, [isGenerating])

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    localStorage.setItem("pinglass_onboarding_complete", "true")

    if (telegramUserId && userIdentifier) {
      console.log("[Onboarding] Completing onboarding for user:", telegramUserId)
      try {
        // Mark onboarding complete on server (triggers +1 referral for referrer)
        await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegramUserId,
            markOnboardingComplete: true,
          }),
        })
        console.log("[Onboarding] Onboarding marked complete on server")

        const avatars = await loadAvatarsFromServer(userIdentifier)
        console.log("[Onboarding] Loaded", avatars.length, "avatars")
      } catch (err) {
        console.error("[Onboarding] Failed to complete onboarding:", err)
      }
    }

    setViewState({ view: "DASHBOARD" })
  }, [telegramUserId, userIdentifier, loadAvatarsFromServer])

  // Create user on onboarding start
  const handleStartOnboarding = useCallback(async () => {
    console.log("[Onboarding] handleStartOnboarding called")
    
    const tg = window.Telegram?.WebApp
    const initData = tg?.initData

    console.log("[Onboarding] Telegram WebApp:", !!tg, "initData:", !!initData, "length:", initData?.length)

    if (!initData) {
      console.error("[Onboarding] No Telegram initData available")
      showMessage("Откройте приложение через Telegram @Pinglass_bot")
      return
    }

    const tgUser = tg?.initDataUnsafe?.user
    console.log("[Onboarding] tgUser:", tgUser?.id, tgUser?.username)
    
    if (!tgUser?.id) {
      console.error("[Onboarding] No telegram user in initDataUnsafe!")
      showMessage("Не удалось получить данные Telegram. Перезапустите приложение.")
      return
    }

    try {
      // FIX: Send telegramUserId (not initData) and markOnboardingComplete
      // This triggers referral link creation if user has pending_referral_code
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: tgUser.id,
          markOnboardingComplete: true,
        }),
      })

      if (!res.ok) {
        console.error("[Onboarding] Failed to complete onboarding, status:", res.status)
      } else {
        console.log("[Onboarding] Onboarding completed, referral link created if applicable")
      }
    } catch (err) {
      console.error("[Onboarding] Onboarding completion error:", err)
    }

    console.log("[Onboarding] Reloading avatars after user creation...")
    try {
      const newIdentifier = {
        type: "telegram" as const,
        telegramUserId: tgUser.id,
        visibleUserId: tgUser.id,
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
    // Require either Telegram or Web user identifier
    if (!telegramUserId && !neonUserId) {
      showMessage("Ошибка: не удалось получить идентификатор пользователя")
      return
    }

    try {
      // Get Telegram initData for authentication (required in production)
      const tg = window.Telegram?.WebApp
      const initData = isTelegramUser ? (tg?.initData || '') : undefined

      // Create avatar on server immediately (supports both Telegram and Web users)
      const res = await fetch("/api/avatars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Send initData header for Telegram auth (lowercase for Next.js compatibility)
          ...(initData && { "x-telegram-init-data": initData }),
        },
        credentials: "include", // Include cookies for Neon Auth
        body: JSON.stringify({
          // Also send initData in body as fallback
          ...(initData && { initData }),
          telegramUserId: isWebUser ? undefined : telegramUserId,
          neonUserId: isWebUser ? neonUserId : undefined,
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
  }, [telegramUserId, neonUserId, isWebUser, setPersonas, showMessage])

  // Delete persona handler with Telegram-native confirm (supports both Telegram and Web users)
  const handleDeletePersona = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    // Require either Telegram or Web user identifier
    if (!telegramUserId && !neonUserId) {
      console.error("[Delete] Cannot delete: no user identifier")
      showMessage("Ошибка авторизации. Перезапустите приложение.")
      return
    }

    const currentTelegramUserId = telegramUserId // Capture for async closure
    const currentNeonUserId = neonUserId // Capture for async closure

    const performDelete = async () => {
      const result = await deletePersona(id, currentTelegramUserId, currentNeonUserId)
      if (result.success) {
        if ("personaId" in viewState && viewState.personaId === id) {
          setViewState({ view: "DASHBOARD" })
        }
      } else {
        showMessage(result.error || "Не удалось удалить аватар")
      }
    }

    // Use Telegram.WebApp.showConfirm for native Mini App UX
    // IMPORTANT: Check initData to ensure we're in a real Telegram Mini App context
    const tg = window.Telegram?.WebApp
    const isRealTelegramApp = tg?.initData && tg.initData.length > 0

    if (isRealTelegramApp && tg?.showConfirm) {
      tg.showConfirm("Удалить этот аватар?", (confirmed: boolean) => {
        if (confirmed) {
          performDelete()
        }
      })
    } else {
      // Fallback for non-Telegram environment (browser confirm)
      if (confirm("Удалить?")) {
        performDelete()
      }
    }
  }, [deletePersona, viewState, telegramUserId, neonUserId, showMessage])

  // Load reference photos for Avatar Detail View (supports both Telegram and Web users)
  const loadReferencePhotos = useCallback(async (avatarId: string) => {
    if (!telegramUserId && !neonUserId) return

    setIsLoadingReferences(true)
    try {
      const headers: HeadersInit = {}
      if (telegramUserId) {
        headers["X-Telegram-User-Id"] = String(telegramUserId)
      } else if (neonUserId) {
        headers["X-Neon-User-Id"] = neonUserId
      }

      const response = await fetch(`/api/avatars/${avatarId}/references`, { headers })

      if (response.ok) {
        const data = await response.json()
        setReferencePhotos(data.references || [])
      }
    } catch (error) {
      console.error("[AvatarDetail] Failed to load references:", error)
    } finally {
      setIsLoadingReferences(false)
    }
  }, [telegramUserId, neonUserId])

  // Add photos to avatar (supports both Telegram and Web users)
  const handleAddPhotos = useCallback(async (files: File[]) => {
    const activePersona = getActivePersona()
    if (!activePersona || (!telegramUserId && !neonUserId)) return

    // Convert files to base64
    const base64Images = await Promise.all(
      files.slice(0, 20 - referencePhotos.length).map((file) => fileToBase64(file))
    )

    const headers: HeadersInit = { "Content-Type": "application/json" }
    if (telegramUserId) {
      headers["X-Telegram-User-Id"] = String(telegramUserId)
    } else if (neonUserId) {
      headers["X-Neon-User-Id"] = neonUserId
    }

    const response = await fetch(`/api/avatars/${activePersona.id}/references`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        referenceImages: base64Images,
        telegramUserId: isWebUser ? undefined : telegramUserId,
        neonUserId: isWebUser ? neonUserId : undefined,
      }),
    })

    if (response.ok) {
      // Reload reference photos and avatars to get updated thumbnail
      await loadReferencePhotos(activePersona.id)
      if (userIdentifier) await loadAvatarsFromServer(userIdentifier)
    } else {
      showMessage("Ошибка при загрузке фото")
    }
  }, [getActivePersona, telegramUserId, neonUserId, isWebUser, userIdentifier, referencePhotos.length, fileToBase64, loadReferencePhotos, loadAvatarsFromServer, showMessage])

  // Delete single reference photo (supports both Telegram and Web users)
  const handleDeleteReferencePhoto = useCallback(async (photoId: number) => {
    const activePersona = getActivePersona()
    if (!activePersona || (!telegramUserId && !neonUserId)) return

    const headers: HeadersInit = {}
    if (telegramUserId) {
      headers["X-Telegram-User-Id"] = String(telegramUserId)
    } else if (neonUserId) {
      headers["X-Neon-User-Id"] = neonUserId
    }

    const response = await fetch(`/api/avatars/${activePersona.id}/references/${photoId}`, {
      method: "DELETE",
      headers,
    })

    if (response.ok) {
      setReferencePhotos((prev) => prev.filter((p) => p.id !== photoId))
      // Reload avatars to get updated thumbnail
      if (userIdentifier) await loadAvatarsFromServer(userIdentifier)
    } else {
      showMessage("Ошибка при удалении фото")
    }
  }, [getActivePersona, telegramUserId, neonUserId, userIdentifier, loadAvatarsFromServer, showMessage])

  // Open Avatar Detail View
  const handleSelectAvatar = useCallback((id: string) => {
    const p = getPersona(id)
    if (!p) return

    // Clear stale reference photos before switching view to prevent "0/8" flash
    setReferencePhotos([])

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
      // Pass neonUserId for web users authentication
      const dbId = await syncPersonaToServer(persona, telegramUserId, neonUserId)
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
  }, [viewState, getActivePersona, getPersona, syncPersonaToServer, telegramUserId, neonUserId, showMessage, setIsSyncing, setIsGenerating, updatePersona, isOnline])

  // Polling helper - reusable for both new generation and recovery
  // Uses aggressive polling (2s) for real-time photo updates
  const startGenerationPolling = useCallback((
    jobId: number,
    personaId: string,
    totalPhotos: number,
    initialPhotoCount: number = 0
  ) => {
    let lastPhotoCount = initialPhotoCount
    let consecutiveErrors = 0
    const MAX_CONSECUTIVE_ERRORS = 5

    console.log("[Polling] Starting polling for job:", jobId, "persona:", personaId, "interval: 2000ms")

    startPolling(
      `generate-${jobId}`,
      async () => {
        try {
          const statusRes = await fetch(`/api/generate?job_id=${jobId}`)

          if (!statusRes.ok) {
            consecutiveErrors++
            console.warn("[Polling] Fetch error:", statusRes.status, "consecutive:", consecutiveErrors)
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              console.error("[Polling] Too many errors, stopping polling")
              stopPolling(`generate-${jobId}`)
              setIsGenerating(false)
              showMessage("Ошибка при проверке статуса. Обновите страницу.")
            }
            return
          }

          // Reset error counter on success
          consecutiveErrors = 0
          const statusData = await statusRes.json()

          setGenerationProgress((prev) => ({
            completed: statusData.progress?.completed || 0,
            total: statusData.progress?.total || totalPhotos,
            startPhotoCount: prev.startPhotoCount,
          }))

          // Check for new photos - update immediately when found
          const serverPhotoCount = statusData.photos?.length || 0
          if (serverPhotoCount > lastPhotoCount) {
            const newPhotos = statusData.photos.slice(lastPhotoCount) as string[]
            console.log("[Polling] New photos detected:", newPhotos.length, "total on server:", serverPhotoCount)

            setPersonas((prev) => {
              const targetPersona = prev.find((p) => String(p.id) === String(personaId))
              if (!targetPersona) {
                console.warn("[Polling] Persona not found:", personaId, "available:", prev.map((p) => p.id))
                return prev
              }

              const { assets: mergedAssets, addedCount } = mergePhotosWithDedup(
                targetPersona.generatedAssets,
                newPhotos,
                jobId,
                lastPhotoCount
              )

              if (addedCount === 0) {
                console.log("[Polling] No new unique photos to add (already merged)")
                return prev
              }

              console.log("[Polling] ✓ Added", addedCount, "new photos to UI, total:", mergedAssets.length)

              return prev.map((persona) =>
                String(persona.id) === String(personaId)
                  ? {
                      ...persona,
                      generatedAssets: mergedAssets,
                      thumbnailUrl: persona.thumbnailUrl || mergedAssets[0]?.url,
                    }
                  : persona
              )
            })
            lastPhotoCount = serverPhotoCount
          }

          if (statusData.status === "completed" || statusData.status === "failed") {
            console.log("[Polling] Job finished:", statusData.status, "photos:", serverPhotoCount)
            stopPolling(`generate-${jobId}`)
            setActiveJobId(null)
            updatePersona(personaId, { status: statusData.status === "completed" ? "ready" : "draft" })
            setIsGenerating(false)
            setGenerationProgress({ completed: 0, total: 0 })

            if (statusData.status === "failed") {
              showMessage(statusData.error || "Генерация не удалась")
            }
          }
        } catch (err) {
          consecutiveErrors++
          console.error("[Polling] Network error:", err, "consecutive:", consecutiveErrors)
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            stopPolling(`generate-${jobId}`)
            setIsGenerating(false)
            showMessage("Потеряно соединение. Обновите страницу.")
          }
        }
      },
      {
        intervalMs: 2000,  // Faster polling for real-time updates
        timeoutMs: 20 * 60 * 1000,  // Extended timeout for longer generations
      }
    )
  }, [startPolling, stopPolling, setPersonas, updatePersona, setIsGenerating, setGenerationProgress, showMessage])

  // Restore polling when returning to RESULTS with processing status
  useEffect(() => {
    // Skip if already generating or no active persona
    if (isGenerating || activeJobId) return
    if (viewState.view !== "RESULTS" || !("personaId" in viewState)) return

    const persona = personas.find((p) => p.id === viewState.personaId)
    if (!persona || persona.status !== "processing") return

    const resumePolling = async () => {
      try {
        console.log("[Resume] Checking for active generation job for avatar:", viewState.personaId)

        // Check if there's an active job for this avatar
        const res = await fetch(
          `/api/generate?avatar_id=${viewState.personaId}&telegram_user_id=${telegramUserId}`
        )
        const data = await res.json()

        if (data.success && data.status === "processing" && data.jobId) {
          console.log("[Resume] Found active job, restoring polling:", data.jobId)

          // Calculate startPhotoCount: photos before this job started
          const photosFromThisJob = data.photos?.length || 0
          const currentPhotoCount = persona.generatedAssets?.length || 0
          const startPhotoCount = Math.max(0, currentPhotoCount - photosFromThisJob)

          setIsGenerating(true)
          setActiveJobId(data.jobId)
          setGenerationProgress({
            completed: data.progress?.completed || 0,
            total: data.progress?.total || 23,
            startPhotoCount,
          })

          // Add already generated photos that might be missing locally (with deduplication)
          if (data.photos?.length > 0) {
            const { assets: mergedAssets, addedCount } = mergePhotosWithDedup(
              persona.generatedAssets,
              data.photos as string[],
              `${data.jobId}-resumed`,
              0
            )

            if (addedCount > 0) {
              console.log("[Resume] Adding", addedCount, "photos from server")
              updatePersona(viewState.personaId, {
                generatedAssets: mergedAssets
              })
            }
          }

          // Start polling from current count
          const initialCount = data.photos?.length || 0
          startGenerationPolling(data.jobId, viewState.personaId, data.progress?.total || 23, initialCount)

        } else if (data.status === "completed") {
          // Generation finished while away - update status and load photos
          console.log("[Resume] Generation already completed, updating status")

          // Merge photos with deduplication
          if (data.photos?.length > 0) {
            const { assets: mergedAssets } = mergePhotosWithDedup(
              persona.generatedAssets,
              data.photos as string[],
              "completed",
              0
            )
            updatePersona(viewState.personaId, {
              generatedAssets: mergedAssets,
              status: "ready"
            })
          } else {
            updatePersona(viewState.personaId, { status: "ready" })
          }
        } else if (data.status === "failed") {
          console.log("[Resume] Generation failed:", data.error)
          updatePersona(viewState.personaId, { status: "draft" })
        }
      } catch (e) {
        console.error("[Resume] Failed to check generation status:", e)
      }
    }

    resumePolling()
  }, [viewState, personas, isGenerating, activeJobId, telegramUserId, updatePersona, setIsGenerating, setGenerationProgress, startGenerationPolling])

  // Generate photos handler
  const handleGenerate = useCallback(async (tier: PricingTier) => {
    const p = getActivePersona()
    if (!p) return

    const targetPersonaId = p.id  // Capture ID explicitly for closure
    const startPhotoCount = p.generatedAssets?.length || 0  // Track photos at start for re-generation

    setIsGenerating(true)
    setGenerationProgress({ completed: 0, total: tier.photos, startPhotoCount })
    setViewState({ view: "RESULTS", personaId: targetPersonaId })
    updatePersona(targetPersonaId, { status: "processing" })

    try {
      // Kie.ai API limit: max 8 reference images
      const referenceImages = await Promise.all(p.images.slice(0, 8).map((img) => fileToBase64(img.file)))

      // Get Telegram initData for secure authentication
      const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
      const initData = tg?.initData || ''

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(initData && { "x-telegram-init-data": initData })
        },
        body: JSON.stringify({
          avatarId: p.id,
          styleId: "pinglass",
          photoCount: tier.photos,
          referenceImages,
          // Pass initData in body as fallback
          initData: initData || undefined,
          // Telegram auth fallback (when initData validation fails)
          telegramUserId: tg?.initDataUnsafe?.user?.id || telegramUserId || undefined,
          // Keep neonUserId for web auth
          neonUserId: neonUserId || undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        if (errorData.code === "GENERATION_LIMIT_REACHED") {
          throw new Error("Достигнут лимит генераций для этого аватара (максимум 3). Создайте новый аватар для продолжения.")
        }
        throw new Error(errorData.error || "Failed")
      }
      const data = await res.json()

      if (data.photos && data.photos.length > 0) {
        // Immediate completion (all photos ready) - with deduplication
        const { assets: mergedAssets, addedCount } = mergePhotosWithDedup(
          p.generatedAssets,
          data.photos as string[],
          data.jobId,
          0
        )

        console.log("[Generate] Immediate completion:", addedCount, "photos added")

        updatePersona(targetPersonaId, {
          status: "ready",
          generatedAssets: mergedAssets,
          thumbnailUrl: p.thumbnailUrl || mergedAssets[0]?.url,
        })
        setGenerationProgress({ completed: data.photos.length, total: tier.photos, startPhotoCount })
        setIsGenerating(false)
        return
      }

      if (data.jobId) {
        // Start polling for progress using the helper
        setActiveJobId(data.jobId)
        startGenerationPolling(data.jobId, targetPersonaId, tier.photos, 0)
      }
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Ошибка генерации")
      updatePersona(targetPersonaId, { status: "draft" })
      setViewState({ view: "SELECT_TIER", personaId: targetPersonaId })
      setIsGenerating(false)
      setGenerationProgress({ completed: 0, total: 0 })
    }
  }, [getActivePersona, telegramUserId, fileToBase64, updatePersona, setIsGenerating, setGenerationProgress, startGenerationPolling, showMessage])

  // Delete old photos before new generation
  const deleteOldPhotos = useCallback(async (personaId: string): Promise<boolean> => {
    try {
      setIsDeletingPhotos(true)
      const response = await fetch(`/api/avatars/${personaId}/photos`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete photos")
      }

      // Update local state - clear generatedAssets for this persona
      updatePersona(personaId, { generatedAssets: [] })

      return true
    } catch (error) {
      console.error("[PersonaApp] Failed to delete old photos:", error)
      showMessage("Не удалось удалить старые фото")
      return false
    } finally {
      setIsDeletingPhotos(false)
    }
  }, [updatePersona, showMessage])

  // Handle confirmation to delete photos and continue
  const handleDeletePhotosConfirm = useCallback(async () => {
    if (!deletePhotosConfirm.personaId) return

    const success = await deleteOldPhotos(deletePhotosConfirm.personaId)
    setDeletePhotosConfirm({ isOpen: false, photoCount: 0, personaId: null })

    if (success) {
      // Continue with payment success flow
      setShowPaymentSuccess(true)
    }
  }, [deletePhotosConfirm.personaId, deleteOldPhotos])

  // Cancel delete and abort generation
  const handleDeletePhotosCancel = useCallback(() => {
    setDeletePhotosConfirm({ isOpen: false, photoCount: 0, personaId: null })
    // User cancelled - don't proceed with generation
  }, [])

  // Payment success handler
  const handlePaymentSuccess = useCallback(() => {
    setIsPaymentOpen(false)

    // Check if current persona has existing photos
    const persona = getActivePersona()
    if (persona && persona.generatedAssets && persona.generatedAssets.length > 0) {
      // Show confirmation dialog
      setDeletePhotosConfirm({
        isOpen: true,
        photoCount: persona.generatedAssets.length,
        personaId: persona.id,
      })
    } else {
      // No existing photos - proceed directly
      setShowPaymentSuccess(true)
    }
  }, [getActivePersona])

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

  // Web users (not in Telegram) - show onboarding with Google auth
  // No longer blocking - web version is supported via Neon Auth

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

      {/* Delete Photos Confirmation Dialog */}
      {deletePhotosConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleDeletePhotosCancel}
          />
          <div className="relative bg-background rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-foreground mb-2">
              Удалить старые фото?
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              У вас уже есть {deletePhotosConfirm.photoCount} сгенерированных фото.
              При новой генерации они будут удалены и заменены новыми.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeletePhotosCancel}
                disabled={isDeletingPhotos}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleDeletePhotosConfirm}
                disabled={isDeletingPhotos}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingPhotos ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  "Продолжить"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-7 py-4 flex items-center justify-between">
              <h1 className="logo-text text-xl font-black tracking-tight">
                Pinglass
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsReferralOpen(true)}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 hover:from-amber-500/30 hover:to-orange-500/20 text-amber-600 hover:text-amber-500 transition-all shadow-md shadow-amber-500/10"
                  title="Партнёрская программа"
                >
                  <Gift className="w-4 h-4" />
                </button>
                {/* Theme toggle removed - light theme is default */}
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
          <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-7 py-8 pb-24">
            {viewState.view === "DASHBOARD" && (
              <DashboardView
                personas={personas}
                onCreate={handleCreatePersona}
                onSelect={handleSelectAvatar}
                onDelete={handleDeletePersona}
                pricingTiers={dynamicPricingTiers}
              />
            )}
            {viewState.view === "STYLES_LIST" && (
              <StylesListView
                onPackSelect={(packSlug) => {
                  hapticSelection()
                  setViewState({ view: "STYLE_DETAIL", packSlug })
                }}
              />
            )}
            {viewState.view === "STYLE_DETAIL" && (
              <StyleDetailView
                packSlug={viewState.packSlug}
                onSelect={async () => {
                  hapticImpact()
                  // Set active pack via API
                  try {
                    const res = await fetch('/api/user/active-pack', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        packSlug: viewState.packSlug,
                        telegramUserId
                      })
                    })
                    if (res.ok) {
                      showMessage("Стиль выбран! Создайте аватар для генерации")
                      // Check if user has a draft avatar with images
                      const draftAvatar = personas.find(p => p.status === 'draft' && (p.images?.length >= 5 || (p.referenceCount && p.referenceCount >= 5)))
                      if (draftAvatar) {
                        setViewState({ view: "SELECT_TIER", personaId: draftAvatar.id })
                      } else {
                        handleCreatePersona()
                      }
                    }
                  } catch (e) {
                    console.error('Failed to set active pack:', e)
                  }
                }}
                onBack={() => setViewState({ view: "STYLES_LIST" })}
              />
            )}
            {viewState.view === "CREATE_PERSONA_UPLOAD" && (
              getActivePersona() ? (
                <UploadView
                  persona={getActivePersona()!}
                  updatePersona={updatePersona}
                  onBack={() => setViewState({ view: "DASHBOARD" })}
                  onNext={handleUploadComplete}
                  isLoading={isSyncing}
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
                  selectedTier={selectedTier || dynamicPricingTiers[1] || PRICING_TIERS[1]}
                  onSelectTier={setSelectedTier}
                  pricingTiers={dynamicPricingTiers.length > 0 ? dynamicPricingTiers : PRICING_TIERS}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )
            )}
            {viewState.view === "RESULTS" && (
              activePersona ? (
                <ResultsView
                  persona={activePersona}
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
                  isGenerating={isGenerating}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )
            )}
          </main>
          {/* Bottom Navigation - show only in Telegram WebApp, not in web version */}
          {isTelegramUser && !isGenerating && (
            <BottomNav
              activeTab={activeTab}
              onTabChange={(tab) => {
                hapticSelection()
                setActiveTab(tab)
                if (tab === 'avatars') {
                  setViewState({ view: 'DASHBOARD' })
                } else if (tab === 'styles') {
                  setViewState({ view: 'STYLES_LIST' })
                }
                // 'video' tab is disabled, no action needed
              }}
            />
          )}
          <footer className={`mt-auto py-6 px-4 sm:px-6 lg:px-7 border-t border-border/50 ${isTelegramUser ? 'pb-20' : 'pb-6'}`}>
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
        <ReferralPanel telegramUserId={telegramUserId} neonUserId={neonUserId} isOpen={isReferralOpen} onClose={() => setIsReferralOpen(false)} />
      </Suspense>
    </div>
  )
}
