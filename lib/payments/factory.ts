/**
 * Payment Provider Factory
 * Returns the appropriate payment provider based on provider ID
 */

import type { IPaymentProvider, PaymentProviderId } from './types'
import { tbankProvider } from './providers/tbank'
import { starsProvider } from './providers/telegram-stars'
import { tonProvider } from './providers/ton'

const providers: Record<PaymentProviderId, IPaymentProvider> = {
  tbank: tbankProvider,
  stars: starsProvider,
  ton: tonProvider,
}

/**
 * Get a payment provider by ID
 */
export function getProvider(providerId: PaymentProviderId): IPaymentProvider {
  const provider = providers[providerId]
  if (!provider) {
    throw new Error(`Unknown payment provider: ${providerId}`)
  }
  return provider
}

/**
 * Get all available providers
 */
export function getAllProviders(): IPaymentProvider[] {
  return Object.values(providers)
}

/**
 * Get all enabled providers
 */
export async function getEnabledProviders(): Promise<IPaymentProvider[]> {
  const results = await Promise.all(
    Object.values(providers).map(async (provider) => ({
      provider,
      enabled: await provider.isEnabled(),
    }))
  )

  return results.filter((r) => r.enabled).map((r) => r.provider)
}

/**
 * Check if at least one provider is enabled
 */
export async function hasEnabledProvider(): Promise<boolean> {
  const enabled = await getEnabledProviders()
  return enabled.length > 0
}

// Re-export individual providers for direct access
export { tbankProvider, starsProvider, tonProvider }
