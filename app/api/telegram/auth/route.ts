import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import crypto from "crypto"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Validate Telegram WebApp initData
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function validateInitData(initData: string): { valid: boolean; data?: Record<string, string> } {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram Auth] Bot token not configured")
    return { valid: false }
  }

  try {
    // Parse initData
    const params = new URLSearchParams(initData)
    const hash = params.get("hash")
    params.delete("hash")

    if (!hash) {
      return { valid: false }
    }

    // Sort params and create data check string
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")

    // Create secret key from bot token
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(TELEGRAM_BOT_TOKEN)
      .digest()

    // Calculate hash
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(sortedParams)
      .digest("hex")

    if (calculatedHash !== hash) {
      console.warn("[Telegram Auth] Hash mismatch")
      return { valid: false }
    }

    // Check auth_date (should be within 24 hours)
    const authDate = parseInt(params.get("auth_date") || "0", 10)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > 86400) {
      console.warn("[Telegram Auth] Data expired")
      return { valid: false }
    }

    // Parse and return data
    const data: Record<string, string> = {}
    params.forEach((value, key) => {
      data[key] = value
    })

    return { valid: true, data }
  } catch (error) {
    console.error("[Telegram Auth] Validation error:", error)
    return { valid: false }
  }
}

// POST /api/telegram/auth - Validate Telegram WebApp auth
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData } = body

    if (!initData) {
      return NextResponse.json({ error: "initData is required" }, { status: 400 })
    }

    // Validate initData
    const validation = validateInitData(initData)
    if (!validation.valid || !validation.data) {
      return NextResponse.json({ error: "Invalid initData" }, { status: 401 })
    }

    // Parse user data from initData
    let telegramUser: { id: number; username?: string; first_name?: string } | null = null
    try {
      const userStr = validation.data.user
      if (userStr) {
        telegramUser = JSON.parse(userStr)
      }
    } catch {
      console.warn("[Telegram Auth] Failed to parse user data")
    }

    if (!telegramUser?.id) {
      return NextResponse.json({ error: "User not found in initData" }, { status: 400 })
    }

    // Create device ID from Telegram user ID (consistent across sessions)
    const deviceId = `tg_${telegramUser.id}`

    // Ensure user exists in database
    const existingUser = await query(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    )

    let userId: number
    if (existingUser.rows.length === 0) {
      // Create new user
      const insertResult = await query(
        "INSERT INTO users (device_id, telegram_user_id) VALUES ($1, $2) RETURNING id",
        [deviceId, telegramUser.id]
      )
      userId = insertResult.rows[0].id
      console.log(`[Telegram Auth] Created new user: ${userId} for tg_${telegramUser.id}`)
    } else {
      userId = existingUser.rows[0].id
      // Update telegram_user_id if not set
      await query(
        "UPDATE users SET telegram_user_id = $1 WHERE id = $2 AND telegram_user_id IS NULL",
        [telegramUser.id, userId]
      )
    }

    // Create/update telegram session
    await query(
      `INSERT INTO telegram_sessions (user_id, telegram_chat_id, telegram_username)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET telegram_chat_id = $2, telegram_username = $3, last_activity = NOW()`,
      [userId, telegramUser.id, telegramUser.username || telegramUser.first_name || null]
    )

    console.log(`[Telegram Auth] User ${telegramUser.id} authenticated as ${deviceId}`)

    return NextResponse.json({
      success: true,
      deviceId,
      telegramUserId: telegramUser.id,
      username: telegramUser.username || telegramUser.first_name
    })
  } catch (error) {
    console.error("[Telegram Auth] Error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
