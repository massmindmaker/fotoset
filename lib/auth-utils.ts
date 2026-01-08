import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"

// ============================================================================
// Types
// ============================================================================

export type ResourceType = "avatar" | "job" | "reference"

export interface OwnershipResult {
  authorized: boolean
  userId?: number
  resourceExists: boolean
}

/**
 * User identifier - supports both Telegram and Web (Neon Auth) users
 */
export interface UserIdentifier {
  telegramUserId?: number
  neonUserId?: string  // Stored as neon_auth_id in DB
}

// ============================================================================
// User Identifier Extraction
// ============================================================================

/**
 * Extract user identifier from request
 * Supports both Telegram users and Web users (Neon Auth)
 * Includes NaN validation for telegram_user_id
 */
export function getUserIdentifier(request: NextRequest, body?: any): UserIdentifier {
  // === Telegram User ID ===
  // Check header first (most secure)
  const headerTelegramId = request.headers.get("x-telegram-user-id")
  // Check query parameters
  const queryTelegramId = request.nextUrl.searchParams.get("telegram_user_id")
  // Check request body
  const bodyTelegramId = body?.telegramUserId

  let telegramUserId: number | undefined = undefined

  // Parse with NaN validation
  if (headerTelegramId) {
    const tgId = parseInt(headerTelegramId)
    if (!isNaN(tgId)) {
      telegramUserId = tgId
    }
  } else if (queryTelegramId) {
    const tgId = parseInt(queryTelegramId)
    if (!isNaN(tgId)) {
      telegramUserId = tgId
    }
  } else if (bodyTelegramId) {
    const tgId = typeof bodyTelegramId === 'number'
      ? bodyTelegramId
      : parseInt(String(bodyTelegramId))
    if (!isNaN(tgId)) {
      telegramUserId = tgId
    }
  }

  // === Neon User ID (Web users) ===
  // Check header first
  const headerNeonId = request.headers.get("x-neon-user-id")
  // Check query parameters
  const queryNeonId = request.nextUrl.searchParams.get("neon_user_id")
  // Check request body
  const bodyNeonId = body?.neonUserId

  let neonUserId: string | undefined = undefined

  // Neon ID is a UUID string, validate it's not empty
  if (headerNeonId && headerNeonId.trim()) {
    neonUserId = headerNeonId.trim()
  } else if (queryNeonId && queryNeonId.trim()) {
    neonUserId = queryNeonId.trim()
  } else if (bodyNeonId && typeof bodyNeonId === 'string' && bodyNeonId.trim()) {
    neonUserId = bodyNeonId.trim()
  }

  return {
    telegramUserId,
    neonUserId,
  }
}

// ============================================================================
// Resource Ownership Verification
// ============================================================================

/**
 * Verify that a user identifier owns a specific resource
 * Supports both Telegram and Web (Neon Auth) users
 *
 * @param identifier - User's identifier (telegram_user_id or neon_user_id)
 * @param resourceType - Type of resource (avatar, job, reference)
 * @param resourceId - ID of the resource to check
 * @returns Ownership verification result
 *
 * @example
 * const identifier = getUserIdentifier(request)
 * const result = await verifyResourceOwnershipWithIdentifier(identifier, 'avatar', avatarId)
 * if (!result.authorized) {
 *   return error("FORBIDDEN", "Access denied")
 * }
 */
export async function verifyResourceOwnershipWithIdentifier(
  identifier: UserIdentifier,
  resourceType: ResourceType,
  resourceId: number
): Promise<OwnershipResult> {
  // Must have at least one identifier
  if (!identifier.telegramUserId && !identifier.neonUserId) {
    return { authorized: false, resourceExists: false }
  }

  // NaN validation for Telegram ID
  if (identifier.telegramUserId && isNaN(identifier.telegramUserId)) {
    return { authorized: false, resourceExists: false }
  }

  try {
    let result: OwnershipResult

    switch (resourceType) {
      case "avatar":
        result = await verifyAvatarOwnershipWithIdentifier(identifier, resourceId)
        break

      case "job":
        result = await verifyJobOwnershipWithIdentifier(identifier, resourceId)
        break

      case "reference":
        result = await verifyReferenceOwnershipWithIdentifier(identifier, resourceId)
        break

      default:
        return { authorized: false, resourceExists: false }
    }

    return result
  } catch (error) {
    console.error(`[auth-utils] Failed to verify ${resourceType} ownership:`, error)
    return { authorized: false, resourceExists: false }
  }
}

// ============================================================================
// Resource-Specific Verification with Telegram and Web Support
// ============================================================================

/**
 * Verify avatar ownership with Telegram or Web (Neon Auth)
 */
async function verifyAvatarOwnershipWithIdentifier(
  identifier: UserIdentifier,
  avatarId: number
): Promise<OwnershipResult> {
  const rows = await sql`
    SELECT a.id, a.user_id, u.telegram_user_id, u.neon_auth_id
    FROM avatars a
    JOIN users u ON u.id = a.user_id
    WHERE a.id = ${avatarId}
  `

  if (rows.length === 0) {
    return { authorized: false, resourceExists: false }
  }

  const avatar = rows[0]

  // Check authorization via Telegram OR Neon Auth
  let authorized = false
  if (identifier.telegramUserId && avatar.telegram_user_id) {
    authorized = Number(avatar.telegram_user_id) === identifier.telegramUserId
  } else if (identifier.neonUserId && avatar.neon_auth_id) {
    authorized = avatar.neon_auth_id === identifier.neonUserId
  }

  return {
    authorized,
    userId: avatar.user_id,
    resourceExists: true,
  }
}

/**
 * Verify generation job ownership with Telegram or Web (Neon Auth)
 */
async function verifyJobOwnershipWithIdentifier(
  identifier: UserIdentifier,
  jobId: number
): Promise<OwnershipResult> {
  const rows = await sql`
    SELECT j.id, j.avatar_id, a.user_id, u.telegram_user_id, u.neon_auth_id
    FROM generation_jobs j
    JOIN avatars a ON a.id = j.avatar_id
    JOIN users u ON u.id = a.user_id
    WHERE j.id = ${jobId}
  `

  if (rows.length === 0) {
    return { authorized: false, resourceExists: false }
  }

  const job = rows[0]

  // Check authorization via Telegram OR Neon Auth
  let authorized = false
  if (identifier.telegramUserId && job.telegram_user_id) {
    authorized = Number(job.telegram_user_id) === identifier.telegramUserId
  } else if (identifier.neonUserId && job.neon_auth_id) {
    authorized = job.neon_auth_id === identifier.neonUserId
  }

  return {
    authorized,
    userId: job.user_id,
    resourceExists: true,
  }
}

/**
 * Verify reference photo ownership with Telegram or Web (Neon Auth)
 */
async function verifyReferenceOwnershipWithIdentifier(
  identifier: UserIdentifier,
  referenceId: number
): Promise<OwnershipResult> {
  const rows = await sql`
    SELECT r.id, r.avatar_id, a.user_id, u.telegram_user_id, u.neon_auth_id
    FROM reference_photos r
    JOIN avatars a ON a.id = r.avatar_id
    JOIN users u ON u.id = a.user_id
    WHERE r.id = ${referenceId}
  `

  if (rows.length === 0) {
    return { authorized: false, resourceExists: false }
  }

  const reference = rows[0]

  // Check authorization via Telegram OR Neon Auth
  let authorized = false
  if (identifier.telegramUserId && reference.telegram_user_id) {
    authorized = Number(reference.telegram_user_id) === identifier.telegramUserId
  } else if (identifier.neonUserId && reference.neon_auth_id) {
    authorized = reference.neon_auth_id === identifier.neonUserId
  }

  return {
    authorized,
    userId: reference.user_id,
    resourceExists: true,
  }
}
