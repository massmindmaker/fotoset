import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/avatars/:id - Get single avatar with photos
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId)) {
    return NextResponse.json({ error: "Invalid avatar ID" }, { status: 400 })
  }

  try {
    // Get avatar
    const avatarResult = await query(
      `SELECT
        a.id,
        a.name,
        a.status,
        a.thumbnail_url,
        a.created_at,
        a.updated_at
      FROM avatars a
      WHERE a.id = $1`,
      [avatarId]
    )

    if (avatarResult.rows.length === 0) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
    }

    const avatar = avatarResult.rows[0]

    // Get photos
    const photosResult = await query(
      `SELECT id, style_id, prompt, image_url, created_at
       FROM generated_photos
       WHERE avatar_id = $1
       ORDER BY created_at DESC`,
      [avatarId]
    )

    const photos = photosResult.rows.map((row) => ({
      id: row.id,
      styleId: row.style_id,
      prompt: row.prompt,
      imageUrl: row.image_url,
      createdAt: row.created_at,
    }))

    return NextResponse.json({
      id: avatar.id,
      name: avatar.name,
      status: avatar.status,
      thumbnailUrl: avatar.thumbnail_url,
      createdAt: avatar.created_at,
      updatedAt: avatar.updated_at,
      photos,
    })
  } catch (error) {
    console.error("[API] GET /api/avatars/:id error:", error)
    return NextResponse.json(
      { error: "Failed to fetch avatar" },
      { status: 500 }
    )
  }
}

// PATCH /api/avatars/:id - Update avatar
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId)) {
    return NextResponse.json({ error: "Invalid avatar ID" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { name, status, thumbnailUrl } = body

    // Build dynamic update query
    const updates: string[] = []
    const values: (string | number)[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }

    if (thumbnailUrl !== undefined) {
      updates.push(`thumbnail_url = $${paramIndex++}`)
      values.push(thumbnailUrl)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(avatarId)

    const result = await query(
      `UPDATE avatars SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
    }

    const avatar = result.rows[0]

    return NextResponse.json({
      id: avatar.id,
      name: avatar.name,
      status: avatar.status,
      thumbnailUrl: avatar.thumbnail_url,
      updatedAt: avatar.updated_at,
    })
  } catch (error) {
    console.error("[API] PATCH /api/avatars/:id error:", error)
    return NextResponse.json(
      { error: "Failed to update avatar" },
      { status: 500 }
    )
  }
}

// DELETE /api/avatars/:id - Delete avatar and its photos
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const avatarId = parseInt(id, 10)

  if (isNaN(avatarId)) {
    return NextResponse.json({ error: "Invalid avatar ID" }, { status: 400 })
  }

  try {
    // Delete associated photos first (cascade should handle this, but being explicit)
    await query("DELETE FROM generated_photos WHERE avatar_id = $1", [avatarId])

    // Delete generation jobs
    await query("DELETE FROM generation_jobs WHERE avatar_id = $1", [avatarId])

    // Delete avatar
    const result = await query(
      "DELETE FROM avatars WHERE id = $1 RETURNING id",
      [avatarId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, deletedId: avatarId })
  } catch (error) {
    console.error("[API] DELETE /api/avatars/:id error:", error)
    return NextResponse.json(
      { error: "Failed to delete avatar" },
      { status: 500 }
    )
  }
}
