import { type NextRequest } from "next/server"
import { sql, type Avatar, type GeneratedPhoto } from "@/lib/db"
import {
  success,
  created,
  error,
  validateRequired,
  parsePagination,
  createPaginationMeta,
  createLogger,
} from "@/lib/api-utils"
import { findOrCreateUser, extractIdentifierFromRequest } from "@/lib/user-identity"

const logger = createLogger("Avatars")

// ============================================================================
// Types
// ============================================================================

interface PhotoWithFavorite {
  id: number
  imageUrl: string
  styleId: string
  prompt?: string
  isFavorite: boolean
  createdAt: string
}

interface AvatarWithPhotos {
  id: number
  name: string
  status: "draft" | "processing" | "ready"
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
  photoCount: number
  generatedPhotos: PhotoWithFavorite[]
}

interface CreateAvatarRequest {
  telegramUserId: number
  name?: string
}

// ============================================================================
// GET /api/avatars?device_id=xxx&telegram_user_id=xxx - Get all avatars for a user with photos
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const telegramUserIdParam = searchParams.get("telegram_user_id")
  const includePhotos = searchParams.get("include_photos") !== "false" // default: true

  // Require Telegram user ID (no deviceId fallback)
  if (!telegramUserIdParam) {
    return error("UNAUTHORIZED", "telegram_user_id is required")
  }

  // NaN validation
  const telegramUserId = parseInt(telegramUserIdParam)
  if (isNaN(telegramUserId)) {
    return error("VALIDATION_ERROR", "Invalid telegram_user_id format")
  }

  try {
    // Find user by telegram_user_id only
    const user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then((rows) => rows[0])

    if (!user) {
      logger.info("No user found, returning empty avatars", { telegramUserId })
      return success({ avatars: [] })
    }

    // Get pagination params
    const pagination = parsePagination(searchParams, { limit: 50 })

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*)::int as count FROM avatars WHERE user_id = ${user.id}
    `.then((rows) => rows[0])
    const total = countResult?.count || 0

    // Get avatars with photo counts
    const avatars = await sql`
      SELECT
        a.id,
        a.name,
        a.status,
        a.thumbnail_url,
        a.created_at,
        a.updated_at,
        COUNT(gp.id)::int as photo_count
      FROM avatars a
      LEFT JOIN generated_photos gp ON gp.avatar_id = a.id
      WHERE a.user_id = ${user.id}
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}
    ` as (Avatar & { photo_count: number })[]

    if (avatars.length === 0) {
      logger.info("No avatars found for user", { userId: user.id, telegramUserId })
      return success(
        { avatars: [] },
        createPaginationMeta(pagination, total)
      )
    }

    // Build response with optional photos
    let avatarsWithPhotos: AvatarWithPhotos[]

    if (includePhotos) {
      // Get all avatar IDs for batch photo query
      const avatarIds = avatars.map((a) => a.id)

      // Get all generated photos with favorite status in one query
      const photos = await sql`
        SELECT
          gp.id,
          gp.avatar_id,
          gp.style_id,
          gp.prompt,
          gp.image_url,
          gp.created_at,
          CASE WHEN pf.id IS NOT NULL THEN true ELSE false END as is_favorite
        FROM generated_photos gp
        LEFT JOIN photo_favorites pf ON pf.photo_id = gp.id AND pf.user_id = ${user.id}
        WHERE gp.avatar_id = ANY(${avatarIds})
        ORDER BY gp.created_at DESC
      ` as (GeneratedPhoto & { avatar_id: number; is_favorite: boolean })[]

      // Group photos by avatar_id
      const photosByAvatar = new Map<number, PhotoWithFavorite[]>()
      for (const photo of photos) {
        if (!photosByAvatar.has(photo.avatar_id)) {
          photosByAvatar.set(photo.avatar_id, [])
        }
        photosByAvatar.get(photo.avatar_id)!.push({
          id: photo.id,
          imageUrl: photo.image_url,
          styleId: photo.style_id,
          prompt: photo.prompt,
          isFavorite: photo.is_favorite,
          createdAt: photo.created_at,
        })
      }

      avatarsWithPhotos = avatars.map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        status: avatar.status,
        thumbnailUrl: avatar.thumbnail_url,
        createdAt: avatar.created_at,
        updatedAt: avatar.updated_at,
        photoCount: avatar.photo_count,
        generatedPhotos: photosByAvatar.get(avatar.id) || [],
      }))
    } else {
      // Return without photos array for lighter response
      avatarsWithPhotos = avatars.map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        status: avatar.status,
        thumbnailUrl: avatar.thumbnail_url,
        createdAt: avatar.created_at,
        updatedAt: avatar.updated_at,
        photoCount: avatar.photo_count,
        generatedPhotos: [],
      }))
    }

    logger.info("Avatars fetched successfully", {
      userId: user.id,
      count: avatarsWithPhotos.length,
      total,
      includePhotos,
    })

    return success(
      { avatars: avatarsWithPhotos },
      createPaginationMeta(pagination, total)
    )
  } catch (err) {
    logger.error("Failed to fetch avatars", {
      error: err instanceof Error ? err.message : "Unknown error",
      telegramUserId,
    })
    return error("DATABASE_ERROR", "Failed to fetch avatars")
  }
}

// ============================================================================
// POST /api/avatars - Create a new avatar
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramUserId, name = "My Avatar" } = body as CreateAvatarRequest

    // Require Telegram user ID (no deviceId fallback)
    if (!telegramUserId) {
      return error("UNAUTHORIZED", "telegramUserId is required")
    }

    // NaN validation
    const tgId = typeof telegramUserId === 'number' ? telegramUserId : parseInt(String(telegramUserId))
    if (isNaN(tgId)) {
      return error("VALIDATION_ERROR", "Invalid telegramUserId format")
    }

    // Find or create user with telegram_user_id only
    const user = await findOrCreateUser({ telegramUserId: tgId })
    logger.info("User resolved", { userId: user.id, telegramUserId: tgId })

    // Create avatar
    const newAvatar = await sql`
      INSERT INTO avatars (user_id, name, status)
      VALUES (${user.id}, ${name}, 'draft')
      RETURNING id, name, status, thumbnail_url, created_at, updated_at
    `.then((rows) => rows[0])

    logger.info("Avatar created", {
      avatarId: newAvatar.id,
      userId: user.id,
      name,
    })

    const response: AvatarWithPhotos = {
      id: newAvatar.id,
      name: newAvatar.name,
      status: newAvatar.status,
      thumbnailUrl: newAvatar.thumbnail_url,
      createdAt: newAvatar.created_at,
      updatedAt: newAvatar.updated_at,
      photoCount: 0,
      generatedPhotos: [],
    }

    return created(response)
  } catch (err) {
    logger.error("Failed to create avatar", {
      error: err instanceof Error ? err.message : "Unknown error",
    })
    return error("DATABASE_ERROR", "Failed to create avatar")
  }
}
