import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// POST: Apply referral code to new user
export async function POST(request: NextRequest) {
  console.log("[Referral Apply] === START ===")

  try {
    const { telegramUserId, referralCode } = await request.json()
    console.log("[Referral Apply] Request:", { telegramUserId, referralCode })

    if (!telegramUserId || !referralCode) {
      console.log("[Referral Apply] FAIL: Missing required fields")
      return NextResponse.json(
        { error: "telegram_user_id and referralCode required" },
        { status: 400 }
      )
    }

    const code = referralCode.toUpperCase().trim()
    console.log("[Referral Apply] Normalized code:", code)

    // Get referred user
    const userResult = await query<{ id: number }>(
      "SELECT id FROM users WHERE telegram_user_id = $1",
      [telegramUserId]
    )

    if (userResult.rows.length === 0) {
      console.log("[Referral Apply] FAIL: User not found for telegramUserId:", telegramUserId)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const referredId = userResult.rows[0].id
    console.log("[Referral Apply] Found user, DB ID:", referredId)

    // Check if already referred
    const existingReferral = await query(
      "SELECT id FROM referrals WHERE referred_id = $1",
      [referredId]
    )

    if (existingReferral.rows.length > 0) {
      console.log("[Referral Apply] FAIL: User already has referrer, referral ID:", existingReferral.rows[0].id)
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
      console.log("[Referral Apply] FAIL: Invalid code, not found in DB:", code)
      return NextResponse.json(
        { error: "Invalid referral code", code: "INVALID_CODE" },
        { status: 400 }
      )
    }

    if (!codeResult.rows[0].is_active) {
      console.log("[Referral Apply] FAIL: Code is inactive:", code)
      return NextResponse.json(
        { error: "Referral code is inactive", code: "INACTIVE_CODE" },
        { status: 400 }
      )
    }

    const referrerId = codeResult.rows[0].user_id
    console.log("[Referral Apply] Found referrer, DB ID:", referrerId)

    // Can't refer yourself
    if (referrerId === referredId) {
      console.log("[Referral Apply] FAIL: Self-referral attempt")
      return NextResponse.json(
        { error: "Cannot use your own referral code", code: "SELF_REFERRAL" },
        { status: 400 }
      )
    }

    // Create referral link in referrals table
    // NOTE: This is used when user applies code manually (not via startapp param)
    await query(
      `INSERT INTO referrals (referrer_id, referred_id)
       VALUES ($1, $2)`,
      [referrerId, referredId]
    )

    // Increment referrer's referrals_count atomically
    await query(
      `INSERT INTO referral_balances (user_id, referrals_count, balance)
       VALUES ($1, 1, 0)
       ON CONFLICT (user_id)
       DO UPDATE SET referrals_count = referral_balances.referrals_count + 1`,
      [referrerId]
    )

    console.log("[Referral Apply] SUCCESS: Created referral link + incremented count", {
      referrerId,
      referredId,
      code,
    })
    console.log("[Referral Apply] === END ===")

    return NextResponse.json({
      success: true,
      message: "Referral code applied successfully",
    })
  } catch (error) {
    console.error("[Referral Apply] ERROR:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
