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
 * User identifier - Telegram only
 */
export interface UserIdentifier {
  telegramUserId?: number
}

// ============================================================================
// User Identifier Extraction
// ============================================================================

/**
 * Extract user identifier from request (Telegram only)
 * Includes NaN validation for telegram_user_id
 */
export function getUserIdentifier(request: NextRequest, body?: any): UserIdentifier {
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

  return {
    telegramUserId,
  }
}

// ============================================================================
// Resource Ownership Verification
// ============================================================================

/**
 * Verify that a user identifier owns a specific resource
 * Telegram-only authentication
 *
 * @param identifier - User's identifier (telegram_user_id)
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
  if (!identifier.telegramUserId) {
    return { authorized: false, resourceExists: false }
  }

  // NaN validation
  if (isNaN(identifier.telegramUserId)) {
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
// Resource-Specific Verification with Telegram Support
// ============================================================================

/**
 * Verify avatar ownership with Telegram
 */
async function verifyAvatarOwnershipWithIdentifier(
  identifier: UserIdentifier,
  avatarId: number
): Promise<OwnershipResult> {
  const rows = await sql`
    SELECT a.id, a.user_id, u.telegram_user_id
    FROM avatars a
    JOIN users u ON u.id = a.user_id
    WHERE a.id = ${avatarId}
  `

  if (rows.length === 0) {
    return { authorized: false, resourceExists: false }
  }

  const avatar = rows[0]
  const authorized = identifier.telegramUserId
    ? Number(avatar.telegram_user_id) === identifier.telegramUserId
    : false

  return {
    authorized,
    userId: avatar.user_id,
    resourceExists: true,
  }
}

/**
 * Verify generation job ownership with Telegram
 */
async function verifyJobOwnershipWithIdentifier(
  identifier: UserIdentifier,
  jobId: number
): Promise<OwnershipResult> {
  const rows = await sql`
    SELECT j.id, j.avatar_id, a.user_id, u.telegram_user_id
    FROM generation_jobs j
    JOIN avatars a ON a.id = j.avatar_id
    JOIN users u ON u.id = a.user_id
    WHERE j.id = ${jobId}
  `

  if (rows.length === 0) {
    return { authorized: false, resourceExists: false }
  }

  const job = rows[0]
  const authorized = identifier.telegramUserId
    ? Number(job.telegram_user_id) === identifier.telegramUserId
    : false

  return {
    authorized,
    userId: job.user_id,
    resourceExists: true,
  }
}

/**
 * Verify reference photo ownership with Telegram
 */
async function verifyReferenceOwnershipWithIdentifier(
  identifier: UserIdentifier,
  referenceId: number
): Promise<OwnershipResult> {
  const rows = await sql`
    SELECT r.id, r.avatar_id, a.user_id, u.telegram_user_id
    FROM reference_photos r
    JOIN avatars a ON a.id = r.avatar_id
    JOIN users u ON u.id = a.user_id
    WHERE r.id = ${referenceId}
  `

  if (rows.length === 0) {
    return { authorized: false, resourceExists: false }
  }

  const reference = rows[0]
  const authorized = identifier.telegramUserId
    ? Number(reference.telegram_user_id) === identifier.telegramUserId
    : false

  return {
    authorized,
    userId: reference.user_id,
    resourceExists: true,
  }
}
