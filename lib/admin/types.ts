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
  is_pro: boolean

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
