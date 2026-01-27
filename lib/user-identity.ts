// User Identity Helper - Supports both Telegram and Web (Neon Auth) users
import { sql, type User } from "./db"

export interface UserIdentifier {
  type: "telegram" | "web"
  telegramUserId?: number    // For Telegram users
  neonUserId?: string        // For Web users (Neon Auth UUID) - stored as neon_auth_id in DB
  visibleUserId: number      // Unified numeric ID for API compatibility
}

/**
 * Find or create user by telegram_user_id OR neon_user_id
 *
 * Supports:
 * 1. Telegram Mini App users - identified by telegram_user_id
 * 2. Web users - identified by neon_user_id (UUID from Neon Auth)
 */
export async function findOrCreateUser(params: {
  telegramUserId?: number
  telegramUsername?: string | null
  neonUserId?: string
  email?: string | null
  referralCode?: string
}): Promise<User> {
  const { telegramUserId, telegramUsername, neonUserId, email, referralCode } = params

  // Normalize referral code (uppercase, trimmed)
  const normalizedCode = referralCode?.toUpperCase().trim() || null

  // CASE 1: Telegram user
  if (telegramUserId) {
    const tgId = typeof telegramUserId === 'number'
      ? telegramUserId
      : parseInt(String(telegramUserId))

    if (isNaN(tgId)) {
      throw new Error("Invalid telegram_user_id format: must be a valid number")
    }

    // Normalize username (remove @ if present, trim)
    const normalizedUsername = telegramUsername?.replace(/^@/, '').trim() || null

    const result = await sql`
      INSERT INTO users (telegram_user_id, telegram_username, pending_referral_code)
      VALUES (${tgId}, ${normalizedUsername}, ${normalizedCode})
      ON CONFLICT (telegram_user_id) DO UPDATE SET
        updated_at = NOW(),
        telegram_username = COALESCE(${normalizedUsername}, users.telegram_username),
        pending_referral_code = COALESCE(users.pending_referral_code, ${normalizedCode})
      RETURNING *
    `

    if (result.length > 0) {
      return result[0] as User
    }

    throw new Error(`Failed to upsert Telegram user: ${tgId}`)
  }

  // CASE 2: Web user (Neon Auth)
  if (neonUserId) {
    const normalizedEmail = email?.toLowerCase().trim() || null

    const result = await sql`
      INSERT INTO users (neon_auth_id, email, auth_provider, pending_referral_code)
      VALUES (${neonUserId}, ${normalizedEmail}, 'google', ${normalizedCode})
      ON CONFLICT (neon_auth_id) DO UPDATE SET
        updated_at = NOW(),
        email = COALESCE(${normalizedEmail}, users.email),
        pending_referral_code = COALESCE(users.pending_referral_code, ${normalizedCode})
      RETURNING *
    `

    if (result.length > 0) {
      return result[0] as User
    }

    throw new Error(`Failed to upsert Web user: ${neonUserId}`)
  }

  throw new Error("Either telegramUserId or neonUserId is required")
}

/**
 * Build query params for API calls
 */
export function buildIdentifierParams(identifier: UserIdentifier): URLSearchParams {
  const params = new URLSearchParams()

  if (identifier.type === "telegram" && identifier.telegramUserId) {
    params.set("telegram_user_id", String(identifier.telegramUserId))
  } else if (identifier.type === "web" && identifier.neonUserId) {
    params.set("neon_user_id", identifier.neonUserId)
  }

  // Always include visibleUserId as fallback
  params.set("user_id", String(identifier.visibleUserId))

  return params
}

/**
 * Extract user identifier from request (query params or body)
 * Supports both Telegram and Web users
 */
export function extractIdentifierFromRequest(data: {
  telegram_user_id?: string | number | null
  telegramUserId?: number | null
  neon_user_id?: string | null
  neon_auth_id?: string | null
  neonUserId?: string | null
  user_id?: string | number | null
  userId?: number | null
}): { telegramUserId?: number; neonUserId?: string } {
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

  // Parse neon_user_id / neon_auth_id (both refer to the same thing)
  let neonUserId: string | undefined

  if (data.neon_user_id && typeof data.neon_user_id === 'string') {
    neonUserId = data.neon_user_id
  } else if (data.neon_auth_id && typeof data.neon_auth_id === 'string') {
    neonUserId = data.neon_auth_id
  } else if (data.neonUserId && typeof data.neonUserId === 'string') {
    neonUserId = data.neonUserId
  }

  // Require at least one identifier
  if (!telegramUserId && !neonUserId) {
    throw new Error("Either telegram_user_id or neon_user_id is required")
  }

  return { telegramUserId, neonUserId }
}

/**
 * Find user by either telegram_user_id or neon_user_id
 */
export async function findUserByIdentifier(params: {
  telegramUserId?: number
  neonUserId?: string
}): Promise<User | null> {
  const { telegramUserId, neonUserId } = params

  if (telegramUserId) {
    const result = await sql`
      SELECT * FROM users WHERE telegram_user_id = ${telegramUserId} LIMIT 1
    `
    return result.length > 0 ? result[0] as User : null
  }

  if (neonUserId) {
    const result = await sql`
      SELECT * FROM users WHERE neon_auth_id = ${neonUserId} LIMIT 1
    `
    return result.length > 0 ? result[0] as User : null
  }

  return null
}
