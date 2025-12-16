/**
 * Telegram WebApp initData validation with HMAC-SHA256
 *
 * This module provides server-side validation of Telegram WebApp initData
 * to prevent spoofing attacks. All Telegram user IDs MUST be validated
 * through this module before being used in business logic.
 *
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import crypto from 'crypto'

export interface TelegramValidationResult {
  valid: boolean
  userId?: number
  username?: string
  firstName?: string
  lastName?: string
  languageCode?: string
  authDate?: number
  error?: string
}

export interface StrictAuthResult {
  authenticated: boolean
  telegramUserId?: number
  deviceId?: string
  authMethod: 'telegram' | 'device' | 'none'
  error?: string
}

/**
 * Validates Telegram WebApp initData using HMAC-SHA256
 *
 * @param initData - The initData string from Telegram WebApp
 * @param botToken - Your Telegram Bot Token (from environment)
 * @returns Validation result with user data if valid
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string
): TelegramValidationResult {
  if (!initData || !botToken) {
    return { valid: false, error: 'Missing initData or botToken' }
  }

  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')

    if (!hash) {
      return { valid: false, error: 'No hash in initData' }
    }

    // Remove hash from params for verification
    params.delete('hash')

    // Sort params alphabetically and create data-check-string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    // Create secret key: HMAC-SHA256(bot_token, "WebAppData")
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    // Calculate hash: HMAC-SHA256(data_check_string, secret_key)
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    // Constant-time comparison to prevent timing attacks
    const hashBuffer = Buffer.from(hash, 'hex')
    const computedBuffer = Buffer.from(computedHash, 'hex')

    if (hashBuffer.length !== computedBuffer.length) {
      return { valid: false, error: 'Invalid hash length' }
    }

    if (!crypto.timingSafeEqual(hashBuffer, computedBuffer)) {
      return { valid: false, error: 'Invalid hash (signature mismatch)' }
    }

    // Check auth_date expiry (24 hours)
    const authDate = parseInt(params.get('auth_date') || '0', 10)
    const now = Math.floor(Date.now() / 1000)
    const maxAge = 86400 // 24 hours

    if (now - authDate > maxAge) {
      return { valid: false, error: 'initData expired (older than 24 hours)' }
    }

    // Parse user data
    const userJson = params.get('user')
    if (!userJson) {
      return { valid: false, error: 'No user data in initData' }
    }

    const user = JSON.parse(userJson)

    if (!user.id || typeof user.id !== 'number') {
      return { valid: false, error: 'Invalid user ID' }
    }

    return {
      valid: true,
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
      authDate
    }
  } catch (error) {
    console.error('[TelegramValidation] Error:', error)
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation error'
    }
  }
}

/**
 * Validates authentication from request (strict mode - no silent fallback)
 *
 * Priority:
 * 1. If x-telegram-init-data header present -> MUST validate, fail if invalid
 * 2. If no Telegram context -> use deviceId from header/body
 * 3. If neither -> return unauthorized
 *
 * @param request - NextRequest object
 * @param body - Parsed request body (optional)
 * @returns StrictAuthResult with authentication status
 */
export function validateStrictAuth(
  request: Request,
  body?: Record<string, unknown>
): StrictAuthResult {
  // Check for Telegram initData in header (preferred) or body
  const initData =
    request.headers.get('x-telegram-init-data') ||
    (body?.telegramInitData as string | undefined)

  if (initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      console.error('[StrictAuth] TELEGRAM_BOT_TOKEN not configured')
      return {
        authenticated: false,
        authMethod: 'none',
        error: 'Server misconfiguration: bot token not set'
      }
    }

    const validation = validateTelegramInitData(initData, botToken)

    if (!validation.valid || !validation.userId) {
      console.warn('[StrictAuth] Invalid Telegram initData:', validation.error)
      return {
        authenticated: false,
        authMethod: 'none',
        error: validation.error || 'Invalid Telegram authentication'
      }
    }

    // Successfully validated Telegram user
    return {
      authenticated: true,
      telegramUserId: validation.userId,
      deviceId: `tg_${validation.userId}`, // Synthetic deviceId for compatibility
      authMethod: 'telegram'
    }
  }

  // No Telegram context - check for deviceId
  const deviceId =
    request.headers.get('x-device-id') ||
    (body?.deviceId as string | undefined)

  if (deviceId && typeof deviceId === 'string' && deviceId.trim().length > 0) {
    // Don't allow tg_ prefixed deviceIds without Telegram validation
    if (deviceId.startsWith('tg_')) {
      return {
        authenticated: false,
        authMethod: 'none',
        error: 'Telegram device IDs require initData validation'
      }
    }

    // Validate deviceId length
    if (deviceId.length > 255) {
      return {
        authenticated: false,
        authMethod: 'none',
        error: 'Device ID too long'
      }
    }

    return {
      authenticated: true,
      deviceId: deviceId.trim(),
      authMethod: 'device'
    }
  }

  return {
    authenticated: false,
    authMethod: 'none',
    error: 'No valid authentication provided'
  }
}

/**
 * Extracts Telegram user ID from already-validated request
 * Use this only AFTER validateStrictAuth has succeeded
 */
export function getTelegramUserIdFromRequest(request: Request): number | undefined {
  const initData = request.headers.get('x-telegram-init-data')
  if (!initData) return undefined

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return undefined

  const result = validateTelegramInitData(initData, botToken)
  return result.valid ? result.userId : undefined
}
