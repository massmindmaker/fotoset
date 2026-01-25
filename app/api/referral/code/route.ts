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
 * Get or generate user's referral codes (Telegram + Web)
 *
 * Supports both Telegram and Web users:
 * - Telegram: via telegram_user_id query param
 * - Web: via neon_user_id query param
 *
 * Returns:
 * - referralCodeTelegram: Code for t.me/pinglassbot?start=CODE
 * - referralCodeWeb: Code for pinglass.app/?ref=CODE
 * - telegramLink: Full Telegram link
 * - webLink: Full Web link
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserId = searchParams.get("telegram_user_id")
    const neonUserId = searchParams.get("neon_user_id")

    if (!telegramUserId && !neonUserId) {
      return NextResponse.json(
        { error: "telegram_user_id or neon_user_id required" },
        { status: 400 }
      )
    }

    // Get user by identifier
    const identifier = extractIdentifierFromRequest({
      telegram_user_id: telegramUserId,
      neon_user_id: neonUserId
    })

    const user = await findUserByIdentifier(identifier)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = user.id

    // Check existing referral balance with codes
    const existingBalance = await sql`
      SELECT
        referral_code,
        referral_code_telegram,
        referral_code_web
      FROM referral_balances
      WHERE user_id = ${userId}
    `.then((rows: any[]) => rows[0])

    let referralCodeTelegram: string
    let referralCodeWeb: string

    if (existingBalance && existingBalance.referral_code_telegram && existingBalance.referral_code_web) {
      // Both codes exist
      referralCodeTelegram = existingBalance.referral_code_telegram
      referralCodeWeb = existingBalance.referral_code_web
    } else {
      // Generate new codes if missing
      referralCodeTelegram = existingBalance?.referral_code_telegram || await generateUniqueCode('telegram')
      referralCodeWeb = existingBalance?.referral_code_web || await generateUniqueCode('web')

      // Insert or update referral_balances
      await sql`
        INSERT INTO referral_balances (
          user_id,
          referral_code,
          referral_code_telegram,
          referral_code_web,
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
          ${referralCodeWeb},
          0, 0, 0, 0, 0, 0, 0
        )
        ON CONFLICT (user_id) DO UPDATE SET
          referral_code_telegram = COALESCE(referral_balances.referral_code_telegram, ${referralCodeTelegram}),
          referral_code_web = COALESCE(referral_balances.referral_code_web, ${referralCodeWeb}),
          referral_code = COALESCE(referral_balances.referral_code, ${referralCodeTelegram})
      `
    }

    // Build links
    const TELEGRAM_BOT = process.env.TELEGRAM_BOT_USERNAME || 'pinglassbot'
    const WEB_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pinglass.app'

    const telegramLink = `https://t.me/${TELEGRAM_BOT}?start=${referralCodeTelegram}`
    const webLink = `${WEB_URL}/?ref=${referralCodeWeb}`

    return NextResponse.json({
      referralCodeTelegram,
      referralCodeWeb,
      telegramLink,
      webLink,
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

// Helper: Generate unique code with collision detection
async function generateUniqueCode(type: 'telegram' | 'web'): Promise<string> {
  let code = generateCode()
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    // Use conditional query to avoid SQL injection with dynamic column names
    const duplicate = type === 'telegram'
      ? await sql`SELECT id FROM referral_balances WHERE referral_code_telegram = ${code}`.then((rows: any[]) => rows[0])
      : await sql`SELECT id FROM referral_balances WHERE referral_code_web = ${code}`.then((rows: any[]) => rows[0])

    if (!duplicate) break
    code = generateCode()
    attempts++
  }

  if (attempts >= maxAttempts) {
    throw new Error(`Failed to generate unique ${type} referral code after ${maxAttempts} attempts`)
  }

  return code
}
