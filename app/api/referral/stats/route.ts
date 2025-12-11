import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

const MIN_WITHDRAWAL = 5000 // Минимум для вывода
const NDFL_RATE = 0.13 // НДФЛ 13%

// Generate unique referral code
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // No 0,O,1,I for clarity
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// GET: Get partner statistics
export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get("device_id")

    if (!deviceId) {
      return NextResponse.json({ error: "device_id required" }, { status: 400 })
    }

    // Get or create user
    let userResult = await sql`
      SELECT id FROM users WHERE device_id = ${deviceId}
    `

    let userId: number

    if (userResult.length === 0) {
      // Create new user
      const newUser = await sql`
        INSERT INTO users (device_id) VALUES (${deviceId})
        RETURNING id
      `
      userId = newUser[0].id
      console.log(`[Referral] Created new user ${userId} for device ${deviceId}`)
    } else {
      userId = userResult[0].id
    }

    // Get or create referral code
    let codeResult = await sql`
      SELECT code FROM referral_codes WHERE user_id = ${userId} AND is_active = true
    `

    let referralCode: string | null = codeResult[0]?.code || null

    // Create referral code if doesn't exist
    if (!referralCode) {
      let code = generateCode()
      let attempts = 0
      const maxAttempts = 10

      // Ensure unique code
      while (attempts < maxAttempts) {
        const duplicate = await sql`SELECT id FROM referral_codes WHERE code = ${code}`
        if (duplicate.length === 0) break
        code = generateCode()
        attempts++
      }

      if (attempts < maxAttempts) {
        await sql`INSERT INTO referral_codes (user_id, code, is_active) VALUES (${userId}, ${code}, true)`
        referralCode = code
        console.log(`[Referral] Created code ${code} for user ${userId}`)
      }
    }

    // Get or create balance record
    let balanceResult = await sql`
      SELECT * FROM referral_balances WHERE user_id = ${userId}
    `

    if (balanceResult.length === 0) {
      await sql`
        INSERT INTO referral_balances (user_id, balance, total_earned, total_withdrawn, referrals_count)
        VALUES (${userId}, 0, 0, 0, 0)
      `
      balanceResult = [{ balance: 0, total_earned: 0, total_withdrawn: 0, referrals_count: 0 }]
    }

    const balance = balanceResult[0]

    // Get recent referrals (last 10)
    const referralsResult = await sql`
      SELECT r.id, r.created_at,
             COALESCE(SUM(e.amount), 0) as total_earned
      FROM referrals r
      LEFT JOIN referral_earnings e ON e.referred_id = r.referred_id
      WHERE r.referrer_id = ${userId}
      GROUP BY r.id, r.created_at
      ORDER BY r.created_at DESC
      LIMIT 10
    `

    // Get pending withdrawals
    const pendingResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM referral_withdrawals
      WHERE user_id = ${userId} AND status IN ('pending', 'processing')
    `

    const pendingWithdrawal = Number(pendingResult[0]?.total || 0)
    const availableBalance = Number(balance.balance) - pendingWithdrawal
    const canWithdraw = availableBalance >= MIN_WITHDRAWAL

    // Calculate payout preview
    const ndflAmount = Math.round(availableBalance * NDFL_RATE * 100) / 100
    const payoutAmount = availableBalance - ndflAmount

    return NextResponse.json({
      success: true,
      code: referralCode,
      balance: Number(balance.balance),
      availableBalance,
      totalEarned: Number(balance.total_earned),
      totalWithdrawn: Number(balance.total_withdrawn),
      referralsCount: balance.referrals_count,
      pendingWithdrawal,
      canWithdraw,
      minWithdrawal: MIN_WITHDRAWAL,
      payoutPreview: canWithdraw
        ? {
            amount: availableBalance,
            ndfl: ndflAmount,
            payout: payoutAmount,
          }
        : null,
      recentReferrals: referralsResult.map((r: any) => ({
        id: r.id,
        date: r.created_at,
        earned: Number(r.total_earned),
      })),
    })
  } catch (error) {
    console.error("Referral stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
