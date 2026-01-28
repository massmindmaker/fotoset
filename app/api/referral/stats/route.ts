export const runtime = 'edge'
export const dynamic = 'force-dynamic'

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

// GET: Get partner statistics (Telegram users only)
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

    const user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = user.id

    // Get or create referral code
    let codeResult = await sql`
      SELECT code FROM referral_codes WHERE user_id = ${userId} AND is_active = true
    `.then((rows: any[]) => rows[0])

    let referralCode: string | null = codeResult?.code || null

    // Create referral code if doesn't exist (batch uniqueness check + atomic insert)
    if (!referralCode) {
      // Generate 10 candidates at once, check uniqueness in single query
      const candidates = Array.from({ length: 10 }, () => generateCode())
      const existing = await sql`
        SELECT code FROM referral_codes WHERE code = ANY(${candidates})
      `
      const existingCodes = new Set(existing.map((r: { code: string }) => r.code))
      const uniqueCode = candidates.find(c => !existingCodes.has(c))

      if (uniqueCode) {
        // Atomic insert with conflict handling to prevent race condition
        const inserted = await sql`
          INSERT INTO referral_codes (user_id, code, is_active)
          VALUES (${userId}, ${uniqueCode}, true)
          ON CONFLICT (user_id) WHERE is_active = true DO NOTHING
          RETURNING code
        `
        if (inserted.length > 0) {
          referralCode = inserted[0].code
        } else {
          // Race condition: another request created it, re-fetch
          const refetch = await sql`
            SELECT code FROM referral_codes WHERE user_id = ${userId} AND is_active = true
          `.then((rows: any[]) => rows[0])
          referralCode = refetch?.code || null
        }
      }
    }

    // Get or create balance record (atomic insert to prevent race condition)
    let balanceResult = await sql`
      SELECT * FROM referral_balances WHERE user_id = ${userId}
    `.then((rows: any[]) => rows[0])

    if (!balanceResult) {
      // Atomic insert with conflict handling
      await sql`
        INSERT INTO referral_balances (user_id, balance, total_earned, total_withdrawn, referrals_count)
        VALUES (${userId}, 0, 0, 0, 0)
        ON CONFLICT (user_id) DO NOTHING
      `
      // Re-fetch to handle race condition
      balanceResult = await sql`
        SELECT * FROM referral_balances WHERE user_id = ${userId}
      `.then((rows: any[]) => rows[0]) || { balance: 0, total_earned: 0, total_withdrawn: 0, referrals_count: 0 }
    }

    const balance = balanceResult

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
    `.then((rows: any[]) => rows[0])

    const pendingWithdrawal = Number(pendingResult?.total || 0)
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
    console.error("[Referral] Stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
