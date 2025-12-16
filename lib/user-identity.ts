// User Identity Helper - Telegram-only authentication
import { sql, type User } from "./db"

export interface UserIdentifier {
  type: "telegram"
  telegramUserId: number
}

/**
 * Find or create user by telegram_user_id (primary identifier)
 *
 * For Telegram users:
 * - Primary lookup by telegram_user_id (enables cross-device sync)
 * - Updates device_id if changed (user on new device)
 */
export async function findOrCreateUser(params: {
  telegramUserId?: number
  deviceId?: string
  email?: string  // for 54-FZ compliance
}): Promise<User> {
  const { telegramUserId, deviceId, email } = params

  // Require Telegram user ID
  if (!telegramUserId) {
    throw new Error("telegramUserId is required")
  }

  // NaN validation for telegram_user_id
  const tgId = typeof telegramUserId === 'number' ? telegramUserId : parseInt(String(telegramUserId))
  if (isNaN(tgId)) {
    throw new Error("Invalid telegram_user_id format: must be a valid number")
  }

  // Uses ATOMIC INSERT ON CONFLICT to prevent race conditions
  const result = await sql`
    INSERT INTO users (telegram_user_id, device_id, email)
    VALUES (
      ${tgId},
      ${deviceId || `tg_${tgId}`},
      ${email || null}
    )
    ON CONFLICT (telegram_user_id) DO UPDATE SET
      device_id = COALESCE(EXCLUDED.device_id, users.device_id),
      email = COALESCE(EXCLUDED.email, users.email),
      updated_at = NOW()
    RETURNING *
  `

  if (result.length > 0) {
    console.log(`[UserIdentity] Telegram user upserted: telegram_user_id=${tgId}`)
    return result[0] as User
  }

  throw new Error(`Failed to upsert Telegram user: ${tgId}`)
}

/**
 * Build query params for API calls based on user identifier
 */
export function buildIdentifierParams(identifier: UserIdentifier): URLSearchParams {
  const params = new URLSearchParams()
  params.set("telegram_user_id", String(identifier.telegramUserId))
  return params
}

/**
 * Extract user identifier from request (query params or body)
 * Returns validated telegramUserId with NaN check
 */
export function extractIdentifierFromRequest(data: {
  telegram_user_id?: string | number | null
  telegramUserId?: number | null
  device_id?: string | null
  deviceId?: string | null
}): { telegramUserId?: number; deviceId?: string } {
  let telegramUserId: number | undefined = undefined

  // Parse and validate telegram_user_id with NaN check
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

  const deviceId = data.device_id || data.deviceId || undefined

  return {
    telegramUserId,
    deviceId: deviceId || undefined,
  }
}
