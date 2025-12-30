"use client"

import { useState, useEffect } from 'react'
import {
  DEFAULT_PRICING,
  TIER_IDS,
  type PricingTiers,
  type TierId
} from '@/lib/pricing'
import type { PricingTier } from '@/components/views/types'

interface UsePricingResult {
  pricing: PricingTiers
  tiers: PricingTier[]
  loading: boolean
  error: string | null
  getTier: (id: TierId) => PricingTier | undefined
  refresh: () => Promise<void>
}

/**
 * Hook for loading dynamic pricing from the server
 * Falls back to DEFAULT_PRICING if server is unavailable
 */
export function usePricing(): UsePricingResult {
  const [pricing, setPricing] = useState<PricingTiers>(DEFAULT_PRICING)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPricing = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/pricing')

      if (!response.ok) {
        console.warn('[usePricing] Failed to fetch, using defaults')
        setPricing(DEFAULT_PRICING)
        return
      }

      const data = await response.json()
      setPricing(data.pricing || DEFAULT_PRICING)
    } catch (err) {
      console.warn('[usePricing] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load pricing')
      setPricing(DEFAULT_PRICING)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPricing()
  }, [])

  // Convert PricingTiers to PricingTier[] array for UI components
  const tiers: PricingTier[] = TIER_IDS
    .reduce<PricingTier[]>((acc, id) => {
      const tier = pricing[id]
      if (tier && tier.isActive) {
        acc.push({
          id,
          photos: tier.photoCount,
          price: tier.price,
          popular: tier.isPopular
        })
      }
      return acc
    }, [])
    .sort((a, b) => a.price - b.price)

  const getTier = (id: TierId): PricingTier | undefined => {
    const tier = pricing[id]
    if (!tier || !tier.isActive) return undefined
    return {
      id,
      photos: tier.photoCount,
      price: tier.price,
      popular: tier.isPopular
    }
  }

  return {
    pricing,
    tiers,
    loading,
    error,
    getTier,
    refresh: fetchPricing
  }
}

export default usePricing
