"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Pack interface for public API response
 */
export interface Pack {
  id: number
  slug: string
  name: string
  icon: string | null
  description: string | null
  cover_url: string | null
  preview_urls: string[]
  styles_count: number
  generations_count: number
  is_featured: boolean
  owner_type: "system" | "partner"
  partner_name: string | null
  created_at: string
}

interface UsePacksReturn {
  packs: Pack[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook for fetching available photo packs from /api/packs
 */
export function usePacks(): UsePacksReturn {
  const [packs, setPacks] = useState<Pack[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPacks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/packs", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch packs: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && Array.isArray(data.packs)) {
        setPacks(data.packs)
      } else {
        throw new Error(data.error || "Invalid response format")
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPacks()
  }, [fetchPacks])

  return {
    packs,
    isLoading,
    error,
    refetch: fetchPacks,
  }
}
