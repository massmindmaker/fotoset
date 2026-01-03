"use client"

import { useState, useEffect } from 'react'

/**
 * Payment method configuration for frontend display
 */
interface PaymentMethodConfig {
  enabled: boolean
  pricing?: Record<string, number>  // tierId -> price in method's currency
}

interface PaymentMethodsConfig {
  tbank: PaymentMethodConfig
  stars: PaymentMethodConfig
  ton: PaymentMethodConfig
}

interface UsePaymentMethodsReturn {
  methods: PaymentMethodsConfig
  altMethodsCount: number
  isLoading: boolean
  error: string | null
}

// Default configuration (T-Bank only)
const DEFAULT_PAYMENT_METHODS: PaymentMethodsConfig = {
  tbank: { enabled: true },
  stars: { enabled: false, pricing: {} },
  ton: { enabled: false, pricing: {} },
}

/**
 * Hook to fetch available payment methods from the API
 * Used by PaymentModal to display available payment options
 */
export function usePaymentMethods(): UsePaymentMethodsReturn {
  const [methods, setMethods] = useState<PaymentMethodsConfig>(DEFAULT_PAYMENT_METHODS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchMethods() {
      try {
        const response = await fetch('/api/payment-methods')

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!cancelled) {
          setMethods(data.methods || DEFAULT_PAYMENT_METHODS)
          setError(null)
        }
      } catch (err) {
        console.error('[usePaymentMethods] Failed to fetch:', err)
        if (!cancelled) {
          // Keep default methods on error (T-Bank only)
          setMethods(DEFAULT_PAYMENT_METHODS)
          setError(err instanceof Error ? err.message : 'Failed to load payment methods')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchMethods()

    return () => {
      cancelled = true
    }
  }, [])

  // Count enabled alternative methods (Stars, TON)
  const altMethodsCount = [
    methods.stars.enabled,
    methods.ton.enabled,
  ].filter(Boolean).length

  return { methods, altMethodsCount, isLoading, error }
}
