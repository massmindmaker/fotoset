import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

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
    const deviceId = request.nextUrl.searchParams.get("device_id")

    if (!deviceId) {
      return NextResponse.json({ error: "device_id required" }, { status: 400 })
    }

    // Get user
    const userResult = await query<{ id: number }>(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = userResult.rows[0].id

    // Check existing code
    const existingCode = await query<{ code: string; is_active: boolean }>(
      "SELECT code, is_active FROM referral_codes WHERE user_id = $1",
      [userId]
    )

    if (existingCode.rows.length > 0) {
      return NextResponse.json({
        code: existingCode.rows[0].code,
        isActive: existingCode.rows[0].is_active,
      })
    }

    // Generate new unique code
    let code = generateCode()
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const duplicate = await query(
        "SELECT id FROM referral_codes WHERE code = $1",
        [code]
      )
      if (duplicate.rows.length === 0) break
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
    await query(
      "INSERT INTO referral_codes (user_id, code) VALUES ($1, $2)",
      [userId, code]
    )

    // Initialize balance record
    await query(
      `INSERT INTO referral_balances (user_id, balance, total_earned, total_withdrawn, referrals_count)
       VALUES ($1, 0, 0, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    )

    return NextResponse.json({ code, isActive: true })
  } catch (error) {
    console.error("Referral code error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
