"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Pack interface for UI components
 * Note: API returns camelCase fields, we normalize them here
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
  owner_type: "system" | "partner" | "admin"
  partner_name: string | null
  created_at: string
}

/**
 * API response pack format (camelCase)
 */
interface ApiPack {
  id: number
  slug: string
  name: string
  description?: string | null
  iconEmoji?: string | null
  icon?: string | null
  coverUrl?: string | null
  cover_url?: string | null
  previewImages?: string[]
  preview_urls?: string[]
  promptCount?: number
  styles_count?: number
  usageCount?: number
  generations_count?: number
  isFeatured?: boolean
  is_featured?: boolean
  ownerType?: string
  owner_type?: string
  partnerName?: string | null
  partner_name?: string | null
  createdAt?: string
  created_at?: string
}

/**
 * Normalize API pack to UI Pack interface
 */
function normalizeApiPack(apiPack: ApiPack): Pack {
  return {
    id: apiPack.id,
    slug: apiPack.slug,
    name: apiPack.name,
    description: apiPack.description ?? null,
    icon: apiPack.iconEmoji || apiPack.icon || null,
    cover_url: apiPack.coverUrl || apiPack.cover_url || null,
    preview_urls: apiPack.previewImages || apiPack.preview_urls || [],
    styles_count: apiPack.promptCount ?? apiPack.styles_count ?? 0,
    generations_count: apiPack.usageCount ?? apiPack.generations_count ?? 0,
    is_featured: apiPack.isFeatured ?? apiPack.is_featured ?? false,
    owner_type: (apiPack.ownerType || apiPack.owner_type || "system") as Pack["owner_type"],
    partner_name: apiPack.partnerName || apiPack.partner_name || null,
    created_at: apiPack.createdAt || apiPack.created_at || new Date().toISOString(),
  }
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

      // API returns { success: true, data: { packs: [...] } }
      const packsArray = data.data?.packs || data.packs
      if (data.success && Array.isArray(packsArray)) {
        // Normalize API format to UI format
        const normalizedPacks = packsArray.map(normalizeApiPack)
        setPacks(normalizedPacks)
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
