import { type NextRequest } from "next/server"
import { getUserIdentifier } from "@/lib/auth-utils"

/**
 * Admin Authentication Utilities
 *
 * Provides whitelist-based authentication for admin panel access.
 * Only Telegram users listed in ADMIN_TELEGRAM_IDS env variable can access /admin routes.
 */

/**
 * Get admin whitelist from environment variable
 * Parses comma-separated Telegram user IDs
 *
 * @returns Array of whitelisted Telegram user IDs
 *
 * @example
 * // .env: ADMIN_TELEGRAM_IDS=123456789,987654321
 * getAdminWhitelist() // [123456789, 987654321]
 */
export function getAdminWhitelist(): number[] {
  const env = process.env.ADMIN_TELEGRAM_IDS || ''

  if (!env) {
    console.warn('[Admin Auth] ADMIN_TELEGRAM_IDS not configured - admin panel will be inaccessible')
    return []
  }

  const whitelist = env
    .split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id))

  if (whitelist.length === 0) {
    console.warn('[Admin Auth] No valid admin IDs found in ADMIN_TELEGRAM_IDS')
  } else {
    console.log(`[Admin Auth] Loaded ${whitelist.length} admin user(s)`)
  }

  return whitelist
}

/**
 * Check if a Telegram user ID is in the admin whitelist
 *
 * @param telegramUserId - Telegram user ID to check
 * @returns true if user is admin, false otherwise
 *
 * @example
 * checkAdminAccess(123456789) // true if 123456789 in whitelist
 */
export function checkAdminAccess(telegramUserId: number): boolean {
  // NaN validation
  if (isNaN(telegramUserId)) {
    console.warn('[Admin Auth] Invalid telegramUserId (NaN)')
    return false
  }

  const whitelist = getAdminWhitelist()
  const hasAccess = whitelist.includes(telegramUserId)

  console.log(`[Admin Auth] User ${telegramUserId} access: ${hasAccess}`)
  return hasAccess
}

/**
 * Verify admin access from Next.js request
 * Extracts Telegram user ID and checks whitelist
 *
 * @param request - Next.js request object
 * @returns Object with authorized status and telegramUserId
 *
 * @example
 * const { authorized, telegramUserId } = verifyAdminAccess(request)
 * if (!authorized) {
 *   return new NextResponse('Forbidden', { status: 403 })
 * }
 */
export function verifyAdminAccess(request: NextRequest): {
  authorized: boolean
  telegramUserId?: number
} {
  // Extract user identifier from request
  const identifier = getUserIdentifier(request)

  if (!identifier.telegramUserId) {
    console.log('[Admin Auth] No Telegram user ID found in request')
    return { authorized: false }
  }

  const authorized = checkAdminAccess(identifier.telegramUserId)

  return {
    authorized,
    telegramUserId: identifier.telegramUserId
  }
}

/**
 * Check if User-Agent indicates Telegram WebView
 * Used to block admin panel access from Telegram app
 *
 * @param userAgent - User-Agent string from request headers
 * @returns true if Telegram WebView detected
 *
 * @example
 * isTelegramWebView('Mozilla/5.0... Telegram/9.0') // true
 * isTelegramWebView('Mozilla/5.0... Chrome/120.0') // false
 */
export function isTelegramWebView(userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  const isTelegram = ua.includes('telegram')

  if (isTelegram) {
    console.log('[Admin Auth] Telegram WebView detected, blocking access')
  }

  return isTelegram
}
