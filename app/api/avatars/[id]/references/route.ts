import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getDeviceId, verifyResourceOwnership } from "@/lib/auth-utils"

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

  // SECURITY: Verify ownership before returning data
  const deviceId = getDeviceId(request)
  const ownership = await verifyResourceOwnership(deviceId, "avatar", avatarId)

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

// DELETE /api/avatars/:id/references - Delete all reference photos for an avatar
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId)) {
    return NextResponse.json({ error: "Invalid avatar ID" }, { status: 400 })
  }

  // SECURITY: Verify ownership before deleting
  const deviceId = getDeviceId(request)
  const ownership = await verifyResourceOwnership(deviceId, "avatar", avatarId)

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
