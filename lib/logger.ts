/**
 * Conditional logger that suppresses logs in production
 * Replaces raw console.log calls to prevent information disclosure
 */

const isDev = process.env.NODE_ENV !== "production"

export const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  error: (...args: unknown[]) => console.error(...args), // Always log errors
  debug: (...args: unknown[]) => isDev && console.debug(...args),
  info: (...args: unknown[]) => isDev && console.info(...args),
}

/**
 * Create a tagged logger for specific modules
 * Usage: const log = createLogger("Payment")
 *        log.info("Processing...") // outputs: [Payment] Processing...
 */
export function createLogger(tag: string) {
  return {
    log: (...args: unknown[]) => logger.log(`[${tag}]`, ...args),
    warn: (...args: unknown[]) => logger.warn(`[${tag}]`, ...args),
    error: (...args: unknown[]) => logger.error(`[${tag}]`, ...args),
    debug: (...args: unknown[]) => logger.debug(`[${tag}]`, ...args),
    info: (...args: unknown[]) => logger.info(`[${tag}]`, ...args),
  }
}

// Pre-configured loggers for common modules
export const paymentLogger = createLogger("Payment")
export const authLogger = createLogger("Auth")
export const genLogger = createLogger("Generation")
export const apiLogger = createLogger("API")
