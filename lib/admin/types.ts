/**
 * Admin Panel TypeScript Types
 *
 * Centralized type definitions for admin components and API
 */

// ============================================================================
// Sentry Types (for Logs & Monitoring)
// ============================================================================

export interface SentryEvent {
  id: string
  eventID: string
  message: string
  level: 'error' | 'warning' | 'info' | 'debug'
  timestamp: string // ISO 8601
  user?: {
    id?: string
    telegram_id?: number
    username?: string
    ip_address?: string
  }
  tags?: Record<string, string>
  context?: Record<string, unknown>
  platform?: string
  culprit?: string // function/file where error occurred
}

export interface SentryFilters {
  level: 'error' | 'warning' | 'info' | 'all'
  dateFrom?: string | null
  dateTo?: string | null
  userId?: number | null // telegram_user_id
  search?: string
  page: number
  limit: number
}

export interface SentryResponse {
  events: SentryEvent[]
  totalPages: number
  currentPage: number
  totalEvents: number
}

// ============================================================================
// Users Types (Admin Panel)
// ============================================================================

/**
 * AdminUserListItem
 * User data with aggregated stats for admin panel
 * Includes photo counts and Telegram status (Task 2.2)
 */
export interface AdminUserListItem {
  id: number
  telegram_user_id: number
  created_at: string
  updated_at: string
  pending_referral_code: string | null
  pending_generation_tier: string | null

  // Existing aggregates
  avatars_count: number
  payments_count: number
  total_spent: number
  has_paid: boolean // User has at least one successful payment

  // NEW: Photo counts (Task 2.2)
  ref_photos_total: number   // Uploaded reference photos
  gen_photos_total: number   // Generated AI photos

  // NEW: Telegram status counts (Task 2.2)
  tg_sent_count: number      // Successfully delivered
  tg_pending_count: number   // In queue
  tg_failed_count: number    // Delivery failed
}

// ============================================================================
// Payments Types (Admin Panel)
// ============================================================================

/**
 * Payment (extended from lib/db.ts)
 * Full payment data for admin panel with user info
 */
export interface AdminPayment {
  id: number
  tbank_payment_id: string
  user_id: number
  telegram_user_id: number
  telegram_username: string | null  // NEW: Telegram username
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'canceled' | 'refunded' | 'refunding'
  tier_id: 'starter' | 'standard' | 'premium' | null
  photo_count: number | null
  refund_amount: number | null
  refund_status: string | null
  refund_reason: string | null
  refund_at: string | null
  created_at: string
  updated_at: string
  // NEW: Telegram delivery stats for this payment's generation
  tg_sent_count: number | null      // Photos sent to Telegram
  gen_photos_count: number | null   // Total generated photos
}

/**
 * Payment Filters
 * Query parameters for /api/admin/payments
 */
export interface PaymentFilters {
  status?: 'pending' | 'succeeded' | 'canceled' | 'refunded'
  dateFrom?: string
  dateTo?: string
  amountMin?: number
  amountMax?: number
  telegramUserId?: number
  tierId?: 'starter' | 'standard' | 'premium'
  page: number
  limit: number
}

/**
 * Payment Stats
 * Aggregated revenue and conversion metrics
 */
export interface PaymentStats {
  total_revenue: number
  net_revenue: number
  avg_order_value: number
  conversion_rate: number
  total_payments: number
  refunded_count: number
  refunded_amount: number
}

/**
 * Daily Revenue
 * Revenue breakdown by date
 */
export interface DailyRevenue {
  date: string
  revenue: number
  count: number
}

/**
 * Tier Breakdown
 * Revenue by pricing tier
 */
export interface TierBreakdown {
  tier_id: string
  count: number
  revenue: number
}

// ============================================================================
// Prompt Testing Types
// ============================================================================

/**
 * Reference Image
 * Uploaded by user for KIE AI generation
 */
export interface ReferenceImage {
  id: string
  file: File
  previewUrl: string // URL.createObjectURL result
}

/**
 * Test Block
 * Single prompt testing block with results
 */
export interface TestBlock {
  id: string
  prompt: string
  photoCount: 1 | 2 | 3 | 4
  status: 'idle' | 'generating' | 'completed' | 'failed'
  results?: TestResult[]
  error?: string
  startedAt?: number // timestamp (Date.now())
  completedAt?: number // timestamp
}

/**
 * Test Result
 * Single generated photo from KIE AI
 */
export interface TestResult {
  imageUrl: string
  latency: number // milliseconds
  taskId: string
  aspectRatio?: string
}

/**
 * Test Prompt Request
 * API request body for /api/admin/test-prompt
 */
export interface TestPromptRequest {
  referenceImages: string[] // base64 or R2 URLs
  prompt: string
  photoCount: 1 | 2 | 3 | 4
  aspectRatio?: '1:1' | '3:4' | '9:16'
}

/**
 * Test Prompt Response
 * API response from /api/admin/test-prompt
 */
export interface TestPromptResponse {
  success: boolean
  results?: TestResult[]
  error?: AdminError
}

// ============================================================================
// Auth Types
// ============================================================================

export interface AdminUser {
  telegramUserId: number
  telegramUsername?: string
  isAdmin: boolean
}

// ============================================================================
// Generation Types (Admin Panel)
// ============================================================================

/**
 * Generation Job Status
 */
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/**
 * AdminGenerationJob
 * Full generation job data for admin panel
 */
export interface AdminGenerationJob {
  id: number
  avatar_id: number
  avatar_name: string | null
  style_id: string | null
  status: GenerationStatus
  total_photos: number
  completed_photos: number
  error_message: string | null
  payment_id: number | null
  created_at: string
  updated_at: string
  // Related user data
  user_id: number
  telegram_user_id: number
  // Progress percentage
  progress: number
  // Duration in seconds (if completed or failed)
  duration: number | null
}

/**
 * Generation Filters
 */
export interface GenerationFilters {
  status?: GenerationStatus
  dateFrom?: string
  dateTo?: string
  avatarId?: number
  userId?: number
  page: number
  limit: number
}

/**
 * Generation Stats
 */
export interface GenerationStats {
  total_jobs: number
  completed_jobs: number
  failed_jobs: number
  processing_jobs: number
  pending_jobs: number
  total_photos: number
  avg_completion_time: number // in seconds
  success_rate: number // percentage
}

/**
 * Generation Details (for modal)
 */
export interface GenerationDetails extends AdminGenerationJob {
  photos: GeneratedPhoto[]
  kie_tasks: KieTask[]
  avatar: {
    id: number
    name: string
    status: string
    reference_photos_count: number
  } | null
}

/**
 * Generated Photo
 */
export interface GeneratedPhoto {
  id: number
  style_id: string | null
  prompt: string | null
  image_url: string
  created_at: string
}

/**
 * KIE Task (for tracking generation progress)
 */
export interface KieTask {
  id: number
  job_id: number
  style_id: string | null
  status: string
  task_id: string | null
  image_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Referral Types (Admin Panel)
// ============================================================================

/**
 * Referral Stats
 */
export interface ReferralStats {
  total_codes: number
  total_referrals: number
  total_earnings: number
  pending_balance: number
  total_withdrawn: number
  pending_withdrawals: number
  funnel: {
    registered: number
    paid: number
  }
}

/**
 * Top Referrer
 */
export interface TopReferrer {
  user_id: number
  telegram_user_id: string
  referrals_count: number
  balance: number
  total_earned: number
  total_withdrawn: number
  referral_code: string | null
  conversions: number
}

/**
 * Recent Earning
 */
export interface ReferralEarning {
  id: number
  referrer_id: number
  referrer_telegram_id: string
  referred_id: number
  referred_telegram_id: string
  amount: number
  status: string
  created_at: string
  payment_id: string | null
}

/**
 * Withdrawal Request
 */
export interface WithdrawalRequest {
  id: number
  user_id: number
  telegram_user_id: string
  amount: number
  ndfl_amount: number
  payout_amount: number
  method: string
  card_number: string | null
  phone: string | null
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'
  created_at: string
  processed_at: string | null
  current_balance: number
  total_earned: number
}

// ============================================================================
// Telegram Queue Types (Admin Panel)
// ============================================================================

/**
 * Telegram Message Status
 */
export type TelegramMessageStatus = 'pending' | 'sent' | 'failed' | 'retry'

/**
 * Telegram Queue Message
 */
export interface TelegramQueueMessage {
  id: number
  user_id: number
  telegram_user_id: string
  message_type: string
  payload: Record<string, unknown>
  status: TelegramMessageStatus
  retry_count: number
  error_message: string | null
  created_at: string
  sent_at: string | null
}

/**
 * Telegram Queue Stats
 */
export interface TelegramQueueStats {
  pending: number
  sent: number
  failed: number
  retry: number
  total: number
  success_rate: number
}

// ============================================================================
// Error Types
// ============================================================================

export type AdminErrorCode =
  | 'AUTH_FAILED'
  | 'WHITELIST_DENIED'
  | 'SENTRY_API_ERROR'
  | 'SENTRY_TIMEOUT'
  | 'KIE_API_ERROR'
  | 'KIE_TIMEOUT'
  | 'INVALID_INPUT'
  | 'UPLOAD_FAILED'
  | 'NETWORK_ERROR'

export interface AdminError {
  code: AdminErrorCode
  message: string
  userMessage: string // User-friendly Russian message
  retryable: boolean
  details?: unknown
}

// ============================================================================
// Payment Methods Settings (Multi-Provider Support)
// ============================================================================

/**
 * Payment Provider ID
 */
export type PaymentMethodId = 'tbank' | 'stars' | 'ton'

/**
 * Base Payment Method Config
 */
export interface PaymentMethodConfig {
  enabled: boolean
}

/**
 * T-Bank Payment Method Settings
 */
export interface TBankMethodSettings extends PaymentMethodConfig {
  commission: number  // Percentage (0-100)
}

/**
 * Telegram Stars Payment Method Settings
 */
export interface StarsMethodSettings extends PaymentMethodConfig {
  pricing: {
    starter: number   // Stars amount
    standard: number
    premium: number
  }
}

/**
 * TON Crypto Payment Method Settings
 */
export interface TonMethodSettings extends PaymentMethodConfig {
  walletAddress: string
  pricing: {
    starter: number   // TON amount
    standard: number
    premium: number
  }
}

/**
 * All Payment Methods Configuration
 */
export interface PaymentMethodsSettings {
  tbank: TBankMethodSettings
  stars: StarsMethodSettings
  ton: TonMethodSettings
}

/**
 * Default Payment Methods Settings
 */
export const DEFAULT_PAYMENT_METHODS: PaymentMethodsSettings = {
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

/**
 * Exchange Rate Info (for display in admin panel)
 */
export interface ExchangeRateInfo {
  currency: 'XTR' | 'TON'
  rate: number        // Rate to RUB
  source: string      // telegram_api, coingecko
  updatedAt: string   // ISO 8601
  expiresAt?: string
}

/**
 * Extended AdminPayment with multi-provider support
 */
export interface AdminPaymentExtended extends AdminPayment {
  provider: PaymentMethodId
  provider_payment_id: string | null
  // Telegram Stars
  telegram_charge_id: string | null
  stars_amount: number | null
  // TON
  ton_tx_hash: string | null
  ton_amount: number | null
  ton_sender_address: string | null
  ton_confirmations: number | null
  // Currency tracking
  original_currency: 'RUB' | 'XTR' | 'TON'
  original_amount: number | null
  exchange_rate: number | null
}

/**
 * Payment Stats by Method
 */
export interface PaymentStatsByMethod {
  method: PaymentMethodId
  count: number
  revenue: number      // In RUB
  originalAmount?: number
  originalCurrency?: 'RUB' | 'XTR' | 'TON'
}

/**
 * Extended Payment Filters with provider
 */
export interface PaymentFiltersExtended extends PaymentFilters {
  provider?: PaymentMethodId
}

/**
 * Orphan Payment (unmatched TON transaction)
 */
export interface OrphanPayment {
  id: number
  tx_hash: string
  amount: number
  wallet_address: string
  status: 'unmatched' | 'matched' | 'refunded'
  matched_payment_id: number | null
  created_at: string
}
