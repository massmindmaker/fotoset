import { useState, useEffect, useCallback } from "react"

// User identifier interface - Telegram only (no device fallback)
export interface UserIdentifier {
  type: "telegram"
  telegramUserId: number // Required (NOT NULL)
  deviceId?: string // Optional legacy field
}

// Auth status type for tracking Telegram authentication state
export type AuthStatus = 'pending' | 'success' | 'failed' | 'not_in_telegram'

/**
 * Custom hook for Telegram WebApp authentication
 * Handles SDK initialization, user identification, and auth state
 */
export function useAuth() {
  const [userIdentifier, setUserIdentifier] = useState<UserIdentifier | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('pending')
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  // Helper: show messages via Telegram API (window.alert doesn't work in Mini Apps)
  const showMessage = useCallback((message: string) => {
    const tg = window.Telegram?.WebApp
    if (tg?.showAlert) {
      try {
        tg.showAlert(message)
      } catch {
        // Fallback if WebApp method not supported (e.g., outside Telegram)
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
    document.documentElement.classList.toggle("light", newTheme === "light")
  }, [theme])

  // Initialize authentication
  useEffect(() => {
    if (typeof window === "undefined") return

    const abortController = new AbortController()

    const initAuth = async () => {
      // Load saved theme
      const savedTheme = localStorage.getItem("pinglass_theme") as "dark" | "light" | null
      if (savedTheme) {
        setTheme(savedTheme)
        document.documentElement.classList.toggle("light", savedTheme === "light")
      }

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
        // Re-check after waiting
        tg = window.Telegram?.WebApp
      }

      console.log("[TG] WebApp state:", {
        hasTg: !!tg,
        hasUser: !!tg?.initDataUnsafe?.user,
        userId: tg?.initDataUnsafe?.user?.id,
        platform: tg?.platform,
      })

      if (abortController.signal.aborted) return

      if (tg?.initDataUnsafe?.user?.id) {
        const tgUser = tg.initDataUnsafe.user
        const identifier: UserIdentifier = {
          type: "telegram",
          telegramUserId: tgUser.id,
          deviceId: `tg_${tgUser.id}`,
        }

        setUserIdentifier(identifier)
        setAuthStatus('success')
        console.log("[TG] Auth success:", tgUser.id, tgUser.username || tgUser.first_name)

        // Handle start_param (passed via Telegram deep link)
        // Can be: referral code (e.g., "ABC123") or command (e.g., "generate")
        const startParam = tg.initDataUnsafe?.start_param
        if (startParam) {
          console.log("[TG] start_param:", startParam)

          // Check if it's a generate command (from post-payment redirect)
          if (startParam === "generate") {
            console.log("[TG] Generate command detected - setting resume_payment flag")
            // Set flag to trigger generation in persona-app.tsx
            sessionStorage.setItem("pinglass_resume_payment", "true")
            sessionStorage.setItem("pinglass_from_telegram_deeplink", "true")
            localStorage.setItem("pinglass_onboarding_complete", "true")
          } else {
            // Treat as referral code - save to DATABASE via API
            // CRITICAL: localStorage clears during T-Bank redirect!
            console.log("[TG] Referral code from start_param:", startParam)
            try {
              const res = await fetch("/api/user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  telegramUserId: tgUser.id,
                  referralCode: startParam.toUpperCase(),
                }),
              })
              if (res.ok) {
                console.log("[TG] Referral code saved to DB:", startParam.toUpperCase())
              } else {
                console.error("[TG] Failed to save referral code to DB:", res.status)
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
              body: JSON.stringify({ telegramUserId: tgUser.id }),
            })
          } catch {
            // Non-critical, user will be created on first payment
          }
        }

        // Wrap in try-catch - these methods throw WebAppMethodUnsupported outside Telegram
        try {
          tg.ready()
        } catch {
          console.warn('[TG] ready() not available outside Telegram')
        }
        try {
          tg.expand()
        } catch {
          console.warn('[TG] expand() not available outside Telegram')
        }
      } else if (!tg) {
        console.log("[TG] Not in Telegram WebApp context")
        setAuthStatus('not_in_telegram')
      } else {
        console.log("[TG] No user data in initDataUnsafe")
        setAuthStatus('failed')
      }
    }

    initAuth()

    return () => {
      abortController.abort()
    }
  }, [])

  return {
    userIdentifier,
    authStatus,
    telegramUserId: userIdentifier?.telegramUserId,
    theme,
    toggleTheme,
    showMessage,
  }
}
