"use client"

import { useState, useEffect, useCallback } from "react"
import type { PricingTier } from "../views/types"
import { DEFAULT_PRICING, TIER_IDS, getDiscountedPrice } from "@/lib/pricing"

interface UsePricingResult {
  tiers: PricingTier[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook for fetching dynamic pricing from API
 * Falls back to defaults if API is unavailable
 */
export function usePricing(): UsePricingResult {
  const [tiers, setTiers] = useState<PricingTier[]>(() => {
    // Initial state with defaults
    return TIER_IDS.map(id => ({
      id,
      photos: DEFAULT_PRICING[id].photoCount,
      price: getDiscountedPrice(DEFAULT_PRICING[id]),
      originalPrice: DEFAULT_PRICING[id].discount ? DEFAULT_PRICING[id].price : undefined,
      discount: DEFAULT_PRICING[id].discount,
      popular: DEFAULT_PRICING[id].isPopular,
    }))
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPricing = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/pricing", {
        cache: "no-store", // Always get fresh data
      })

      if (!response.ok) {
        throw new Error("Failed to fetch pricing")
      }

      const data = await response.json()
      const pricing = data.pricing

      // Convert to PricingTier format with discount calculations
      const newTiers: PricingTier[] = TIER_IDS.map(id => {
        const tier = pricing[id] || DEFAULT_PRICING[id]
        const discountedPrice = getDiscountedPrice(tier)

        return {
          id,
          photos: tier.photoCount,
          price: discountedPrice,
          originalPrice: tier.discount && tier.discount > 0 ? tier.price : undefined,
          discount: tier.discount || undefined,
          popular: tier.isPopular,
        }
      }).filter(tier => {
        // Only include active tiers
        const sourceTier = pricing[tier.id] || DEFAULT_PRICING[tier.id as keyof typeof DEFAULT_PRICING]
        return sourceTier.isActive !== false
      })

      setTiers(newTiers)
    } catch (err) {
      console.warn("[usePricing] Failed to fetch, using defaults:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      // Keep current tiers (defaults)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPricing()
  }, [fetchPricing])

  return {
    tiers,
    isLoading,
    error,
    refetch: fetchPricing,
  }
}
