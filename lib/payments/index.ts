/**
 * Multi-Provider Payment System
 * Unified payment handling for T-Bank, Telegram Stars, and TON
 */

// Types
export * from './types'

// Provider factory
export {
  getProvider,
  getAllProviders,
  getEnabledProviders,
  hasEnabledProvider,
  tbankProvider,
  starsProvider,
  tonProvider,
} from './factory'

// Exchange rates
export {
  getExchangeRate,
  fetchExchangeRate,
  convertToRUB,
  getRecentRates,
  setManualRate,
} from './rates'

// Refund dispatcher
export {
  dispatchRefund,
  autoRefundForFailedGeneration,
  type RefundContext,
  type DispatcherResult,
} from './refund-dispatcher'
