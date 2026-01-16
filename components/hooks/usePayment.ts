import { useState, useCallback, useEffect } from "react"
import type { PricingTier } from "../views/types"

// Key for localStorage (must match payment-modal.tsx)
const PENDING_TON_STORAGE_KEY = 'pinglass_pending_ton_payment'

/**
 * Custom hook for payment flow management
 * Handles payment modal state and tier selection
 * Also auto-opens modal if there's a pending TON payment intent (after wallet connect return)
 */
export function usePayment() {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null)
  const [pendingTonIntent, setPendingTonIntent] = useState<{ tierId?: string } | null>(null)

  // Check for pending TON payment intent on mount
  // This handles the case where user returns from Tonkeeper after connecting wallet
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(PENDING_TON_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        const age = Date.now() - (data.timestamp || 0)

        // Only proceed if intent is less than 5 minutes old
        if (age < 5 * 60 * 1000) {
          console.log('[usePayment] Found pending TON payment intent, auto-opening modal', data)
          setPendingTonIntent(data)
          setIsPaymentOpen(true)
        } else {
          // Intent expired, clean up
          console.log('[usePayment] Pending TON intent expired, cleaning up')
          localStorage.removeItem(PENDING_TON_STORAGE_KEY)
        }
      }
    } catch (e) {
      console.error('[usePayment] Error reading pending TON intent:', e)
      localStorage.removeItem(PENDING_TON_STORAGE_KEY)
    }
  }, [])

  const openPayment = useCallback((tier: PricingTier) => {
    setSelectedTier(tier)
    setIsPaymentOpen(true)
  }, [])

  const closePayment = useCallback(() => {
    setIsPaymentOpen(false)
    setPendingTonIntent(null)
  }, [])

  return {
    isPaymentOpen,
    setIsPaymentOpen,
    selectedTier,
    setSelectedTier,
    openPayment,
    closePayment,
    pendingTonIntent, // Expose for debugging
  }
}
