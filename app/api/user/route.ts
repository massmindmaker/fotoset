import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  validateTelegramInitData,
  createUnauthorizedResponse,
  type TelegramInitData,
} from "@/lib/telegram-auth"

/**
 * POST /api/user
 *
 * TELEGRAM-ONLY AUTHENTICATION
 * - Requires valid Telegram WebApp initData
 * - Creates or returns existing user by telegram_user_id
 * - Returns user data for client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramInitData } = body

    // Require Telegram authentication
    if (!telegramInitData) {
      return NextResponse.json(
        { error: "Telegram authentication required" },
        { status: 401 }
      )
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      console.error("[User API] TELEGRAM_BOT_TOKEN not configured")
      return NextResponse.json(
        { error: "Telegram authentication not configured" },
        { status: 500 }
      )
    }

    // Validate Telegram initData
    const validatedTelegramData = validateTelegramInitData(telegramInitData, botToken)

    if (!validatedTelegramData || !validatedTelegramData.user) {
      console.warn("[User API] Invalid Telegram initData")
      return createUnauthorizedResponse()
    }

    const telegramUserId = validatedTelegramData.user.id

    // Find or create user
    let user = await sql`
      SELECT * FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then((rows) => rows[0])

    if (!user) {
      // Create new user
      user = await sql`
        INSERT INTO users (telegram_user_id)
        VALUES (${telegramUserId})
        RETURNING *
      `.then((rows) => rows[0])
      console.log(`[User API] Created new Telegram user: ${telegramUserId}`)
    }

    return NextResponse.json({
      id: user.id,
      telegramUserId: user.telegram_user_id,
    })
  } catch (error) {
    console.error("[User API] Error:", error)
    return NextResponse.json(
      { error: "Failed to get/create user" },
      { status: 500 }
    )
  }
}
