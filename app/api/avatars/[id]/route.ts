import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import {
  success,
  error,
  validateRequired,
  createLogger,
} from "@/lib/api-utils"
import {
  getUserIdentifier,
  verifyResourceOwnershipWithIdentifier,
  type UserIdentifier,
} from "@/lib/auth-utils"

const logger = createLogger("Avatars/[id]")

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

interface AvatarDetail {
  id: number
  name: string
  status: "draft" | "processing" | "ready"
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
  photos: {
    id: number
    styleId: string
    prompt: string
    imageUrl: string
    createdAt: string
  }[]
  generationJob?: {
    id: number
    status: string
    completedPhotos: number
    totalPhotos: number
    errorMessage: string | null
  }
}

interface UpdateAvatarRequest {
  name?: string
  status?: "draft" | "processing" | "ready"
  thumbnailUrl?: string
}

// ============================================================================
// Helper: Verify avatar ownership (Telegram-only authentication)
// ============================================================================

async function verifyAvatarOwnershipWithData(
  identifier: UserIdentifier,
  avatarId: number
): Promise<{ avatar: any; authorized: boolean }> {
  // Get avatar with owner info
  const avatar = await sql`
    SELECT a.*, u.telegram_user_id as owner_telegram_id
    FROM avatars a
    JOIN users u ON u.id = a.user_id
    WHERE a.id = ${avatarId}
  `.then((rows) => rows[0])

  if (!avatar) {
    return { avatar: null, authorized: false }
  }

  // Telegram-only authentication (convert bigint to Number for comparison)
  const authorized = identifier.telegramUserId
    ? Number(avatar.owner_telegram_id) === identifier.telegramUserId
    : false

  return { avatar, authorized }
}

// ============================================================================
// GET /api/avatars/:id - Get single avatar with photos
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId) || avatarId <= 0) {
    return error("VALIDATION_ERROR", "Invalid avatar ID")
  }

  // IDOR Protection: Get identifier for authorization (Telegram-only authentication)
  const identifier = getUserIdentifier(request)
  if (!identifier.telegramUserId) {
    return error("UNAUTHORIZED", "telegram_user_id is required")
  }

  try {
    // Verify ownership
    const { avatar, authorized } = await verifyAvatarOwnershipWithData(identifier, avatarId)

    if (!avatar) {
      return error("AVATAR_NOT_FOUND", `Avatar with ID ${avatarId} not found`)
    }

    if (!authorized) {
      logger.warn("Unauthorized avatar access attempt", { avatarId, identifier })
      return error("FORBIDDEN", "You don't have access to this avatar")
    }

    // Get photos
    const photos = await sql`
      SELECT id, style_id, prompt, image_url, created_at
      FROM generated_photos
      WHERE avatar_id = ${avatarId}
      ORDER BY created_at DESC
    `

    // Get latest generation job status
    const latestJob = await sql`
      SELECT id, status, completed_photos, total_photos, error_message
      FROM generation_jobs
      WHERE avatar_id = ${avatarId}
      ORDER BY created_at DESC
      LIMIT 1
    `.then((rows) => rows[0])

    const response: AvatarDetail = {
      id: avatar.id,
      name: avatar.name,
      status: avatar.status,
      thumbnailUrl: avatar.thumbnail_url,
      createdAt: avatar.created_at,
      updatedAt: avatar.updated_at,
      photos: photos.map((row: any) => ({
        id: row.id,
        styleId: row.style_id,
        prompt: row.prompt,
        imageUrl: row.image_url,
        createdAt: row.created_at,
      })),
    }

    if (latestJob) {
      response.generationJob = {
        id: latestJob.id,
        status: latestJob.status,
        completedPhotos: latestJob.completed_photos,
        totalPhotos: latestJob.total_photos,
        errorMessage: latestJob.error_message,
      }
    }

    logger.info("Avatar fetched", { avatarId, photoCount: photos.length })
    return success(response)
  } catch (err) {
    logger.error("Failed to fetch avatar", {
      error: err instanceof Error ? err.message : "Unknown error",
      avatarId,
    })
    return error("DATABASE_ERROR", "Failed to fetch avatar")
  }
}

// ============================================================================
// PATCH /api/avatars/:id - Update avatar
// ============================================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId) || avatarId <= 0) {
    return error("VALIDATION_ERROR", "Invalid avatar ID")
  }

  try {
    const body = await request.json()
    const { name, status, thumbnailUrl } = body as UpdateAvatarRequest

    // IDOR Protection: Get identifier for authorization (Telegram-only authentication)
    const identifier = getUserIdentifier(request, body)
    if (!identifier.telegramUserId) {
      return error("UNAUTHORIZED", "telegram_user_id is required")
    }

    // Verify ownership
    const { avatar: existing, authorized } = await verifyAvatarOwnershipWithData(identifier, avatarId)

    if (!existing) {
      return error("AVATAR_NOT_FOUND", `Avatar with ID ${avatarId} not found`)
    }

    if (!authorized) {
      logger.warn("Unauthorized avatar update attempt", { avatarId, identifier })
      return error("FORBIDDEN", "You don't have access to this avatar")
    }

    // Validate status if provided
    if (status && !["draft", "processing", "ready"].includes(status)) {
      return error("VALIDATION_ERROR", "Invalid status. Must be: draft, processing, or ready")
    }

    let updated: any = null

    if (name !== undefined && status !== undefined && thumbnailUrl !== undefined) {
      updated = await sql`
        UPDATE avatars
        SET name = ${name}, status = ${status}, thumbnail_url = ${thumbnailUrl}, updated_at = NOW()
        WHERE id = ${avatarId}
        RETURNING id, name, status, thumbnail_url, created_at, updated_at
      `.then((rows) => rows[0])
    } else if (name !== undefined && status !== undefined) {
      updated = await sql`
        UPDATE avatars
        SET name = ${name}, status = ${status}, updated_at = NOW()
        WHERE id = ${avatarId}
        RETURNING id, name, status, thumbnail_url, created_at, updated_at
      `.then((rows) => rows[0])
    } else if (name !== undefined && thumbnailUrl !== undefined) {
      updated = await sql`
        UPDATE avatars
        SET name = ${name}, thumbnail_url = ${thumbnailUrl}, updated_at = NOW()
        WHERE id = ${avatarId}
        RETURNING id, name, status, thumbnail_url, created_at, updated_at
      `.then((rows) => rows[0])
    } else if (status !== undefined && thumbnailUrl !== undefined) {
      updated = await sql`
        UPDATE avatars
        SET status = ${status}, thumbnail_url = ${thumbnailUrl}, updated_at = NOW()
        WHERE id = ${avatarId}
        RETURNING id, name, status, thumbnail_url, created_at, updated_at
      `.then((rows) => rows[0])
    } else if (name !== undefined) {
      updated = await sql`
        UPDATE avatars
        SET name = ${name}, updated_at = NOW()
        WHERE id = ${avatarId}
        RETURNING id, name, status, thumbnail_url, created_at, updated_at
      `.then((rows) => rows[0])
    } else if (status !== undefined) {
      updated = await sql`
        UPDATE avatars
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${avatarId}
        RETURNING id, name, status, thumbnail_url, created_at, updated_at
      `.then((rows) => rows[0])
    } else if (thumbnailUrl !== undefined) {
      updated = await sql`
        UPDATE avatars
        SET thumbnail_url = ${thumbnailUrl}, updated_at = NOW()
        WHERE id = ${avatarId}
        RETURNING id, name, status, thumbnail_url, created_at, updated_at
      `.then((rows) => rows[0])
    } else {
      return error("VALIDATION_ERROR", "No fields to update. Provide: name, status, or thumbnailUrl")
    }

    logger.info("Avatar updated", {
      avatarId,
      updates: { name, status, thumbnailUrl: thumbnailUrl ? "[set]" : undefined },
    })

    return success({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      thumbnailUrl: updated.thumbnail_url,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    })
  } catch (err) {
    logger.error("Failed to update avatar", {
      error: err instanceof Error ? err.message : "Unknown error",
      avatarId,
    })
    return error("DATABASE_ERROR", "Failed to update avatar")
  }
}

// ============================================================================
// DELETE /api/avatars/:id - Delete avatar and all related data
// ============================================================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId) || avatarId <= 0) {
    return error("VALIDATION_ERROR", "Invalid avatar ID")
  }

  // IDOR Protection: Get identifier for authorization (Telegram-only authentication)
  const identifier = getUserIdentifier(request)
  if (!identifier.telegramUserId) {
    return error("UNAUTHORIZED", "telegram_user_id is required")
  }

  try {
    // Verify ownership
    const { avatar: existing, authorized } = await verifyAvatarOwnershipWithData(identifier, avatarId)

    if (!existing) {
      return error("AVATAR_NOT_FOUND", `Avatar with ID ${avatarId} not found`)
    }

    if (!authorized) {
      logger.warn("Unauthorized avatar delete attempt", { avatarId, identifier })
      return error("FORBIDDEN", "You don't have access to this avatar")
    }

    // Delete in order of dependencies:
    const deletedRefPhotos = await sql`
      DELETE FROM reference_photos WHERE avatar_id = ${avatarId}
      RETURNING id
    `

    const deletedPhotos = await sql`
      DELETE FROM generated_photos WHERE avatar_id = ${avatarId}
      RETURNING id
    `

    const deletedJobs = await sql`
      DELETE FROM generation_jobs WHERE avatar_id = ${avatarId}
      RETURNING id
    `

    await sql`
      DELETE FROM avatars WHERE id = ${avatarId}
    `

    logger.info("Avatar deleted", {
      avatarId,
      deletedPhotos: deletedPhotos.length,
      deletedRefPhotos: deletedRefPhotos.length,
      deletedJobs: deletedJobs.length,
    })

    return success({
      deleted: true,
      avatarId,
      deletedCounts: {
        photos: deletedPhotos.length,
        referencePhotos: deletedRefPhotos.length,
        generationJobs: deletedJobs.length,
      },
    })
  } catch (err) {
    logger.error("Failed to delete avatar", {
      error: err instanceof Error ? err.message : "Unknown error",
      avatarId,
    })
    return error("DATABASE_ERROR", "Failed to delete avatar")
  }
}
