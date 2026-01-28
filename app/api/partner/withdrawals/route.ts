/**
 * Partner Withdrawals API
 *
 * GET: List withdrawals history
 * POST: Create withdrawal request
 *
 * Authentication methods (in priority order):
 * 1. Partner session cookie (for web login)
 * 2. telegram_user_id query param (for Telegram WebApp)
 * 3. neon_user_id query param (for Neon Auth)
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { validateLuhn } from "@/lib/validation"
import { extractIdentifierFromRequest, findUserByIdentifier } from "@/lib/user-identity"
import { getCurrentPartnerSession } from "@/lib/partner/session"

const MIN_WITHDRAWAL = 5000
const NDFL_RATE = 0.13

// Helper function to get authenticated user ID
async function getAuthenticatedUserId(request: NextRequest): Promise<number | null> {
  // Priority 1: Get userId from partner session cookie (with timeout)
  try {
    const sessionPromise = getCurrentPartnerSession()
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    const session = await Promise.race([sessionPromise, timeoutPromise])
    if (session?.userId) {
      return session.userId
    }
  } catch (e) {
    console.error('[Partner Withdrawals] Session check error:', e)
    // Session check failed, continue with query params
  }

  // Priority 2: Get from query params (Telegram/Neon auth)
  const { searchParams } = new URL(request.url)
  const telegramUserId = searchParams.get('telegram_user_id')
  const neonUserId = searchParams.get('neon_auth_id') || searchParams.get('neon_user_id')

  if (telegramUserId || neonUserId) {
    const identifier = extractIdentifierFromRequest({
      telegram_user_id: telegramUserId,
      neon_auth_id: neonUserId
    })
    const user = await findUserByIdentifier(identifier)
    if (user) {
      return user.id
    }
  }

  return null
}

// GET: Get withdrawal history
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Get withdrawals
    const withdrawalsResult = await sql`
      SELECT id, amount, ndfl_amount, payout_amount, status, payout_method,
             card_number, phone, recipient_name, rejection_reason, created_at, processed_at
      FROM referral_withdrawals
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    `

    return NextResponse.json({
      withdrawals: withdrawalsResult.map((w: any) => ({
        id: w.id,
        amount: Number(w.amount),
        ndflAmount: Number(w.ndfl_amount),
        payoutAmount: Number(w.payout_amount),
        status: w.status,
        method: w.payout_method,
        cardNumber: w.card_number,
        phone: w.phone,
        recipientName: w.recipient_name,
        rejectionReason: w.rejection_reason,
        createdAt: w.created_at,
        processedAt: w.processed_at,
      })),
    })
  } catch (error) {
    console.error("[Partner Withdrawals] GET error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
      },
      { status: 500 }
    )
  }
}

// POST: Create withdrawal request
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { payoutMethod, cardNumber, phone, recipientName } = await request.json()

    if (!payoutMethod || !recipientName) {
      return NextResponse.json(
        { error: "payoutMethod and recipientName required" },
        { status: 400 }
      )
    }

    if (payoutMethod === "card" && !cardNumber) {
      return NextResponse.json(
        { error: "Card number required for card payout" },
        { status: 400 }
      )
    }

    if (payoutMethod === "sbp" && !phone) {
      return NextResponse.json(
        { error: "Phone number required for SBP payout" },
        { status: 400 }
      )
    }

    // Validate card number with Luhn algorithm
    if (payoutMethod === "card") {
      const cleanCard = cardNumber.replace(/\s/g, "")
      if (!/^\d{16,19}$/.test(cleanCard)) {
        return NextResponse.json(
          { error: "Invalid card number format" },
          { status: 400 }
        )
      }
      if (!validateLuhn(cleanCard)) {
        return NextResponse.json(
          { error: "Invalid card number", code: "INVALID_CARD" },
          { status: 400 }
        )
      }
    }

    // Mask card number for storage (keep last 4 digits)
    const maskedCard = payoutMethod === "card"
      ? "**** **** **** " + cardNumber.replace(/\s/g, "").slice(-4)
      : null

    const phoneValue = payoutMethod === "sbp" ? phone : null

    // SECURITY: Use FOR UPDATE SKIP LOCKED to prevent race conditions
    const result = await sql`
      WITH locked_balance AS (
        SELECT
          rb.balance,
          rb.user_id
        FROM referral_balances rb
        WHERE rb.user_id = ${userId}
        FOR UPDATE SKIP LOCKED
      ),
      pending_total AS (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM referral_withdrawals
        WHERE user_id = ${userId} AND status IN ('pending', 'processing')
      ),
      available AS (
        SELECT
          lb.balance - pt.total as available_amount,
          lb.user_id,
          lb.balance
        FROM locked_balance lb
        CROSS JOIN pending_total pt
      ),
      create_withdrawal AS (
        INSERT INTO referral_withdrawals
        (user_id, amount, ndfl_amount, payout_amount, status, payout_method, card_number, phone, recipient_name)
        SELECT
          ${userId},
          available_amount,
          ROUND(available_amount * ${NDFL_RATE}, 2),
          ROUND(available_amount * ${1 - NDFL_RATE}, 2),
          'pending',
          ${payoutMethod},
          ${maskedCard},
          ${phoneValue},
          ${recipientName.trim()}
        FROM available
        WHERE available_amount >= ${MIN_WITHDRAWAL}
        RETURNING id, amount, ndfl_amount, payout_amount
      )
      SELECT * FROM create_withdrawal
    `

    if (result.length === 0) {
      // Get current balance for error message
      const balanceInfo = await sql`
        SELECT
          rb.balance,
          COALESCE(pending.total, 0) as pending
        FROM referral_balances rb
        LEFT JOIN (
          SELECT user_id, SUM(amount) as total
          FROM referral_withdrawals
          WHERE user_id = ${userId} AND status IN ('pending', 'processing')
          GROUP BY user_id
        ) pending ON pending.user_id = rb.user_id
        WHERE rb.user_id = ${userId}
      `.then((rows: any[]) => rows[0])

      const available = balanceInfo
        ? Number(balanceInfo.balance) - Number(balanceInfo.pending)
        : 0

      return NextResponse.json(
        {
          error: `Minimum withdrawal is ${MIN_WITHDRAWAL} RUB. Available: ${available.toFixed(2)} RUB`,
          code: "INSUFFICIENT_BALANCE",
        },
        { status: 400 }
      )
    }

    const withdrawal = result[0]

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawal.id,
      amount: Number(withdrawal.amount),
      ndflAmount: Number(withdrawal.ndfl_amount),
      payoutAmount: Number(withdrawal.payout_amount),
      message: "Withdrawal request created. Processing within 3 business days.",
    })
  } catch (error) {
    console.error("[Partner Withdrawals] POST error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
