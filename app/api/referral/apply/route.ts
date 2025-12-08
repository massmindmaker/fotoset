import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// POST: Apply referral code to new user
export async function POST(request: NextRequest) {
  try {
    const { deviceId, referralCode } = await request.json()

    if (!deviceId || !referralCode) {
      return NextResponse.json(
        { error: "device_id and referralCode required" },
        { status: 400 }
      )
    }

    const code = referralCode.toUpperCase().trim()

    // Get referred user
    const userResult = await query<{ id: number }>(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const referredId = userResult.rows[0].id

    // Check if already referred
    const existingReferral = await query(
      "SELECT id FROM referrals WHERE referred_id = $1",
      [referredId]
    )

    if (existingReferral.rows.length > 0) {
      return NextResponse.json(
        { error: "User already has a referrer", code: "ALREADY_REFERRED" },
        { status: 400 }
      )
    }

    // Find referral code and owner
    const codeResult = await query<{ user_id: number; is_active: boolean }>(
      "SELECT user_id, is_active FROM referral_codes WHERE code = $1",
      [code]
    )

    if (codeResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid referral code", code: "INVALID_CODE" },
        { status: 400 }
      )
    }

    if (!codeResult.rows[0].is_active) {
      return NextResponse.json(
        { error: "Referral code is inactive", code: "INACTIVE_CODE" },
        { status: 400 }
      )
    }

    const referrerId = codeResult.rows[0].user_id

    // Can't refer yourself
    if (referrerId === referredId) {
      return NextResponse.json(
        { error: "Cannot use your own referral code", code: "SELF_REFERRAL" },
        { status: 400 }
      )
    }

    // Create referral link
    await query(
      `INSERT INTO referrals (referrer_id, referred_id, referral_code)
       VALUES ($1, $2, $3)`,
      [referrerId, referredId, code]
    )

    // Update referrer's count
    await query(
      `UPDATE referral_balances
       SET referrals_count = referrals_count + 1, updated_at = NOW()
       WHERE user_id = $1`,
      [referrerId]
    )

    return NextResponse.json({
      success: true,
      message: "Referral code applied successfully",
    })
  } catch (error) {
    console.error("Apply referral error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
