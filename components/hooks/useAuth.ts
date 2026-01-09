import { useState, useEffect, useCallback } from "react"

// User identifier interface - supports both Telegram and Web (Neon Auth) users
export interface UserIdentifier {
  type: "telegram" | "web"
  visibleUserId: number          // Unified ID for API calls (telegram_user_id or converted neon_user_id)
  telegramUserId?: number        // Only for Telegram users
  neonUserId?: string            // Only for Web users (Neon Auth UUID)
  email?: string                 // Only for Web users
  deviceId?: string              // Legacy field
}

// Auth status type for tracking authentication state
export type AuthStatus = 'pending' | 'success' | 'failed' | 'not_in_telegram'

/**
 * Custom hook for authentication
 * Supports both Telegram WebApp and Web (Neon Auth) users
 */
export function useAuth() {
  const [userIdentifier, setUserIdentifier] = useState<UserIdentifier | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('pending')
  const [theme, setTheme] = useState<"dark" | "light">("light")

  // Helper: show messages via Telegram API or browser alert
  // Only use Telegram API if we're in a real Mini App (has initData)
  const showMessage = useCallback((message: string) => {
    const tg = window.Telegram?.WebApp
    const isRealTelegramApp = tg?.initData && tg.initData.length > 0

    if (isRealTelegramApp && tg?.showAlert) {
      try {
        tg.showAlert(message)
      } catch {
        alert(message)
      }
    } else {
      alert(message)
    }
  }, [])

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    localStorage.setItem("pinglass_theme", newTheme)
    document.documentElement.classList.remove("dark", "light")
    document.documentElement.classList.add(newTheme)
  }, [theme])

  // Initialize authentication
  useEffect(() => {
    if (typeof window === "undefined") return

    const abortController = new AbortController()

    const initAuth = async () => {
      // Load saved theme (default to light)
      const savedTheme = localStorage.getItem("pinglass_theme") as "dark" | "light" | null
      const effectiveTheme = savedTheme || "light"
      setTheme(effectiveTheme)
      document.documentElement.classList.remove("dark", "light")
      document.documentElement.classList.add(effectiveTheme)

      // Telegram WebApp authentication - use initDataUnsafe directly
      let tg = window.Telegram?.WebApp

      // Wait for Telegram SDK to initialize (max 2 seconds)
      if (!tg?.initDataUnsafe?.user?.id) {
        console.log("[TG] SDK not ready, waiting...")
        await new Promise<void>((resolve) => {
          let attempts = 0
          const maxAttempts = 20 // 2 seconds total
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
        tg = window.Telegram?.WebApp
      }

      console.log("[TG] WebApp state:", {
        hasTg: !!tg,
        hasUser: !!tg?.initDataUnsafe?.user,
        userId: tg?.initDataUnsafe?.user?.id,
        platform: tg?.platform,
      })

      if (abortController.signal.aborted) return

      // CASE 1: Telegram WebApp user
      if (tg?.initDataUnsafe?.user?.id) {
        const tgUser = tg.initDataUnsafe.user
        const identifier: UserIdentifier = {
          type: "telegram",
          visibleUserId: tgUser.id,
          telegramUserId: tgUser.id,
          deviceId: `tg_${tgUser.id}`,
        }

        setUserIdentifier(identifier)
        setAuthStatus('success')
        console.log("[TG] Auth success:", tgUser.id, tgUser.username || tgUser.first_name)

        // Handle start_param (passed via Telegram deep link)
        const startParam = tg.initDataUnsafe?.start_param
        if (startParam) {
          console.log("[TG] start_param:", startParam)

          if (startParam === "generate") {
            console.log("[TG] Generate command detected - setting resume_payment flag")
            sessionStorage.setItem("pinglass_resume_payment", "true")
            sessionStorage.setItem("pinglass_from_telegram_deeplink", "true")
            localStorage.setItem("pinglass_onboarding_complete", "true")
            try {
              await fetch("/api/user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  telegramUserId: tgUser.id,
                  telegramUsername: tgUser.username,
                  markOnboardingComplete: true,
                }),
              })
              console.log("[TG] Onboarding marked complete on server")
            } catch (err) {
              console.error("[TG] Failed to mark onboarding complete:", err)
            }
          } else {
            // Treat as referral code
            console.log("[TG] Referral code from start_param:", startParam)
            try {
              const res = await fetch("/api/user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  telegramUserId: tgUser.id,
                  telegramUsername: tgUser.username,
                  referralCode: startParam.toUpperCase(),
                }),
              })
              if (res.ok) {
                console.log("[TG] Referral code saved to DB:", startParam.toUpperCase())
              }
            } catch (err) {
              console.error("[TG] Error saving referral code:", err)
            }
          }
        } else {
          // No start_param - still register user in DB
          try {
            await fetch("/api/user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                telegramUserId: tgUser.id,
                telegramUsername: tgUser.username,
              }),
            })
          } catch {
            // Non-critical
          }
        }

        try { tg.ready() } catch { /* ignore */ }
        try { tg.expand() } catch { /* ignore */ }
        return
      }

      // CASE 2: Payment redirect fallback (with telegram_user_id in URL)
      const urlParams = new URLSearchParams(window.location.search)
      const urlTelegramUserId = urlParams.get("telegram_user_id")
      const sessionTelegramUserId = sessionStorage.getItem("pinglass_telegram_user_id")
      const fallbackTelegramUserId = urlTelegramUserId || sessionTelegramUserId

      if (fallbackTelegramUserId) {
        const tgId = parseInt(fallbackTelegramUserId, 10)
        if (!isNaN(tgId) && tgId > 0) {
          console.log("[TG] Auth fallback from URL/sessionStorage:", tgId)
          const identifier: UserIdentifier = {
            type: "telegram",
            visibleUserId: tgId,
            telegramUserId: tgId,
            deviceId: `tg_${tgId}`,
          }
          setUserIdentifier(identifier)
          setAuthStatus('success')
          return
        }
      }

      // CASE 3: Not in Telegram - set status for web auth handling
      if (!tg?.initData) {
        console.log("[TG] Not in Telegram WebApp context (no initData)")
        setAuthStatus('not_in_telegram')
      } else {
        console.log("[TG] Has initData but no user - failed auth")
        setAuthStatus('failed')
      }
    }

    initAuth()

    return () => {
      abortController.abort()
    }
  }, [])

  // Helper function to set web user from Neon Auth session
  const setWebUser = useCallback((neonUserId: string, email?: string) => {
    // Convert Neon UUID to numeric ID for compatibility with existing APIs
    // Use hash of UUID to create a stable numeric ID
    const numericId = Math.abs(hashString(neonUserId)) % 2000000000 + 1000000000

    const identifier: UserIdentifier = {
      type: "web",
      visibleUserId: numericId,
      neonUserId: neonUserId,
      email: email,
      deviceId: `web_${neonUserId}`,
    }

    console.log("[Web] Auth success:", email, "numericId:", numericId)
    setUserIdentifier(identifier)
    setAuthStatus('success')
  }, [])

  // ══════════════════════════════════════════════════════════════
  // TELEGRAM INTEGRATION: Theme Sync
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) return

    const syncTheme = () => {
      const tgTheme = tg.colorScheme || 'light'
      setTheme(tgTheme as 'dark' | 'light')
      document.documentElement.classList.remove('dark', 'light')
      document.documentElement.classList.add(tgTheme)
      console.log("[TG] Theme synced:", tgTheme)
    }

    // Initial sync
    syncTheme()

    // Listen for theme changes
    tg.onEvent('themeChanged', syncTheme)

    return () => {
      try {
        tg.offEvent('themeChanged', syncTheme)
      } catch { /* ignore */ }
    }
  }, [])

  // ══════════════════════════════════════════════════════════════
  // TELEGRAM INTEGRATION: Viewport Height for CSS
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) return

    const setViewportHeight = () => {
      const vh = tg.viewportStableHeight || window.innerHeight
      document.documentElement.style.setProperty('--tg-vh', `${vh}px`)
      console.log("[TG] Viewport height set:", vh)
    }

    // Initial set
    setViewportHeight()

    // Listen for viewport changes
    tg.onEvent('viewportChanged', setViewportHeight)

    return () => {
      try {
        tg.offEvent('viewportChanged', setViewportHeight)
      } catch { /* ignore */ }
    }
  }, [])

  // ══════════════════════════════════════════════════════════════
  // TELEGRAM INTEGRATION: Haptic Feedback Helpers
  // ══════════════════════════════════════════════════════════════
  const hapticImpact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style)
    } catch { /* silent fail on non-Telegram */ }
  }, [])

  const hapticNotification = useCallback((type: 'success' | 'error' | 'warning') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type)
    } catch { /* silent fail on non-Telegram */ }
  }, [])

  const hapticSelection = useCallback(() => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged()
    } catch { /* silent fail on non-Telegram */ }
  }, [])

  return {
    userIdentifier,
    authStatus,
    telegramUserId: userIdentifier?.telegramUserId ?? userIdentifier?.visibleUserId,
    neonUserId: userIdentifier?.neonUserId,
    isWebUser: userIdentifier?.type === 'web',
    isTelegramUser: userIdentifier?.type === 'telegram',
    theme,
    toggleTheme,
    showMessage,
    setWebUser,
    // Telegram haptic feedback
    hapticImpact,
    hapticNotification,
    hapticSelection,
  }
}

// Simple string hash function to convert UUID to stable number
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}
