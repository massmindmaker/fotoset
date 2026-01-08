// Get/Delete generated photos for an avatar
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { deleteImage, isR2Configured } from "@/lib/r2"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId)) {
    return NextResponse.json(
      { success: false, error: "Invalid avatar ID" },
      { status: 400 }
    )
  }

  try {
    const photos = await sql`
      SELECT id, style_id, prompt, image_url, created_at
      FROM generated_photos
      WHERE avatar_id = ${avatarId}
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      success: true,
      photos,
      count: photos.length,
    })
  } catch (error) {
    console.error("[API] Failed to get photos:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get photos" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/avatars/[id]/photos
 * Delete all generated photos for an avatar (R2 + DB)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId)) {
    return NextResponse.json(
      { success: false, error: "Invalid avatar ID" },
      { status: 400 }
    )
  }

  try {
    // Get all photos for this avatar
    const photos = await sql`
      SELECT id, image_url
      FROM generated_photos
      WHERE avatar_id = ${avatarId}
    `

    if (photos.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: "No photos to delete",
      })
    }

    // Delete from R2 if configured
    if (isR2Configured()) {
      const deletePromises = photos.map(async (photo: { id: number; image_url: string }) => {
        try {
          // Extract R2 key from URL
          // URL format: https://domain.com/generated/avatarId/...
          const url = photo.image_url as string
          const key = extractR2Key(url)
          if (key) {
            await deleteImage(key)
          }
        } catch (err) {
          // Log but don't fail - photo might be external URL
          console.warn(`[API] Failed to delete R2 image: ${photo.image_url}`, err)
        }
      })
      await Promise.all(deletePromises)
    }

    // Delete from database
    await sql`
      DELETE FROM generated_photos
      WHERE avatar_id = ${avatarId}
    `

    console.log(`[API] Deleted ${photos.length} photos for avatar ${avatarId}`)

    return NextResponse.json({
      success: true,
      deletedCount: photos.length,
    })
  } catch (error) {
    console.error("[API] Failed to delete photos:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete photos" },
      { status: 500 }
    )
  }
}

/**
 * Extract R2 key from image URL
 * URL formats:
 * - https://r2-domain.com/generated/123/style/0-timestamp-random.png
 * - https://bucket.account.r2.dev/generated/123/style/0-timestamp-random.png
 */
function extractR2Key(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Key is the pathname without leading slash
    const key = urlObj.pathname.slice(1)
    // Only return if it looks like our R2 key format
    if (key.startsWith("generated/") || key.startsWith("reference/") || key.startsWith("thumbnail/")) {
      return key
    }
    return null
  } catch {
    return null
  }
}
