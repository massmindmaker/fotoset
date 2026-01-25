import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/auth-middleware"
// NOTE: Cannot use edge runtime - auth-middleware uses Node.js crypto

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/avatars/:id/references - Get reference photos for an avatar
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId)) {
    return NextResponse.json({ error: "Invalid avatar ID" }, { status: 400 })
  }

  // SECURITY: Require authenticated user (Telegram initData HMAC or Neon Auth session)
  const authUser = await getAuthenticatedUser(request)
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  // Verify ownership: avatar must belong to authenticated user
  const avatarResult = await query(
    "SELECT id, user_id FROM avatars WHERE id = $1",
    [avatarId]
  )

  if (avatarResult.rows.length === 0) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
  }

  const avatar = avatarResult.rows[0]
  if (avatar.user_id !== authUser.user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  try {
    // Get reference photos
    const photosResult = await query(
      `SELECT id, image_url, created_at
       FROM reference_photos
       WHERE avatar_id = $1
       ORDER BY created_at ASC`,
      [avatarId]
    )

    const references = photosResult.rows.map((row) => ({
      id: row.id,
      imageUrl: row.image_url,
      createdAt: row.created_at,
    }))

    return NextResponse.json({
      avatarId,
      count: references.length,
      references,
    })
  } catch (error) {
    console.error("[API] GET /api/avatars/:id/references error:", error)
    return NextResponse.json(
      { error: "Failed to fetch reference photos" },
      { status: 500 }
    )
  }
}

// POST /api/avatars/:id/references - Upload reference photos for an avatar
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId)) {
    return NextResponse.json({ error: "Invalid avatar ID" }, { status: 400 })
  }

  // Parse body first to extract auth data
  let body: { referenceImages?: string[]; telegramUserId?: number; neonUserId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // SECURITY: Require authenticated user (Telegram initData HMAC or Neon Auth session)
  const authUser = await getAuthenticatedUser(request, body)
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  // Verify ownership: avatar must belong to authenticated user
  const avatarResult = await query(
    "SELECT id, user_id FROM avatars WHERE id = $1",
    [avatarId]
  )

  if (avatarResult.rows.length === 0) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
  }

  const avatar = avatarResult.rows[0]
  if (avatar.user_id !== authUser.user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  try {
    const { referenceImages } = body

    if (!referenceImages || !Array.isArray(referenceImages) || referenceImages.length === 0) {
      return NextResponse.json({ error: "No reference images provided" }, { status: 400 })
    }

    if (referenceImages.length > 20) {
      return NextResponse.json({ error: "Maximum 20 reference images allowed" }, { status: 400 })
    }

    // Insert reference photos into database
    // Now accepts R2 URLs (https://...) or data URLs (data:image/...)
    const insertedIds: number[] = []
    let skippedCount = 0

    for (const imageData of referenceImages) {
      let imageUrl = imageData

      // Accept multiple formats:
      // 1. R2 URL: https://cdn.pinglass.ru/... or https://pinglass.xxx.r2.dev/...
      // 2. Data URL: data:image/jpeg;base64,...
      // 3. Raw base64: /9j/4AAQ... (add prefix)

      const isHttpUrl = imageData.startsWith("https://") || imageData.startsWith("http://")
      const isDataUrl = imageData.startsWith("data:image/")

      if (!isHttpUrl && !isDataUrl) {
        // Assume raw base64, add prefix
        imageUrl = `data:image/jpeg;base64,${imageData}`
      }

      // Validate format
      if (!isHttpUrl && !imageUrl.match(/^data:image\/(jpeg|png|webp|gif|heic);base64,/i)) {
        console.warn(`[API] Skipping invalid image format`)
        skippedCount++
        continue
      }

      const result = await query(
        `INSERT INTO reference_photos (avatar_id, image_url, created_at)
         VALUES ($1, $2, NOW())
         RETURNING id`,
        [avatarId, imageUrl]
      )

      if (result.rows[0]) {
        insertedIds.push(result.rows[0].id)
      }
    }

    console.log(`[API] Saved ${insertedIds.length}/${referenceImages.length} reference URLs for avatar ${avatarId} (skipped: ${skippedCount})`)

    // FIX 2: Return error if ALL images were skipped
    if (insertedIds.length === 0 && referenceImages.length > 0) {
      return NextResponse.json(
        { error: "No valid images could be uploaded", skippedCount },
        { status: 400 }
      )
    }

    // Auto-set thumbnail from first uploaded photo if avatar has no thumbnail
    if (insertedIds.length > 0) {
      const avatarResult = await query(
        "SELECT thumbnail_url FROM avatars WHERE id = $1",
        [avatarId]
      )

      if (!avatarResult.rows[0]?.thumbnail_url) {
        // Get first reference photo URL (the one we just inserted)
        const firstPhotoResult = await query(
          "SELECT image_url FROM reference_photos WHERE avatar_id = $1 ORDER BY created_at ASC LIMIT 1",
          [avatarId]
        )

        if (firstPhotoResult.rows[0]?.image_url) {
          await query(
            "UPDATE avatars SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2",
            [firstPhotoResult.rows[0].image_url, avatarId]
          )
          console.log(`[API] Auto-set thumbnail for avatar ${avatarId}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      avatarId,
      uploadedCount: insertedIds.length,
      skippedCount,
      referenceIds: insertedIds,
    })
  } catch (error) {
    console.error("[API] POST /api/avatars/:id/references error:", error)
    return NextResponse.json(
      { error: "Failed to upload reference photos" },
      { status: 500 }
    )
  }
}

// DELETE /api/avatars/:id/references - Delete all reference photos for an avatar
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId)) {
    return NextResponse.json({ error: "Invalid avatar ID" }, { status: 400 })
  }

  // SECURITY: Require authenticated user (Telegram initData HMAC or Neon Auth session)
  const authUser = await getAuthenticatedUser(request)
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  // Verify ownership: avatar must belong to authenticated user
  const avatarResult = await query(
    "SELECT id, user_id FROM avatars WHERE id = $1",
    [avatarId]
  )

  if (avatarResult.rows.length === 0) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
  }

  const avatar = avatarResult.rows[0]
  if (avatar.user_id !== authUser.user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  try {
    const result = await query(
      "DELETE FROM reference_photos WHERE avatar_id = $1 RETURNING id",
      [avatarId]
    )

    return NextResponse.json({
      success: true,
      deletedCount: result.rows.length,
    })
  } catch (error) {
    console.error("[API] DELETE /api/avatars/:id/references error:", error)
    return NextResponse.json(
      { error: "Failed to delete reference photos" },
      { status: 500 }
    )
  }
}
