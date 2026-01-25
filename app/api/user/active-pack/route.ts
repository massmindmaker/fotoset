import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { success, error, createLogger } from "@/lib/api-utils"
import { getAuthenticatedUser } from "@/lib/auth-middleware"

export const runtime = 'edge'

const logger = createLogger("UserActivePack")

/**
 * POST /api/user/active-pack
 *
 * Set the user's active pack for generation
 *
 * Request body:
 * - packId: number (optional) - Pack ID to set as active
 * - packSlug: string (optional) - Pack slug to set as active
 *
 * Requirements:
 * - User must be authenticated
 * - Pack must exist, be active, and approved
 * - One of packId or packSlug must be provided
 *
 * Response:
 * - success: boolean
 * - activePackId: number
 * - packName: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { packId, packSlug } = body as {
      packId?: number
      packSlug?: string
    }

    // Validate input: at least one identifier required
    if (!packId && !packSlug) {
      return error("VALIDATION_ERROR", "Either packId or packSlug must be provided")
    }

    // Authenticate user
    const authUser = await getAuthenticatedUser(request, body)
    if (!authUser) {
      return error("UNAUTHORIZED", "Authentication required")
    }

    const { user } = authUser
    logger.info("Setting active pack", {
      userId: user.id,
      packId,
      packSlug,
    })

    // Find and validate pack
    let packResult
    if (packId) {
      packResult = await sql`
        SELECT id, slug, name, icon_emoji, is_active, moderation_status
        FROM photo_packs
        WHERE id = ${packId}
      `
    } else {
      packResult = await sql`
        SELECT id, slug, name, icon_emoji, is_active, moderation_status
        FROM photo_packs
        WHERE slug = ${packSlug}
      `
    }

    if (packResult.length === 0) {
      logger.warn("Pack not found", { packId, packSlug })
      return error("NOT_FOUND", "Pack not found")
    }

    const pack = packResult[0]

    // Validate pack is active and approved
    if (!pack.is_active) {
      logger.warn("Pack is not active", { packId: pack.id })
      return error("BAD_REQUEST", "This pack is not currently available")
    }

    if (pack.moderation_status !== "approved") {
      logger.warn("Pack is not approved", {
        packId: pack.id,
        status: pack.moderation_status,
      })
      return error("BAD_REQUEST", "This pack is not approved for use")
    }

    // Update user's active pack
    await sql`
      UPDATE users
      SET active_pack_id = ${pack.id}
      WHERE id = ${user.id}
    `

    logger.info("Active pack updated", {
      userId: user.id,
      packId: pack.id,
      packName: pack.name,
    })

    return success({
      activePackId: pack.id,
      packName: pack.name,
      packSlug: pack.slug,
      iconEmoji: pack.icon_emoji,
    })
  } catch (err) {
    logger.error("Error setting active pack", { error: err })
    return error("INTERNAL_ERROR", "Failed to set active pack")
  }
}

/**
 * GET /api/user/active-pack
 *
 * Get the user's currently active pack
 *
 * Requirements:
 * - User must be authenticated
 *
 * Response:
 * - success: boolean
 * - activePack: { id, slug, name, iconEmoji } | null
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authUser = await getAuthenticatedUser(request)
    if (!authUser) {
      return error("UNAUTHORIZED", "Authentication required")
    }

    const { user } = authUser
    logger.info("Getting active pack", { userId: user.id })

    // Get user's active pack
    if (!user.active_pack_id) {
      logger.info("No active pack set", { userId: user.id })
      return success({ activePack: null })
    }

    // Fetch pack details
    const packResult = await sql`
      SELECT id, slug, name, icon_emoji, is_active, moderation_status
      FROM photo_packs
      WHERE id = ${user.active_pack_id}
    `

    if (packResult.length === 0) {
      logger.warn("Active pack not found", {
        userId: user.id,
        activePackId: user.active_pack_id,
      })
      // Clear invalid active_pack_id
      await sql`
        UPDATE users
        SET active_pack_id = NULL
        WHERE id = ${user.id}
      `
      return success({ activePack: null })
    }

    const pack = packResult[0]

    // Check if pack is still active and approved
    if (!pack.is_active || pack.moderation_status !== "approved") {
      logger.warn("Active pack is no longer available", {
        userId: user.id,
        packId: pack.id,
        isActive: pack.is_active,
        status: pack.moderation_status,
      })
      // Clear unavailable active_pack_id
      await sql`
        UPDATE users
        SET active_pack_id = NULL
        WHERE id = ${user.id}
      `
      return success({ activePack: null })
    }

    return success({
      activePack: {
        id: pack.id,
        slug: pack.slug,
        name: pack.name,
        iconEmoji: pack.icon_emoji,
      },
    })
  } catch (err) {
    logger.error("Error getting active pack", { error: err })
    return error("INTERNAL_ERROR", "Failed to get active pack")
  }
}
