import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// Generate random 6-character code
function generateLinkCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Avoid confusing characters
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// POST /api/telegram/link - Generate a link code for the user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId } = body

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 })
    }

    // Get user
    const userResult = await query(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = userResult.rows[0].id

    // Check if already linked
    const existingSession = await query(
      `SELECT telegram_username FROM telegram_sessions WHERE user_id = $1`,
      [userId]
    )

    if (existingSession.rows.length > 0) {
      return NextResponse.json({
        linked: true,
        telegramUsername: existingSession.rows[0].telegram_username,
      })
    }

    // Invalidate old codes
    await query(
      `DELETE FROM telegram_link_codes WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    )

    // Generate new code
    let code = generateLinkCode()
    let attempts = 0

    while (attempts < 5) {
      try {
        await query(
          `INSERT INTO telegram_link_codes (code, user_id, expires_at)
           VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
          [code, userId]
        )
        break
      } catch (error) {
        // Code collision, generate new one
        code = generateLinkCode()
        attempts++
      }
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "pinglass_bot"

    return NextResponse.json({
      linked: false,
      code,
      expiresIn: 600, // 10 minutes
      botUrl: `https://t.me/${botUsername}`,
    })
  } catch (error) {
    console.error("[API] POST /api/telegram/link error:", error)
    return NextResponse.json(
      { error: "Failed to generate link code" },
      { status: 500 }
    )
  }
}

// GET /api/telegram/link?device_id=xxx - Check link status
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("device_id")

  if (!deviceId) {
    return NextResponse.json({ error: "device_id is required" }, { status: 400 })
  }

  try {
    const userResult = await query(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ linked: false })
    }

    const userId = userResult.rows[0].id

    const sessionResult = await query(
      `SELECT telegram_username, linked_at FROM telegram_sessions WHERE user_id = $1`,
      [userId]
    )

    if (sessionResult.rows.length > 0) {
      return NextResponse.json({
        linked: true,
        telegramUsername: sessionResult.rows[0].telegram_username,
        linkedAt: sessionResult.rows[0].linked_at,
      })
    }

    return NextResponse.json({ linked: false })
  } catch (error) {
    console.error("[API] GET /api/telegram/link error:", error)
    return NextResponse.json({ linked: false })
  }
}
