import { type NextRequest, NextResponse } from "next/server"
import { findOrCreateUser } from "@/lib/user-identity"

/**
 * POST /api/user
 *
 * TELEGRAM WEBAPP AUTHENTICATION
 * - Accepts telegramUserId from Telegram WebApp SDK (initDataUnsafe.user.id)
 * - Creates or returns existing user
 * - Optionally saves referral code to pending_referral_code field
 *
 * NOTE: In Telegram WebApp context, we trust initDataUnsafe.user.id
 * because the app is only accessible through Telegram
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramUserId, referralCode } = body as {
      telegramUserId?: number
      referralCode?: string
    }

    // Require telegramUserId
    if (!telegramUserId || typeof telegramUserId !== "number") {
      return NextResponse.json(
        { error: "telegramUserId is required" },
        { status: 400 }
      )
    }

    // Find or create user (with optional referral code)
    const user = await findOrCreateUser({
      telegramUserId,
      referralCode: referralCode || undefined,
    })

    console.log(`[User API] User ${user.id}:`, {
      telegramUserId: user.telegram_user_id,
      pendingReferralCode: user.pending_referral_code || "none",
    })

    return NextResponse.json({
      id: user.id,
      telegramUserId: user.telegram_user_id,
      pendingReferralCode: user.pending_referral_code,
    })
  } catch (error) {
    console.error("[User API] Error:", error)
    return NextResponse.json(
      { error: "Failed to get/create user" },
      { status: 500 }
    )
  }
}
