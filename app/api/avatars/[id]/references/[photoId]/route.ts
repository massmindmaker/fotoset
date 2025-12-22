import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getUserIdentifier, verifyResourceOwnershipWithIdentifier } from "@/lib/auth-utils"

interface RouteParams {
  params: Promise<{ id: string; photoId: string }>
}

// DELETE /api/avatars/:id/references/:photoId - Delete single reference photo
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, photoId } = await params
  const avatarId = parseInt(id, 10)
  const referenceId = parseInt(photoId, 10)

  if (isNaN(avatarId) || isNaN(referenceId)) {
    return NextResponse.json({ error: "Invalid avatar or photo ID" }, { status: 400 })
  }

  // SECURITY: Verify ownership
  const identifier = getUserIdentifier(request)
  if (!identifier.telegramUserId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const ownership = await verifyResourceOwnershipWithIdentifier(identifier, "avatar", avatarId)

  if (!ownership.resourceExists) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
  }

  if (!ownership.authorized) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  try {
    // Check if the reference photo exists and belongs to this avatar
    const photoResult = await query(
      "SELECT id, image_url FROM reference_photos WHERE id = $1 AND avatar_id = $2",
      [referenceId, avatarId]
    )

    if (photoResult.rows.length === 0) {
      return NextResponse.json({ error: "Reference photo not found" }, { status: 404 })
    }

    const deletedPhotoUrl = photoResult.rows[0].image_url

    // Delete the reference photo
    await query("DELETE FROM reference_photos WHERE id = $1", [referenceId])

    // Check if deleted photo was the thumbnail - update to next available
    const avatarResult = await query(
      "SELECT thumbnail_url FROM avatars WHERE id = $1",
      [avatarId]
    )

    if (avatarResult.rows[0]?.thumbnail_url === deletedPhotoUrl) {
      // Get next available reference photo
      const nextPhoto = await query(
        "SELECT image_url FROM reference_photos WHERE avatar_id = $1 ORDER BY created_at ASC LIMIT 1",
        [avatarId]
      )

      const newThumbnail = nextPhoto.rows[0]?.image_url || null

      await query(
        "UPDATE avatars SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2",
        [newThumbnail, avatarId]
      )

      console.log(`[API] Updated thumbnail for avatar ${avatarId} after photo deletion`)
    }

    console.log(`[API] Deleted reference photo ${referenceId} from avatar ${avatarId}`)

    return NextResponse.json({
      success: true,
      deletedId: referenceId,
    })
  } catch (error) {
    console.error("[API] DELETE /api/avatars/:id/references/:photoId error:", error)
    return NextResponse.json(
      { error: "Failed to delete reference photo" },
      { status: 500 }
    )
  }
}
