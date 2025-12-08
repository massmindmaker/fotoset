import { NextRequest, NextResponse } from "next/server"
import { query, ReferralBalance } from "@/lib/db"

const MIN_WITHDRAWAL = 5000
const NDFL_RATE = 0.13

// POST: Create withdrawal request
export async function POST(request: NextRequest) {
  try {
    const { deviceId, payoutMethod, cardNumber, phone, recipientName } =
      await request.json()

    if (!deviceId || !payoutMethod || !recipientName) {
      return NextResponse.json(
        { error: "device_id, payoutMethod, and recipientName required" },
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

    // Get user
    const userResult = await query<{ id: number }>(
      "SELECT id FROM users WHERE device_id = $1",
      [deviceId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = userResult.rows[0].id

    // Get balance
    const balanceResult = await query<ReferralBalance>(
      "SELECT * FROM referral_balances WHERE user_id = $1",
      [userId]
    )

    if (balanceResult.rows.length === 0) {
      return NextResponse.json(
        { error: "No referral balance found" },
        { status: 400 }
      )
    }

    const balance = Number(balanceResult.rows[0].balance)

    // Check pending withdrawals
    const pendingResult = await query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM referral_withdrawals
       WHERE user_id = $1 AND status IN ('pending', 'processing')`,
      [userId]
    )

    const pendingAmount = Number(pendingResult.rows[0]?.total || 0)
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
    const insertResult = await query<{ id: number }>(
      `INSERT INTO referral_withdrawals
       (user_id, amount, ndfl_amount, payout_amount, status, payout_method, card_number, phone, recipient_name)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
       RETURNING id`,
      [
        userId,
        amount,
        ndflAmount,
        payoutAmount,
        payoutMethod,
        maskedCard,
        payoutMethod === "sbp" ? phone : null,
        recipientName.trim(),
      ]
    )

    return NextResponse.json({
      success: true,
      withdrawalId: insertResult.rows[0].id,
      amount,
      ndflAmount,
      payoutAmount,
      message: "Withdrawal request created. Processing within 3 business days.",
    })
  } catch (error) {
    console.error("Withdrawal error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET: Get withdrawal history
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

    // Get withdrawals
    const withdrawalsResult = await query(
      `SELECT id, amount, ndfl_amount, payout_amount, status, payout_method,
              card_number, phone, recipient_name, rejection_reason, created_at, processed_at
       FROM referral_withdrawals
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    )

    return NextResponse.json({
      withdrawals: withdrawalsResult.rows.map((w: any) => ({
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
    console.error("Withdrawal history error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
