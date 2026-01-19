/**
 * Structured Logging Utility for PinGlass
 *
 * Features:
 * - Environment-aware (suppresses debug logs in production)
 * - Security-conscious (redacts sensitive data)
 * - Sentry integration for errors and security events
 * - Scoped loggers for modules
 *
 * Usage:
 *   import { logger, createLogger } from '@/lib/logger'
 *
 *   // Direct usage
 *   logger.info('API', 'Request received', { route: '/api/generate' })
 *   logger.error('Payment', 'Failed to process', error, { userId: 123 })
 *
 *   // Scoped logger
 *   const log = createLogger('Payment')
 *   log.info('Processing payment', { amount: 499 })
 */

import * as Sentry from '@sentry/nextjs'

const isDev = process.env.NODE_ENV !== 'production'

// Sensitive keys to redact from logged context
const SENSITIVE_KEYS = [
  'password',
  'token',
  'apikey',
  'api_key',
  'secret',
  'authorization',
  'creditcard',
  'card_number',
  'cvv',
  'initdata',
  'telegramInitData',
]

/**
 * Redact sensitive values from objects before logging
 */
function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[MAX_DEPTH]'
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'string') {
    // Redact long base64-like strings (tokens, keys)
    if (obj.length > 100 && /^[a-zA-Z0-9+/=_-]+$/.test(obj)) {
      return `[REDACTED ${obj.length} chars]`
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item, depth + 1))
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase()
      if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = redactSensitive(value, depth + 1)
      }
    }
    return result
  }

  return obj
}

/**
 * Format context for console output
 */
function formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return ''
  return ' ' + JSON.stringify(redactSensitive(context))
}

/**
 * Main logger with structured output
 */
export const logger = {
  /**
   * Debug log - development only
   */
  debug(tag: string, message: string, context?: Record<string, unknown>): void {
    if (!isDev) return
    console.debug(`[${tag}] ${message}${formatContext(context)}`)
  },

  /**
   * Info log - development only (unless ENABLE_PROD_INFO_LOGS=true)
   */
  info(tag: string, message: string, context?: Record<string, unknown>): void {
    if (!isDev && process.env.ENABLE_PROD_INFO_LOGS !== 'true') return
    console.log(`[${tag}] ${message}${formatContext(context)}`)
  },

  /**
   * Warning log - always logged
   */
  warn(tag: string, message: string, context?: Record<string, unknown>): void {
    console.warn(`[${tag}] ${message}${formatContext(context)}`)
  },

  /**
   * Error log - always logged + sent to Sentry
   */
  error(
    tag: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>
  ): void {
    const errMsg = error instanceof Error ? error.message : String(error || '')
    console.error(`[${tag}] ${message}${errMsg ? `: ${errMsg}` : ''}${formatContext(context)}`)

    // Send to Sentry
    if (error instanceof Error) {
      Sentry.captureException(error, {
        tags: { module: tag },
        extra: redactSensitive(context) as Record<string, unknown>,
      })
    } else if (error) {
      Sentry.captureMessage(`[${tag}] ${message}: ${errMsg}`, {
        level: 'error',
        extra: redactSensitive(context) as Record<string, unknown>,
      })
    }
  },

  /**
   * Security event - always logged + sent to Sentry with security tag
   */
  security(tag: string, message: string, context?: Record<string, unknown>): void {
    console.error(`[${tag}] SECURITY: ${message}${formatContext(context)}`)

    Sentry.captureMessage(`[SECURITY][${tag}] ${message}`, {
      level: 'warning',
      tags: { security: 'true', module: tag },
      extra: redactSensitive(context) as Record<string, unknown>,
    })
  },

  /**
   * Log function (backward compatibility)
   */
  log(...args: unknown[]): void {
    if (isDev) console.log(...args)
  },
}

/**
 * Create a scoped logger for a specific module
 */
export function createLogger(tag: string) {
  return {
    log: (...args: unknown[]) => isDev && console.log(`[${tag}]`, ...args),
    debug: (message: string, context?: Record<string, unknown>) =>
      logger.debug(tag, message, context),
    info: (message: string, context?: Record<string, unknown>) =>
      logger.info(tag, message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      logger.warn(tag, message, context),
    error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
      logger.error(tag, message, error, context),
    security: (message: string, context?: Record<string, unknown>) =>
      logger.security(tag, message, context),
  }
}

// Pre-configured loggers for common modules
export const paymentLogger = createLogger('Payment')
export const authLogger = createLogger('Auth')
export const genLogger = createLogger('Generation')
export const apiLogger = createLogger('API')
export const webhookLogger = createLogger('Webhook')
export const securityLogger = createLogger('Security')

export default logger
