// Get generated photos for an avatar
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

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
