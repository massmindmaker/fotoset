"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Active pack data structure
 */
export interface ActivePack {
  id: number
  slug: string
  name: string
  iconEmoji: string
  coverUrl?: string
  previewImages: string[]
}

const DEFAULT_PACK_SLUG = "pinglass-premium"

/**
 * Hook to fetch user's active pack with fallback to default
 * 
 * @param telegramUserId - Telegram user ID for authentication
 * @param neonUserId - Neon user ID for web authentication
 * @returns { activePack, isLoading, refetch }
 */
export function useActivePack(telegramUserId?: number, neonUserId?: string) {
  const [activePack, setActivePack] = useState<ActivePack | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivePack = useCallback(async () => {
    // Need at least one auth identifier
    if (!telegramUserId && !neonUserId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Build headers for authentication
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      }
      if (telegramUserId) {
        headers["X-Telegram-User-Id"] = String(telegramUserId)
      }
      if (neonUserId) {
        headers["X-Neon-User-Id"] = neonUserId
      }

      // Try to get user's active pack
      const response = await fetch("/api/user/active-pack", {
        headers,
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.data?.activePack) {
          setActivePack(data.data.activePack)
          setIsLoading(false)
          return
        }
      }

      // No active pack set - fetch default pack
      console.log("[useActivePack] No active pack, fetching default:", DEFAULT_PACK_SLUG)
      const defaultResponse = await fetch(`/api/packs/${DEFAULT_PACK_SLUG}`)
      
      if (defaultResponse.ok) {
        const packData = await defaultResponse.json()
        setActivePack({
          id: packData.id,
          slug: packData.slug,
          name: packData.name,
          iconEmoji: packData.emoji || "",
          coverUrl: packData.coverUrl,
          previewImages: packData.previewImages || [],
        })
      } else {
        console.error("[useActivePack] Failed to fetch default pack")
        setError("Failed to load pack")
      }
    } catch (err) {
      console.error("[useActivePack] Error:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [telegramUserId, neonUserId])

  // Fetch on mount and when auth changes
  useEffect(() => {
    fetchActivePack()
  }, [fetchActivePack])

  return {
    activePack,
    isLoading,
    error,
    refetch: fetchActivePack,
  }
}
