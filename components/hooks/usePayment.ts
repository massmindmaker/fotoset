import { useState, useCallback } from "react"
import type { PricingTier } from "../views/types"

/**
 * Custom hook for payment flow management
 * Handles payment modal state and tier selection
 */
export function usePayment() {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null)

  const openPayment = useCallback((tier: PricingTier) => {
    setSelectedTier(tier)
    setIsPaymentOpen(true)
  }, [])

  const closePayment = useCallback(() => {
    setIsPaymentOpen(false)
  }, [])

  return {
    isPaymentOpen,
    setIsPaymentOpen,
    selectedTier,
    setSelectedTier,
    openPayment,
    closePayment,
  }
}
