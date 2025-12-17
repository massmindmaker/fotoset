"use client"

import type React from "react"
import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { Loader2, Sun, Moon, Gift, Plus } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"

// Import types and constants
import type { Persona, ViewState, PricingTier } from "./views/types"
import { extractErrorMessage, getErrorMessage } from "@/lib/error-utils"
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

// User identifier interface - Telegram only (no device fallback)
interface UserIdentifier {
  type: "telegram"
  telegramUserId?: number
  deviceId?: string // Legacy field, derived from telegramUserId
}

/**
 * Initial empty identifier - will be populated by server auth in initApp()
 * User data is stored in Neon DB, NOT localStorage
 */
function getInitialIdentifier(): UserIdentifier {
  return { type: "telegram" }
}

// Auth status type for tracking Telegram authentication state
type AuthStatus = 'pending' | 'success' | 'failed' | 'not_in_telegram'

export default function PersonaApp() {
  const [viewState, setViewState] = useState<ViewState>({ view: "ONBOARDING" })
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 })
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [userIdentifier, setUserIdentifier] = useState<UserIdentifier | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [selectedTier, setSelectedTier] = useState<PricingTier>(PRICING_TIERS[1])
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [isReferralOpen, setIsReferralOpen] = useState(false)
  // FIX: Track auth status to prevent race conditions
  const [authStatus, setAuthStatus] = useState<AuthStatus>('pending')

  // Ref for polling interval cleanup on unmount
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Derived values
  const deviceId = userIdentifier?.deviceId || ""
  const telegramUserId = userIdentifier?.telegramUserId

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [])

  // Load avatars from server
  const loadAvatarsFromServer = async (identifier: UserIdentifier): Promise<Persona[]> => {
    try {
      // Use include_photos=true (default) to get all avatars with photos in ONE request
      // Priority: telegram_user_id for cross-device sync
      let url = "/api/avatars?include_photos=true"
      if (identifier.telegramUserId) {
        url += `&telegram_user_id=${identifier.telegramUserId}`
      }
      url += `&device_id=${identifier.deviceId}`
      const res = await fetch(url)
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
      let currentIdentifier = getInitialIdentifier()
      setUserIdentifier(currentIdentifier)

      try {
        const savedTheme = localStorage.getItem("pinglass_theme") as "dark" | "light" | null
        if (savedTheme) {
          setTheme(savedTheme)
          document.documentElement.classList.toggle("light", savedTheme === "light")
        }

        // Telegram WebApp authentication - use initDataUnsafe directly
        // No server validation needed for non-critical operations (avatar creation)
        // Telegram guarantees data integrity within its client
        let tg = window.Telegram?.WebApp

        // FIX: Wait for Telegram SDK to initialize (max 2 seconds)
        // SDK loads asynchronously and may not be ready on first render
        if (!tg?.initDataUnsafe?.user?.id) {
          console.log("[TG] SDK not ready, waiting...")
          await new Promise<void>((resolve) => {
            let attempts = 0
            const maxAttempts = 20  // 2 seconds total
            const checkInterval = setInterval(() => {
              attempts++
              const tgCheck = window.Telegram?.WebApp
              if (tgCheck?.initDataUnsafe?.user?.id) {
                console.log("[TG] SDK ready after", attempts * 100, "ms")
                clearInterval(checkInterval)
                resolve()
              } else if (attempts >= maxAttempts) {
                console.log("[TG] SDK timeout after 2s")
                clearInterval(checkInterval)
                resolve()
              }
            }, 100)
          })
          // Re-check after waiting
          tg = window.Telegram?.WebApp
        }

        console.log("[TG] WebApp state:", {
          hasTg: !!tg,
          hasUser: !!tg?.initDataUnsafe?.user,
          userId: tg?.initDataUnsafe?.user?.id,
          platform: tg?.platform,
        })

        if (tg?.initDataUnsafe?.user?.id) {
          const tgUser = tg.initDataUnsafe.user
          currentIdentifier = {
            type: "telegram",
            telegramUserId: tgUser.id,
            deviceId: `tg_${tgUser.id}`,
          }
          setUserIdentifier(currentIdentifier)
          setAuthStatus('success')
          console.log("[TG] Auth success:", tgUser.id, tgUser.username || tgUser.first_name)

          // Handle referral code from start_param
          const telegramRefCode = tg.initDataUnsafe?.start_param
          if (telegramRefCode) {
            console.log("[TG] Referral code:", telegramRefCode)
            sessionStorage.setItem("pinglass_referral_code", telegramRefCode)
          }

          tg.ready()
          tg.expand()
        } else if (!tg) {
          console.log("[TG] Not in Telegram WebApp context")
          setAuthStatus('not_in_telegram')
        } else {
          console.log("[TG] No user data in initDataUnsafe")
          setAuthStatus('failed')
        }

        // Use the current identifier (may have been updated by Telegram auth)
        // Add timeout to prevent blank screen if API hangs
        const loadAvatarsWithTimeout = Promise.race([
          loadAvatarsFromServer(currentIdentifier),
          new Promise<Persona[]>((resolve) => setTimeout(() => resolve([]), 10000)) // 10s timeout
        ])
        let loadedAvatars = await loadAvatarsWithTimeout

        // Log loaded avatars for diagnostics
        console.log("[Init] Loaded avatars:", {
          count: loadedAvatars?.length || 0,
          statuses: loadedAvatars?.map(a => ({ id: a.id, status: a.status, photosCount: a.generatedAssets?.length || 0 })) || [],
          telegramUserId: currentIdentifier?.telegramUserId
        })

        // Check if onboarding was completed (flag OR has avatars)
        const onboardingComplete = localStorage.getItem("pinglass_onboarding_complete") === "true"
        const hasAvatars = loadedAvatars && loadedAvatars.length > 0

        // Check for pending payment after redirect from T-Bank
        const urlParams = new URLSearchParams(window.location.search)
        const resumePayment = urlParams.get("resume_payment") === "true"
        const urlTelegramUserId = urlParams.get("telegram_user_id")

        if (resumePayment) {
          // Clean URL without reload
          window.history.replaceState({}, "", window.location.pathname)

          try {
            // FIX: Use telegram_user_id from URL (passed by callback after payment verification)
            // This works after external redirect when Telegram WebApp context is unavailable
            const tgId = currentIdentifier.telegramUserId || (urlTelegramUserId ? parseInt(urlTelegramUserId) : null)

            if (!tgId) {
              console.error("[Resume Payment] No valid Telegram user ID")
              alert("Ошибка аутентификации. Пожалуйста, перезапустите приложение в Telegram.")
              setViewState({ view: "DASHBOARD" })
              setIsReady(true)
              return
            }

            // FIX: ALWAYS reload avatars with URL telegram_user_id after payment redirect
            // This ensures we get the correct user's avatars even if SDK auth returned different/no ID
            if (urlTelegramUserId) {
              currentIdentifier = {
                type: "telegram",
                telegramUserId: tgId,
                deviceId: `tg_${tgId}`,
              }
              setUserIdentifier(currentIdentifier)
              console.log("[Resume Payment] Reloading avatars with URL tgId:", tgId)
              loadedAvatars = await loadAvatarsFromServer(currentIdentifier)
            }

            console.log("[Resume Payment] telegramUserId:", tgId, "avatars:", loadedAvatars.length)

            // Find avatar that needs generation (most recent draft with reference photos)
            const availablePersonas = loadedAvatars.filter(p => p.status === 'draft')
            console.log("[Resume Payment] Available draft personas:", availablePersonas.map(p => ({ id: p.id, status: p.status })))

            let targetPersona = availablePersonas.length > 0
              ? availablePersonas.reduce((latest, current) =>
                  Number(current.id) > Number(latest.id) ? current : latest
                )
              : null

            // If no draft avatar, try fallback options
            if (!targetPersona) {
              // Fallback 1: Find any avatar with generated photos (already ready)
              const anyAvatarWithPhotos = loadedAvatars.find(p => p.generatedAssets && p.generatedAssets.length > 0)
              if (anyAvatarWithPhotos) {
                console.log("[Resume Payment] No draft, but found avatar with photos:", anyAvatarWithPhotos.id)
                setPersonas(loadedAvatars)
                setViewState({ view: "RESULTS", personaId: anyAvatarWithPhotos.id })
                setIsReady(true)
                return
              }

              // Fallback 2: Has avatars but no photos - show dashboard
              if (loadedAvatars.length > 0) {
                console.log("[Resume Payment] No avatars with photos, showing dashboard")
                setPersonas(loadedAvatars)
                setViewState({ view: "DASHBOARD" })
                setIsReady(true)
                return
              }

              // Fallback 3: No avatars at all - show DASHBOARD (NOT onboarding!)
              // After payment, user should never see onboarding again
              console.log("[Resume Payment] No avatars found after payment, showing dashboard")
              alert("Оплата прошла успешно! Создайте аватар и загрузите фото.")
              localStorage.setItem("pinglass_onboarding_complete", "true")
              setViewState({ view: "DASHBOARD" })
              setIsReady(true)
              return
            }

            console.log("[Resume Payment] Starting generation for persona:", targetPersona.id)

            const tierPhotos = 23 // Default premium tier

            // Set UI state for generation
            setPersonas(loadedAvatars)
            setViewState({ view: "RESULTS", personaId: targetPersona.id })
            setIsGenerating(true)
            setGenerationProgress({ completed: 0, total: tierPhotos })
            setIsReady(true)

            // Start generation using stored reference photos
            fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                telegramUserId: tgId,
                deviceId: currentIdentifier.deviceId,
                avatarId: targetPersona.id,
                styleId: "pinglass",
                photoCount: tierPhotos,
                useStoredReferences: true,
              }),
            })
              .then(res => res.json())
              .then(data => {
                if (data.success && data.data?.jobId) {
                  console.log("[Resume Payment] Generation started, jobId:", data.data.jobId)
                  const jobId = data.data.jobId
                  const personaId = targetPersona.id
                  let lastPhotoCount = 0

                  // Start polling for generation progress
                  pollIntervalRef.current = setInterval(async () => {
                    try {
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
                        if (pollIntervalRef.current) {
                          clearInterval(pollIntervalRef.current)
                          pollIntervalRef.current = null
                        }
                        setIsGenerating(false)
                        setGenerationProgress({ completed: 0, total: 0 })
                        console.log("[Resume Payment] Generation completed:", statusData.status)
                      }
                    } catch (pollError) {
                      console.error("[Resume Payment] Polling error:", pollError)
                    }
                  }, 3000)

                  // Safety timeout - stop polling after 15 minutes
                  setTimeout(() => {
                    if (pollIntervalRef.current) {
                      clearInterval(pollIntervalRef.current)
                      pollIntervalRef.current = null
                    }
                    setIsGenerating(false)
                  }, 15 * 60 * 1000)
                } else if (!data.success) {
                  console.error("[Resume Payment] Generation failed:", data.error)
                  setIsGenerating(false)
                }
              })
              .catch(err => {
                console.error("[Resume Payment] Generation request failed:", err)
                setIsGenerating(false)
              })

            return // Skip normal flow - generation started

          } catch (e) {
            console.error("[Resume Payment] Error:", e)
            // On error, show dashboard
            setPersonas(loadedAvatars)
            setViewState({ view: hasAvatars ? "DASHBOARD" : "ONBOARDING" })
            setIsReady(true)
            return
          }
        }

        // Normal flow (NOT resume_payment):
        // Show DASHBOARD if user has avatars or completed onboarding, otherwise ONBOARDING
        // Note: onboardingComplete and hasAvatars are already defined above (lines 242-243)
        if (hasAvatars || onboardingComplete) {
          console.log("[Init] User has avatars or completed onboarding, showing DASHBOARD", {
            avatarsCount: loadedAvatars?.length || 0,
            onboardingComplete
          })
          setPersonas(loadedAvatars)
          setViewState({ view: "DASHBOARD" })
        } else {
          console.log("[Init] New user, showing ONBOARDING")
          setViewState({ view: "ONBOARDING" })
        }
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

  // Recovery: if view requires persona but it's missing, redirect to DASHBOARD
  useEffect(() => {
    if (!isReady) return
    const viewsRequiringPersona = ["CREATE_PERSONA_UPLOAD", "SELECT_TIER", "RESULTS"]
    if (viewsRequiringPersona.includes(viewState.view) && "personaId" in viewState) {
      const persona = personas.find((p) => p.id === viewState.personaId)
      if (!persona) {
        // Wait a moment for state to sync, then redirect if still missing
        const timeout = setTimeout(() => {
          const stillMissing = !personas.find((p) => p.id === viewState.personaId)
          if (stillMissing) {
            console.warn("[Recovery] Persona not found, redirecting to DASHBOARD:", viewState.personaId)
            setViewState({ view: "DASHBOARD" })
          }
        }, 500)
        return () => clearTimeout(timeout)
      }
    }
  }, [isReady, viewState, personas])

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

  // Create user only (no avatar) when onboarding completes
  const handleStartOnboarding = async () => {
    const tg = window.Telegram?.WebApp
    const initData = tg?.initData

    if (!initData) {
      console.error("[Onboarding] No Telegram initData available")
      alert("Откройте приложение через Telegram @Pinglass_bot")
      return
    }

    // CRITICAL: Extract and set telegram user ID to state
    const tgUser = tg?.initDataUnsafe?.user
    if (tgUser?.id) {
      setUserIdentifier({
        type: "telegram",
        telegramUserId: tgUser.id,
        deviceId: `tg_${tgUser.id}`,
      })
      console.log("[Onboarding] Set userIdentifier from initDataUnsafe:", tgUser.id)
    } else {
      console.error("[Onboarding] No telegram user in initDataUnsafe!")
      alert("Не удалось получить данные Telegram. Перезапустите приложение.")
      return
    }

    try {
      // Create user only using validated Telegram auth
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

    localStorage.setItem("pinglass_onboarding_complete", "true")
    setViewState({ view: "DASHBOARD" })
  }

  // Navigate to upload view with temp local ID (avatar created later on photo confirm)
  const handleCreatePersona = () => {
    // Generate temporary local ID (will be replaced with DB ID after photo upload)
    const tempId = `temp_${Date.now()}`

    setPersonas((prev) => [
      ...prev,
      { id: tempId, name: "Мой аватар", status: "draft", images: [], generatedAssets: [] },
    ])

    setViewState({ view: "CREATE_PERSONA_UPLOAD", personaId: tempId })
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
          // Keep full data URL with prefix (e.g., "data:image/jpeg;base64,...")
          resolve(result)
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

    // ROBUST: Try multiple sources for telegram user ID
    const tg = window.Telegram?.WebApp
    const tgUserFromWebApp = tg?.initDataUnsafe?.user?.id
    const tgId = tgUserFromWebApp || telegramUserId

    console.log("[Sync] Telegram ID sources:", {
      fromWebApp: tgUserFromWebApp,
      fromState: telegramUserId,
      hasTg: !!tg,
      hasInitDataUnsafe: !!tg?.initDataUnsafe,
      hasUser: !!tg?.initDataUnsafe?.user,
      final: tgId,
    })

    if (!tgId) {
      console.error("[Sync] No telegram user ID available from any source!")
      alert("Ошибка: не удалось получить Telegram ID. Закройте и откройте приложение заново через @Pinglass_bot")
      throw new Error("Telegram user ID not available")
    }

    try {
      // Step 1: Create avatar in DB
      const createRes = await fetch("/api/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: tgId,
          deviceId: deviceId || `tg_${tgId}`,
          name: persona.name || "Мой аватар",
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(extractErrorMessage(err, "Failed to create avatar"))
      }

      const avatarData = await createRes.json()
      const dbAvatarId = String(avatarData.data.id)
      console.log("[Sync] Avatar created with DB ID:", dbAvatarId)

      // Step 2: Upload reference photos to R2 (one by one to avoid Vercel 4.5MB limit)
      if (persona.images && persona.images.length > 0) {
        console.log("[Sync] Uploading", persona.images.length, "reference photos to R2")

        const imagesToUpload = persona.images.slice(0, 14)
        const uploadedUrls: string[] = []

        // Upload each photo individually to R2
        for (let i = 0; i < imagesToUpload.length; i++) {
          const img = imagesToUpload[i]
          try {
            console.log(`[Sync] Uploading photo ${i + 1}/${imagesToUpload.length}`)
            const base64Data = await fileToBase64(img.file)

            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                avatarId: dbAvatarId,
                type: "reference",
                image: base64Data,
              }),
            })

            if (uploadRes.ok) {
              const result = await uploadRes.json()
              if (result.data?.url) {
                uploadedUrls.push(result.data.url)
                console.log(`[Sync] Photo ${i + 1} uploaded to R2:`, result.data.key)
              }
            } else {
              const errText = await uploadRes.text()
              console.error(`[Sync] Photo ${i + 1} FAILED:`, {
                status: uploadRes.status,
                statusText: uploadRes.statusText,
                error: errText,
              })
            }
          } catch (err) {
            console.error(`[Sync] Error uploading photo ${i + 1}:`, err)
          }
        }

        console.log(`[Sync] Uploaded ${uploadedUrls.length}/${imagesToUpload.length} photos to R2`)

        // Save R2 URLs to database
        if (uploadedUrls.length > 0) {
          try {
            const saveRes = await fetch(`/api/avatars/${dbAvatarId}/references`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                telegramUserId: tgId,
                deviceId,
                referenceImages: uploadedUrls,  // Now these are R2 URLs, not base64!
              }),
            })

            if (saveRes.ok) {
              const saveResult = await saveRes.json()
              console.log("[Sync] Reference URLs saved to DB:", saveResult.uploadedCount)
            } else {
              console.error("[Sync] Failed to save reference URLs to DB")
            }
          } catch (err) {
            console.error("[Sync] Error saving reference URLs:", err)
          }
        }

        // FALLBACK: If R2 upload failed, try saving base64 directly to DB
        if (uploadedUrls.length === 0) {
          console.warn("[Sync] R2 upload failed for all photos, trying direct DB fallback...")

          // Конвертировать первые 5 фото в base64 и сохранить напрямую
          const fallbackImages = imagesToUpload.slice(0, 5)
          const base64Images: string[] = []

          for (const img of fallbackImages) {
            try {
              const b64 = await fileToBase64(img.file)
              base64Images.push(b64)
            } catch (err) {
              console.error("[Sync] Fallback: failed to convert image:", err)
            }
          }

          if (base64Images.length > 0) {
            try {
              const fallbackRes = await fetch(`/api/avatars/${dbAvatarId}/references`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  telegramUserId: tgId,
                  deviceId,
                  referenceImages: base64Images,
                }),
              })

              if (fallbackRes.ok) {
                const result = await fallbackRes.json()
                if (result.uploadedCount > 0) {
                  console.log("[Sync] Fallback succeeded:", result.uploadedCount, "photos saved to DB")
                  // Успех через fallback - продолжаем
                } else {
                  throw new Error("Не удалось сохранить фото в БД")
                }
              } else {
                const errText = await fallbackRes.text()
                console.error("[Sync] Fallback failed:", errText)
                throw new Error("Ошибка сохранения фото в БД")
              }
            } catch (err) {
              console.error("[Sync] Fallback error:", err)
              throw new Error("Не удалось загрузить фото ни в R2, ни в БД")
            }
          } else {
            throw new Error("Не удалось обработать фото для сохранения")
          }
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
      const errorMessage = getErrorMessage(error, "Ошибка сохранения")
      console.error("[Upload] Sync failed with error:", errorMessage, error)
      alert(`Ошибка сохранения: ${errorMessage}`)
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
          telegramUserId,
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
        // Use ref for proper cleanup on unmount
        pollIntervalRef.current = setInterval(async () => {
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
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
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
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
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
        <OnboardingView
          onComplete={completeOnboarding}
          onStart={handleStartOnboarding}
          isAuthPending={authStatus === 'pending'}
          authError={authStatus === 'failed'}
        />
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
                  selectedTier={selectedTier}
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
