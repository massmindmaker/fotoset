/**
 * Pricing Tiers - Dynamic pricing from admin_settings
 * Falls back to hardcoded values if DB unavailable
 */

export interface PricingTier {
  id: string
  name: string
  price: number           // Original price in RUB
  photoCount: number
  discount?: number       // 0-100 percentage discount
  isActive: boolean
  isPopular?: boolean
}

/**
 * Calculate discounted price
 */
export function getDiscountedPrice(tier: PricingTier): number {
  if (!tier.discount || tier.discount <= 0) return tier.price
  return Math.round(tier.price * (1 - tier.discount / 100))
}

export interface PricingTiers {
  starter: PricingTier & { id: 'starter' }
  standard: PricingTier & { id: 'standard' }
  premium: PricingTier & { id: 'premium' }
}

// Hardcoded fallback (used when DB is unavailable)
export const DEFAULT_PRICING: PricingTiers = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 499,
    photoCount: 7,
    discount: 0,
    isActive: true
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    price: 999,
    photoCount: 15,
    discount: 0,
    isActive: true,
    isPopular: true
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 1499,
    photoCount: 23,
    discount: 0,
    isActive: true
  }
}

// Tier IDs for iteration
export const TIER_IDS = ['starter', 'standard', 'premium'] as const
export type TierId = typeof TIER_IDS[number]

/**
 * Get pricing tiers from the server
 * Used client-side in payment-modal
 */
export async function fetchPricingTiers(): Promise<PricingTiers> {
  try {
    const response = await fetch('/api/pricing', {
      next: { revalidate: 60 } // Cache for 60 seconds
    })

    if (!response.ok) {
      console.warn('[Pricing] Failed to fetch, using defaults')
      return DEFAULT_PRICING
    }

    const data = await response.json()
    return data.pricing || DEFAULT_PRICING
  } catch (error) {
    console.warn('[Pricing] Error fetching, using defaults:', error)
    return DEFAULT_PRICING
  }
}

/**
 * Get active tiers as an array (sorted by price)
 */
export function getActiveTiers(pricing: PricingTiers): PricingTier[] {
  return TIER_IDS
    .map(id => ({ ...pricing[id], id }))
    .filter(tier => tier.isActive)
    .sort((a, b) => a.price - b.price)
}

/**
 * Get tier by ID
 */
export function getTierById(pricing: PricingTiers, id: TierId): PricingTier | undefined {
  const tier = pricing[id]
  if (!tier || !tier.isActive) return undefined
  return { ...tier, id }
}

/**
 * Get photo count by tier ID
 */
export function getPhotoCountByTier(pricing: PricingTiers, id: TierId): number {
  return pricing[id]?.photoCount || DEFAULT_PRICING[id].photoCount
}

/**
 * Get price by tier ID
 */
export function getPriceByTier(pricing: PricingTiers, id: TierId): number {
  return pricing[id]?.price || DEFAULT_PRICING[id].price
}
