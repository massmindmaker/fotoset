import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { extractIdentifierFromRequest, findUserByIdentifier } from "@/lib/user-identity"

// POST: Apply referral code to new user
export async function POST(request: NextRequest) {
  console.log("[Referral Apply] === START ===")

  try {
    const { telegramUserId, neonUserId, referralCode } = await request.json()
    console.log("[Referral Apply] Request:", { telegramUserId, neonUserId, referralCode })

    if ((!telegramUserId && !neonUserId) || !referralCode) {
      console.log("[Referral Apply] FAIL: Missing required fields")
      return NextResponse.json(
        { error: "telegramUserId or neonUserId, and referralCode required" },
        { status: 400 }
      )
    }

    const code = referralCode.toUpperCase().trim()
    console.log("[Referral Apply] Normalized code:", code)

    // Get referred user (supports both Telegram and Web users)
    const identifier = extractIdentifierFromRequest({
      telegram_user_id: telegramUserId,
      neon_user_id: neonUserId
    })

    const user = await findUserByIdentifier(identifier)

    if (!user) {
      console.log("[Referral Apply] FAIL: User not found for identifier:", identifier)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const referredId = user.id
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

    // Find referral code and owner (supports both Telegram and Web codes)
    const codeResult = await query<{ user_id: number }>(
      `SELECT user_id
       FROM referral_balances
       WHERE referral_code_telegram = $1 OR referral_code_web = $1
       LIMIT 1`,
      [code]
    )

    if (codeResult.rows.length === 0) {
      console.log("[Referral Apply] FAIL: Invalid code, not found in DB:", code)
      return NextResponse.json(
        { error: "Invalid referral code", code: "INVALID_CODE" },
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
