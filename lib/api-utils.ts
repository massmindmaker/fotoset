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
  | "LIMIT_REACHED"
  | "QUEUE_FAILED"

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
  LIMIT_REACHED: 429,
  QUEUE_FAILED: 503,
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
// Rate Limiting (REMOVED 2025-12-20)
// ============================================================================
// NOTE: In-memory rate limiting doesn't work on Vercel serverless
// Each cold start creates a new Map, making it ineffective.
// Protection is now provided by: Telegram auth + payment barrier + API quotas
// If needed in future, use Upstash Redis for distributed rate limiting.

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
