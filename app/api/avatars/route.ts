import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// GET /api/avatars?device_id=xxx - Get all avatars for a user
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("device_id")

  if (!deviceId) {
    return NextResponse.json({ error: "device_id is required" }, { status: 400 })
  }

  try {
    // Get user first
    const userResult = await query(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ avatars: [] })
    }

    const userId = userResult.rows[0].id

    // Get all avatars with photo counts
    const avatarsResult = await query(
      `SELECT
        a.id,
        a.name,
        a.status,
        a.thumbnail_url,
        a.created_at,
        a.updated_at,
        COUNT(gp.id) as photo_count
      FROM avatars a
      LEFT JOIN generated_photos gp ON gp.avatar_id = a.id
      WHERE a.user_id = $1
      GROUP BY a.id
      ORDER BY a.created_at DESC`,
      [userId]
    )

    const avatars = avatarsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      thumbnailUrl: row.thumbnail_url,
      photoCount: parseInt(row.photo_count, 10),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({ avatars })
  } catch (error) {
    console.error("[API] GET /api/avatars error:", error)
    return NextResponse.json(
      { error: "Failed to fetch avatars" },
      { status: 500 }
    )
  }
}

// POST /api/avatars - Create a new avatar
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, name = "Мой аватар" } = body

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 })
    }

    // Get or create user
    let userResult = await query(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    )

    let userId: number

    if (userResult.rows.length === 0) {
      const insertResult = await query(
        "INSERT INTO users (device_id) VALUES ($1) RETURNING id",
        [deviceId]
      )
      userId = insertResult.rows[0].id
    } else {
      userId = userResult.rows[0].id
    }

    // Create avatar
    const avatarResult = await query(
      `INSERT INTO avatars (user_id, name, status)
       VALUES ($1, $2, 'draft')
       RETURNING id, name, status, thumbnail_url, created_at`,
      [userId, name]
    )

    const avatar = avatarResult.rows[0]

    return NextResponse.json({
      id: avatar.id,
      name: avatar.name,
      status: avatar.status,
      thumbnailUrl: avatar.thumbnail_url,
      createdAt: avatar.created_at,
    })
  } catch (error) {
    console.error("[API] POST /api/avatars error:", error)
    return NextResponse.json(
      { error: "Failed to create avatar" },
      { status: 500 }
    )
  }
}
