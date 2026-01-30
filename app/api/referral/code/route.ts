import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { extractIdentifierFromRequest, findUserByIdentifier } from "@/lib/user-identity"

export const runtime = 'edge'

// Generate unique referral code
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // No 0,O,1,I for clarity
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * GET /api/referral/code
 *
 * Get or generate user's referral code (Telegram users only)
 * App is Telegram-only, so only Telegram link is returned.
 *
 * Returns:
 * - referralCodeTelegram: Code for t.me/pinglassbot?start=CODE
 * - telegramLink: Full Telegram link
 * - code: Legacy alias for referralCodeTelegram
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserIdParam = searchParams.get("telegram_user_id")

    if (!telegramUserIdParam) {
      return NextResponse.json(
        { error: "telegram_user_id required" },
        { status: 400 }
      )
    }

    const telegramUserId = parseInt(telegramUserIdParam)
    if (isNaN(telegramUserId)) {
      return NextResponse.json(
        { error: "Invalid telegram_user_id" },
        { status: 400 }
      )
    }

    // Get user by telegram_user_id
    const identifier = extractIdentifierFromRequest({
      telegram_user_id: telegramUserIdParam,
    })

    const user = await findUserByIdentifier(identifier)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = user.id

    // Check existing referral balance with Telegram code
    const existingBalance = await sql`
      SELECT
        referral_code,
        referral_code_telegram
      FROM referral_balances
      WHERE user_id = ${userId}
    `.then((rows: any[]) => rows[0])

    let referralCodeTelegram: string

    if (existingBalance && existingBalance.referral_code_telegram) {
      // Code exists
      referralCodeTelegram = existingBalance.referral_code_telegram
    } else {
      // Generate new code if missing
      referralCodeTelegram = existingBalance?.referral_code_telegram || await generateUniqueCode('telegram')

      // Insert or update referral_balances (only Telegram code needed)
      await sql`
        INSERT INTO referral_balances (
          user_id,
          referral_code,
          referral_code_telegram,
          balance_rub,
          balance_ton,
          earned_rub,
          earned_ton,
          withdrawn_rub,
          withdrawn_ton,
          referrals_count
        ) VALUES (
          ${userId},
          ${referralCodeTelegram},
          ${referralCodeTelegram},
          0, 0, 0, 0, 0, 0, 0
        )
        ON CONFLICT (user_id) DO UPDATE SET
          referral_code_telegram = COALESCE(referral_balances.referral_code_telegram, ${referralCodeTelegram}),
          referral_code = COALESCE(referral_balances.referral_code, ${referralCodeTelegram})
      `
    }

    // Build Telegram link (app is Telegram-only)
    // Format: https://t.me/BotName/app?startapp=CODE - opens WebApp directly
    const telegramLink = `https://t.me/PinGlassBot/app?startapp=${referralCodeTelegram}`

    return NextResponse.json({
      referralCodeTelegram,
      telegramLink,
      // Legacy field for backward compatibility
      code: referralCodeTelegram,
      isActive: true
    })
  } catch (error) {
    console.error("[Referral] Code error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Helper: Generate unique Telegram referral code with batch collision detection
async function generateUniqueCode(_type: 'telegram'): Promise<string> {
  // Generate 10 candidates at once, check uniqueness in single query
  const candidates = Array.from({ length: 10 }, () => generateCode())

  const existing = await sql`
    SELECT referral_code_telegram as code
    FROM referral_balances
    WHERE referral_code_telegram = ANY(${candidates})
  `

  const existingCodes = new Set(existing.map((r: { code: string }) => r.code))
  const uniqueCode = candidates.find(c => !existingCodes.has(c))

  if (!uniqueCode) {
    throw new Error('Failed to generate unique referral code - all 10 candidates collided')
  }

  return uniqueCode
}
