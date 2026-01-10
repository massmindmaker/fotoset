import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { validateLuhn } from "@/lib/validation"

const MIN_WITHDRAWAL = 5000
const NDFL_RATE = 0.13

// POST: Create withdrawal request
export async function POST(request: NextRequest) {
  try {
    const { telegramUserId, payoutMethod, cardNumber, phone, recipientName } =
      await request.json()

    if (!telegramUserId || !payoutMethod || !recipientName) {
      return NextResponse.json(
        { error: "telegramUserId, payoutMethod, and recipientName required" },
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
          { error: "Неверный номер карты", code: "INVALID_CARD" },
          { status: 400 }
        )
      }
    }

    // Get user by telegram_user_id
    const user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = user.id

    // Mask card number for storage (keep last 4 digits)
    const maskedCard = payoutMethod === "card"
      ? "**** **** **** " + cardNumber.replace(/\s/g, "").slice(-4)
      : null

    const phoneValue = payoutMethod === "sbp" ? phone : null

    // SECURITY FIX: Use FOR UPDATE SKIP LOCKED to prevent race conditions
    // This ensures only one withdrawal request can process at a time per user
    // The lock is held until the transaction commits
    const result = await sql`
      WITH locked_balance AS (
        -- Lock the user's balance row to prevent concurrent withdrawals
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
          error: `Минимальная сумма для вывода ${MIN_WITHDRAWAL} ₽. Доступно: ${available.toFixed(2)} ₽`,
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
      message: "Заявка на вывод создана. Обработка в течение 3 рабочих дней.",
    })
  } catch (error) {
    console.error("[Referral] Withdrawal error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET: Get withdrawal history
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
    console.error("[Referral] Withdrawal history error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
