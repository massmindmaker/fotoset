import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getUserIdentifier, verifyResourceOwnershipWithIdentifier } from "@/lib/auth-utils"

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

  // SECURITY: Verify ownership before returning data (supports Telegram + device ID)
  const identifier = getUserIdentifier(request)
  const ownership = await verifyResourceOwnershipWithIdentifier(identifier, "avatar", avatarId)

  if (!ownership.resourceExists) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
  }

  if (!ownership.authorized) {
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

  // Parse body first to extract user identifier (FIX 4)
  let body: { referenceImages?: string[]; telegramUserId?: number; deviceId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // SECURITY: Verify ownership (pass body for telegramUserId extraction)
  const identifier = getUserIdentifier(request, body)
  const ownership = await verifyResourceOwnershipWithIdentifier(identifier, "avatar", avatarId)

  if (!ownership.resourceExists) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
  }

  if (!ownership.authorized) {
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
    const insertedIds: number[] = []
    let skippedCount = 0

    for (const imageData of referenceImages) {
      // FIX 2: Accept both formats - full data URL or raw base64
      let imageUrl = imageData

      if (!imageData.startsWith("data:image/")) {
        // Raw base64 without prefix - add default JPEG prefix
        imageUrl = `data:image/jpeg;base64,${imageData}`
      }

      // Validate it's a proper base64 image
      if (!imageUrl.match(/^data:image\/(jpeg|png|webp|gif|heic);base64,/i)) {
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

    console.log(`[API] Uploaded ${insertedIds.length}/${referenceImages.length} photos for avatar ${avatarId} (skipped: ${skippedCount})`)

    // FIX 2: Return error if ALL images were skipped
    if (insertedIds.length === 0 && referenceImages.length > 0) {
      return NextResponse.json(
        { error: "No valid images could be uploaded", skippedCount },
        { status: 400 }
      )
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

  // SECURITY: Verify ownership before deleting (supports Telegram + device ID)
  const identifier = getUserIdentifier(request)
  const ownership = await verifyResourceOwnershipWithIdentifier(identifier, "avatar", avatarId)

  if (!ownership.resourceExists) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
  }

  if (!ownership.authorized) {
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
