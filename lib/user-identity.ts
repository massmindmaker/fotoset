// User Identity Helper - Dual identity support (Telegram + Device)
import { sql, type User } from "./db"

export interface UserIdentifier {
  type: "telegram" | "device"
  telegramUserId?: number
  deviceId: string
}

/**
 * Find or create user with priority: telegram_user_id > device_id
 *
 * For Telegram users:
 * - Primary lookup by telegram_user_id (enables cross-device sync)
 * - Updates device_id if changed (user on new device)
 *
 * For Web users:
 * - Fallback to device_id (localStorage UUID)
 */
export async function findOrCreateUser(params: {
  telegramUserId?: number
  deviceId?: string
}): Promise<User> {
  const { telegramUserId, deviceId } = params

  // Priority 1: Telegram user ID (permanent identifier)
  if (telegramUserId) {
    const existingUsers = await sql`
      SELECT * FROM users WHERE telegram_user_id = ${telegramUserId}
    `

    if (existingUsers.length > 0) {
      const user = existingUsers[0] as User

      // Update device_id if changed (new device)
      if (deviceId && user.device_id !== deviceId) {
        await sql`
          UPDATE users SET device_id = ${deviceId}, updated_at = NOW()
          WHERE telegram_user_id = ${telegramUserId}
        `
        user.device_id = deviceId
      }
      return user
    }

    // Check if there's an existing user with tg_ device_id (migration case)
    const legacyDeviceId = `tg_${telegramUserId}`
    const legacyUsers = await sql`
      SELECT * FROM users WHERE device_id = ${legacyDeviceId}
    `

    if (legacyUsers.length > 0) {
      // Migrate: add telegram_user_id to existing user
      await sql`
        UPDATE users
        SET telegram_user_id = ${telegramUserId}, updated_at = NOW()
        WHERE device_id = ${legacyDeviceId}
      `
      const migratedUser = legacyUsers[0] as User
      migratedUser.telegram_user_id = telegramUserId
      console.log(`[UserIdentity] Migrated legacy user ${legacyDeviceId} to telegram_user_id ${telegramUserId}`)
      return migratedUser
    }

    // Create new user with telegram_user_id
    const newUsers = await sql`
      INSERT INTO users (telegram_user_id, device_id)
      VALUES (${telegramUserId}, ${deviceId || legacyDeviceId})
      RETURNING *
    `
    console.log(`[UserIdentity] Created new Telegram user: telegram_user_id=${telegramUserId}`)
    return newUsers[0] as User
  }

  // Priority 2: Device ID (fallback for web users)
  if (deviceId) {
    const existingUsers = await sql`
      SELECT * FROM users WHERE device_id = ${deviceId}
    `

    if (existingUsers.length > 0) {
      return existingUsers[0] as User
    }

    // Create new web user
    const newUsers = await sql`
      INSERT INTO users (device_id)
      VALUES (${deviceId})
      RETURNING *
    `
    console.log(`[UserIdentity] Created new web user: device_id=${deviceId}`)
    return newUsers[0] as User
  }

  throw new Error("Either telegramUserId or deviceId is required")
}

/**
 * Build query params for API calls based on user identifier
 */
export function buildIdentifierParams(identifier: UserIdentifier): URLSearchParams {
  const params = new URLSearchParams()

  if (identifier.telegramUserId) {
    params.set("telegram_user_id", String(identifier.telegramUserId))
  }
  if (identifier.deviceId) {
    params.set("device_id", identifier.deviceId)
  }

  return params
}

/**
 * Extract user identifier from request (query params or body)
 */
export function extractIdentifierFromRequest(data: {
  telegram_user_id?: string | number | null
  telegramUserId?: number | null
  device_id?: string | null
  deviceId?: string | null
}): { telegramUserId?: number; deviceId?: string } {
  const telegramUserId = data.telegram_user_id
    ? (typeof data.telegram_user_id === 'string' ? parseInt(data.telegram_user_id) : data.telegram_user_id)
    : data.telegramUserId || undefined

  const deviceId = data.device_id || data.deviceId || undefined

  return {
    telegramUserId: telegramUserId || undefined,
    deviceId: deviceId || undefined,
  }
}
