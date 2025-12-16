import { NextResponse } from "next/server"

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: ResponseMeta
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export interface ResponseMeta {
  page?: number
  limit?: number
  total?: number
  totalPages?: number
  timestamp?: string
}

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

// ============================================================================
// Error Codes
// ============================================================================

export type ErrorCode =
  // Client errors (4xx)
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT_EXCEEDED"
  | "PAYLOAD_TOO_LARGE"
  // Server errors (5xx)
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "DATABASE_ERROR"
  | "EXTERNAL_API_ERROR"
  // Domain-specific errors
  | "USER_NOT_FOUND"
  | "AVATAR_NOT_FOUND"
  | "GENERATION_FAILED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REQUIRED"
  | "INSUFFICIENT_CREDITS"
  | "INVALID_STYLE"
  | "NO_REFERENCE_IMAGES"

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  // Client errors
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT_EXCEEDED: 429,
  PAYLOAD_TOO_LARGE: 413,
  // Server errors
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  DATABASE_ERROR: 500,
  EXTERNAL_API_ERROR: 502,
  // Domain-specific (mapped to appropriate HTTP codes)
  USER_NOT_FOUND: 404,
  AVATAR_NOT_FOUND: 404,
  GENERATION_FAILED: 500,
  PAYMENT_FAILED: 502,
  PAYMENT_REQUIRED: 402,
  INSUFFICIENT_CREDITS: 402,
  INVALID_STYLE: 400,
  NO_REFERENCE_IMAGES: 400,
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a successful API response
 */
export function success<T>(
  data: T,
  meta?: ResponseMeta,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  }

  if (meta) {
    response.meta = {
      ...meta,
      timestamp: new Date().toISOString(),
    }
  }

  return NextResponse.json(response, { status })
}

/**
 * Create a successful response for resource creation (201)
 */
export function created<T>(data: T, meta?: ResponseMeta): NextResponse<ApiSuccessResponse<T>> {
  return success(data, meta, 201)
}

/**
 * Create an error API response
 */
export function error(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const status = ERROR_STATUS_MAP[code] || 500

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  }

  if (details) {
    response.error.details = details
  }

  return NextResponse.json(response, { status })
}

/**
 * Create an error response with custom status code
 */
export function errorWithStatus(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  }

  if (details) {
    response.error.details = details
  }

  return NextResponse.json(response, { status })
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: Record<string, unknown>,
  fields: string[]
): { valid: true } | { valid: false; missing: string[] } {
  const missing = fields.filter((field) => {
    const value = body[field]
    return value === undefined || value === null || value === ""
  })

  if (missing.length > 0) {
    return { valid: false, missing }
  }

  return { valid: true }
}

/**
 * Parse and validate pagination parameters
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): PaginationParams {
  const { page: defaultPage = 1, limit: defaultLimit = 20, maxLimit = 100 } = defaults

  let page = parseInt(searchParams.get("page") || String(defaultPage), 10)
  let limit = parseInt(searchParams.get("limit") || String(defaultLimit), 10)

  // Sanitize values
  page = Math.max(1, page)
  limit = Math.min(Math.max(1, limit), maxLimit)

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  }
}

/**
 * Create pagination meta from total count
 */
export function createPaginationMeta(
  pagination: PaginationParams,
  total: number
): ResponseMeta {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

// In-memory rate limit store (for serverless, consider using Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyPrefix?: string // Prefix for rate limit key
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number // Seconds until reset (only if not allowed)
}

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const { windowMs, maxRequests, keyPrefix = "rl" } = config
  const fullKey = `${keyPrefix}:${key}`
  const now = Date.now()

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupRateLimitStore()
  }

  const entry = rateLimitStore.get(fullKey)

  if (!entry || entry.resetAt <= now) {
    // New window
    const resetAt = now + windowMs
    rateLimitStore.set(fullKey, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
    }
  }

  if (entry.count >= maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    }
  }

  // Increment count
  entry.count++
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimitStore(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Apply rate limit and return error response if exceeded
 */
export function applyRateLimit(
  key: string,
  config: RateLimitConfig
): NextResponse<ApiErrorResponse> | null {
  const result = checkRateLimit(key, config)

  if (!result.allowed) {
    return error("RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.", {
      retryAfter: result.retryAfter,
      resetAt: new Date(result.resetAt).toISOString(),
    })
  }

  return null
}

// ============================================================================
// Logging Helpers
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error"

interface LogContext {
  [key: string]: unknown
}

/**
 * Structured logging helper
 */
export function log(
  level: LogLevel,
  tag: string,
  message: string,
  context?: LogContext
): void {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level,
    tag,
    message,
    ...context,
  }

  const prefix = `[${tag}]`

  switch (level) {
    case "debug":
      console.debug(prefix, message, context || "")
      break
    case "info":
      console.log(prefix, message, context || "")
      break
    case "warn":
      console.warn(prefix, message, context || "")
      break
    case "error":
      console.error(prefix, message, context || "")
      break
  }
}

/**
 * Create a logger with a fixed tag
 */
export function createLogger(tag: string) {
  return {
    debug: (message: string, context?: LogContext) => log("debug", tag, message, context),
    info: (message: string, context?: LogContext) => log("info", tag, message, context),
    warn: (message: string, context?: LogContext) => log("warn", tag, message, context),
    error: (message: string, context?: LogContext) => log("error", tag, message, context),
  }
}
