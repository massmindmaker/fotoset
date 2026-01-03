/**
 * Payment Provider Types
 * Unified payment system for T-Bank, Telegram Stars, and TON
 */

// ============================================================================
// Provider Identifiers
// ============================================================================

export type PaymentProviderId = 'tbank' | 'stars' | 'ton'

export type Currency = 'RUB' | 'XTR' | 'TON'

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'canceled'
  | 'refunded'
  | 'refunding'
  | 'expired'
  | 'partial'

// ============================================================================
// Exchange Rates
// ============================================================================

export interface ExchangeRate {
  id: number
  fromCurrency: Currency
  toCurrency: Currency
  rate: number
  source: 'telegram_api' | 'coingecko' | 'manual'
  fetchedAt: Date
  expiresAt: Date | null
  rawResponse?: Record<string, unknown>
}

export interface RateConversion {
  originalAmount: number
  originalCurrency: Currency
  convertedAmount: number
  convertedCurrency: Currency
  rate: number
  rateLockedAt: Date
  rateExpiresAt: Date
}

// ============================================================================
// Payment Request/Response Types
// ============================================================================

export interface CreatePaymentRequest {
  userId: number
  tierId: 'starter' | 'standard' | 'premium'
  avatarId: number
  email?: string
  provider: PaymentProviderId
}

export interface CreatePaymentResponse {
  success: boolean
  paymentId: number
  providerPaymentId: string
  redirectUrl?: string // T-Bank
  invoiceUrl?: string // Stars
  walletAddress?: string // TON
  amount: number
  currency: Currency
  amountRub: number
  exchangeRate?: number
  expiresAt?: Date
}

export interface PaymentStatusResponse {
  paymentId: number
  status: PaymentStatus
  provider: PaymentProviderId
  amountRub: number
  originalAmount?: number
  originalCurrency?: Currency
  exchangeRate?: number
  // Provider-specific
  telegramChargeId?: string
  tonTxHash?: string
  tonConfirmations?: number
  updatedAt: Date
}

export interface RefundRequest {
  paymentId: number
  reason?: string
  adminId: number
}

export interface RefundResponse {
  success: boolean
  refundId?: string
  // Flag indicating manual refund is needed (for TON, Stars API failures)
  manualRefund?: boolean
  // Human-readable instructions for manual refund
  manualInstructions?: string
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookPayload {
  provider: PaymentProviderId
  rawPayload: unknown
}

export interface WebhookResult {
  success: boolean
  paymentId?: number
  status?: PaymentStatus
  error?: string
}

// T-Bank specific
export interface TBankWebhookPayload {
  TerminalKey: string
  OrderId: string
  Success: boolean
  Status: string
  PaymentId: number
  Amount: number
  Token: string
  ErrorCode?: string
}

// Telegram Stars specific
export interface StarsWebhookPayload {
  update_id: number
  pre_checkout_query?: {
    id: string
    from: { id: number }
    currency: 'XTR'
    total_amount: number
    invoice_payload: string
  }
  successful_payment?: {
    telegram_payment_charge_id: string
    provider_payment_charge_id: string
    currency: 'XTR'
    total_amount: number
    invoice_payload: string
  }
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface IPaymentProvider {
  name: PaymentProviderId

  /**
   * Create a new payment
   */
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>

  /**
   * Get payment status
   */
  getStatus(paymentId: number): Promise<PaymentStatusResponse>

  /**
   * Process incoming webhook
   */
  processWebhook(payload: unknown): Promise<WebhookResult>

  /**
   * Initiate refund (may be manual for TON)
   */
  refund(request: RefundRequest): Promise<RefundResponse>

  /**
   * Convert amount to RUB equivalent
   */
  convertToRUB(amount: number): Promise<RateConversion>

  /**
   * Check if provider is enabled in settings
   */
  isEnabled(): Promise<boolean>
}

// ============================================================================
// Database Types (for lib/db.ts extension)
// ============================================================================

export interface PaymentDB {
  id: number
  user_id: number

  // Provider info
  provider: PaymentProviderId
  provider_payment_id: string | null
  tbank_payment_id: string | null

  // Telegram Stars
  telegram_charge_id: string | null
  stars_amount: number | null

  // TON
  ton_tx_hash: string | null
  ton_amount: number | null
  ton_sender_address: string | null
  ton_confirmations: number

  // Amounts
  amount: number  // Always in RUB
  currency: string
  original_currency: Currency
  original_amount: number | null
  exchange_rate: number | null
  rate_locked_at: Date | null
  rate_expires_at: Date | null

  // Status
  status: PaymentStatus

  // Tier info
  tier_id: 'starter' | 'standard' | 'premium' | null
  photo_count: number | null

  // Refund info
  refund_amount: number | null
  refund_status: string | null
  refund_reason: string | null
  refund_at: Date | null

  // Generation binding
  generation_consumed: boolean
  consumed_at: Date | null
  consumed_avatar_id: number | null

  // Timestamps
  created_at: Date
  updated_at: Date
}

export interface ExchangeRateDB {
  id: number
  from_currency: Currency
  to_currency: Currency
  rate: number
  source: string
  fetched_at: Date
  expires_at: Date | null
  raw_response: Record<string, unknown> | null
}

export interface OrphanPaymentDB {
  id: number
  tx_hash: string
  amount: number
  wallet_address: string
  status: 'unmatched' | 'matched' | 'refunded'
  matched_payment_id: number | null
  created_at: Date
}

// ============================================================================
// Admin Settings Types
// ============================================================================

export interface PaymentMethodSettings {
  enabled: boolean
}

export interface TBankMethodSettings extends PaymentMethodSettings {
  commission: number
}

export interface StarsMethodSettings extends PaymentMethodSettings {
  pricing: {
    starter: number  // Stars amount
    standard: number
    premium: number
  }
}

export interface TonMethodSettings extends PaymentMethodSettings {
  walletAddress: string
  pricing: {
    starter: number  // TON amount
    standard: number
    premium: number
  }
}

export interface PaymentMethodsConfig {
  tbank: TBankMethodSettings
  stars: StarsMethodSettings
  ton: TonMethodSettings
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethodsConfig = {
  tbank: {
    enabled: true,
    commission: 0
  },
  stars: {
    enabled: false,
    pricing: {
      starter: 99,
      standard: 199,
      premium: 299
    }
  },
  ton: {
    enabled: false,
    walletAddress: '',
    pricing: {
      starter: 1.5,
      standard: 3.0,
      premium: 4.5
    }
  }
}

// ============================================================================
// Pricing Helpers
// ============================================================================

export interface TierPricing {
  tierId: 'starter' | 'standard' | 'premium'
  priceRub: number
  priceStars?: number
  priceTon?: number
  exchangeRates?: {
    starsToRub?: number
    tonToRub?: number
  }
}

export interface AvailablePaymentMethod {
  id: PaymentProviderId
  name: string
  icon: string
  price: number
  currency: Currency
  priceFormatted: string
  enabled: boolean
}
