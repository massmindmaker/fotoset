// User Identity Helper - Telegram-only authentication
import { sql, type User } from "./db"

export interface UserIdentifier {
  type: "telegram"
  telegramUserId: number
}

/**
 * Find or create user by telegram_user_id (ONLY identifier)
 *
 * Telegram Mini App authentication:
 * - Primary and ONLY lookup by telegram_user_id
 * - Cross-device sync automatically works
 * - No fallback to device_id (removed)
 */
export async function findOrCreateUser(params: {
  telegramUserId: number
  referralCode?: string
}): Promise<User> {
  const { telegramUserId, referralCode } = params

  // Validate telegram_user_id
  const tgId = typeof telegramUserId === 'number'
    ? telegramUserId
    : parseInt(String(telegramUserId))

  if (isNaN(tgId)) {
    throw new Error("Invalid telegram_user_id format: must be a valid number")
  }

  // Normalize referral code (uppercase, trimmed)
  const normalizedCode = referralCode?.toUpperCase().trim() || null

  // Find or create user (atomic)
  // CRITICAL: Save referral code on FIRST login - this survives T-Bank redirect
  const result = await sql`
    INSERT INTO users (telegram_user_id, pending_referral_code)
    VALUES (${tgId}, ${normalizedCode})
    ON CONFLICT (telegram_user_id) DO UPDATE SET
      updated_at = NOW(),
      pending_referral_code = COALESCE(users.pending_referral_code, ${normalizedCode})
    RETURNING *
  `

  if (result.length > 0) {
    return result[0] as User
  }

  throw new Error(`Failed to upsert Telegram user: ${tgId}`)
}

/**
 * Build query params for API calls
 */
export function buildIdentifierParams(identifier: UserIdentifier): URLSearchParams {
  const params = new URLSearchParams()
  params.set("telegram_user_id", String(identifier.telegramUserId))
  return params
}

/**
 * Extract user identifier from request (query params or body)
 * Returns validated telegramUserId
 */
export function extractIdentifierFromRequest(data: {
  telegram_user_id?: string | number | null
  telegramUserId?: number | null
}): { telegramUserId: number } {
  // Parse telegram_user_id
  let telegramUserId: number | undefined

  if (data.telegram_user_id) {
    const tgId = typeof data.telegram_user_id === 'string'
      ? parseInt(data.telegram_user_id)
      : data.telegram_user_id
    if (!isNaN(tgId)) {
      telegramUserId = tgId
    }
  } else if (data.telegramUserId) {
    const tgId = typeof data.telegramUserId === 'number'
      ? data.telegramUserId
      : parseInt(String(data.telegramUserId))
    if (!isNaN(tgId)) {
      telegramUserId = tgId
    }
  }

  if (!telegramUserId) {
    throw new Error("telegram_user_id is required")
  }

  return { telegramUserId }
}
