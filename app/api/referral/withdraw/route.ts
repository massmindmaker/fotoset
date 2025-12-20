import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

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

    // Validate card number format
    if (payoutMethod === "card") {
      const cleanCard = cardNumber.replace(/\s/g, "")
      if (!/^\d{16,19}$/.test(cleanCard)) {
        return NextResponse.json(
          { error: "Invalid card number format" },
          { status: 400 }
        )
      }
    }

    // Get user by telegram_user_id
    const user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then(rows => rows[0])

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = user.id

    // Get balance
    const balanceResult = await sql`
      SELECT * FROM referral_balances WHERE user_id = ${userId}
    `.then(rows => rows[0])

    if (!balanceResult) {
      return NextResponse.json(
        { error: "No referral balance found" },
        { status: 400 }
      )
    }

    const balance = Number(balanceResult.balance)

    // Check pending withdrawals
    const pendingResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM referral_withdrawals
      WHERE user_id = ${userId} AND status IN ('pending', 'processing')
    `.then(rows => rows[0])

    const pendingAmount = Number(pendingResult?.total || 0)
    const availableBalance = balance - pendingAmount

    if (availableBalance < MIN_WITHDRAWAL) {
      return NextResponse.json(
        {
          error: `Minimum withdrawal is ${MIN_WITHDRAWAL} RUB. Available: ${availableBalance} RUB`,
          code: "INSUFFICIENT_BALANCE",
        },
        { status: 400 }
      )
    }

    // Calculate amounts
    const amount = availableBalance
    const ndflAmount = Math.round(amount * NDFL_RATE * 100) / 100
    const payoutAmount = amount - ndflAmount

    // Mask card number for storage (keep last 4 digits)
    const maskedCard = payoutMethod === "card"
      ? "**** **** **** " + cardNumber.replace(/\s/g, "").slice(-4)
      : null

    // Create withdrawal request
    const insertResult = await sql`
      INSERT INTO referral_withdrawals
      (user_id, amount, ndfl_amount, payout_amount, status, payout_method, card_number, phone, recipient_name)
      VALUES (${userId}, ${amount}, ${ndflAmount}, ${payoutAmount}, 'pending', ${payoutMethod}, ${maskedCard}, ${payoutMethod === "sbp" ? phone : null}, ${recipientName.trim()})
      RETURNING id
    `.then(rows => rows[0])

    return NextResponse.json({
      success: true,
      withdrawalId: insertResult.id,
      amount,
      ndflAmount,
      payoutAmount,
      message: "Withdrawal request created. Processing within 3 business days.",
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
    `.then(rows => rows[0])

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
