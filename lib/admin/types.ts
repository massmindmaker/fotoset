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
