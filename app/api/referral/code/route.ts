import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Generate unique referral code
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // No 0,O,1,I for clarity
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// GET: Get user's referral code (create if not exists)
export async function GET(request: NextRequest) {
  try {
    const telegramUserIdParam = request.nextUrl.searchParams.get("telegram_user_id")

    if (!telegramUserIdParam) {
      return NextResponse.json({ error: "telegram_user_id required" }, { status: 400 })
    }

    const telegramUserId = parseInt(telegramUserIdParam)
    if (isNaN(telegramUserId)) {
      return NextResponse.json({ error: "Invalid telegram_user_id" }, { status: 400 })
    }

    // Get user by telegram_user_id
    const user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = user.id

    // Check existing code
    const existingCode = await sql`
      SELECT code, is_active FROM referral_codes WHERE user_id = ${userId}
    `.then((rows: any[]) => rows[0])

    if (existingCode) {
      return NextResponse.json({
        code: existingCode.code,
        isActive: existingCode.is_active,
      })
    }

    // Generate new unique code
    let code = generateCode()
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const duplicate = await sql`
        SELECT id FROM referral_codes WHERE code = ${code}
      `.then((rows: any[]) => rows[0])
      if (!duplicate) break
      code = generateCode()
      attempts++
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: "Failed to generate unique code" },
        { status: 500 }
      )
    }

    // Insert new code
    await sql`
      INSERT INTO referral_codes (user_id, code) VALUES (${userId}, ${code})
    `

    // Initialize balance record
    await sql`
      INSERT INTO referral_balances (user_id, balance, total_earned, total_withdrawn, referrals_count)
      VALUES (${userId}, 0, 0, 0, 0)
      ON CONFLICT (user_id) DO NOTHING
    `

    return NextResponse.json({ code, isActive: true })
  } catch (error) {
    console.error("[Referral] Code error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
