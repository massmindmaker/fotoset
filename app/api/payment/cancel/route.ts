import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { cancelPayment, type Receipt } from "@/lib/tbank"

export async function POST(request: NextRequest) {
  try {
    const { deviceId, telegramUserId, paymentId, amount, email } = await request.json() as {
      deviceId?: string
      telegramUserId?: number
      paymentId: string
      amount?: number // Optional for partial refund
      email?: string  // Optional - will try to get from DB
    }

    // Validate required fields
    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required" },
        { status: 400 }
      )
    }

    // SECURITY: Require at least one identifier
    if (!telegramUserId && !deviceId) {
      return NextResponse.json(
        { error: "telegramUserId or deviceId is required" },
        { status: 400 }
      )
    }

    // Verify payment belongs to user (support both telegram_user_id and device_id)
    const paymentResult = await sql`
      SELECT p.id, p.amount, p.status, u.id as user_id, u.email as user_email
      FROM payments p
      JOIN users u ON p.user_id = u.id
      WHERE p.tbank_payment_id = ${paymentId}
      AND (
        (${telegramUserId}::bigint IS NOT NULL AND u.telegram_user_id = ${telegramUserId})
        OR
        (${deviceId}::text IS NOT NULL AND u.device_id = ${deviceId})
      )
    `

    if (paymentResult.length === 0) {
      return NextResponse.json(
        { error: "Payment not found or does not belong to user" },
        { status: 404 }
      )
    }

    const payment = paymentResult[0]

    // Check if already canceled
    if (payment.status === 'canceled') {
      return NextResponse.json(
        { error: "Payment already canceled" },
        { status: 400 }
      )
    }

    // Get email for receipt: provided > user's stored > fallback
    const receiptEmail = email?.trim() || payment.user_email || "noreply@pinglass.ru"

    // Create refund receipt with user's email (54-ФЗ compliance)
    const refundAmount = amount || payment.amount
    const receipt: Receipt = {
      Email: receiptEmail,
      Taxation: "usn_income_outcome",
      Items: [{
        Name: "Возврат - PinGlass AI фото",
        Price: Math.round(refundAmount * 100),
        Quantity: 1,
        Amount: Math.round(refundAmount * 100),
        Tax: "none",
        PaymentMethod: "full_payment",
        PaymentObject: "service",
      }],
    }

    console.log("[Payment Cancel] Processing:", {
      paymentId,
      telegramUserId,
      deviceId,
      originalAmount: payment.amount,
      refundAmount,
      receiptEmail,
    })

    // Call T-Bank Cancel API
    const result = await cancelPayment(paymentId, amount, receipt)

    // Update payment status in DB
    await sql`
      UPDATE payments
      SET status = 'canceled', updated_at = NOW()
      WHERE tbank_payment_id = ${paymentId}
    `

    console.log("[Payment Cancel] Success:", {
      paymentId,
      status: result.Status,
      originalAmount: result.OriginalAmount,
      newAmount: result.NewAmount,
    })

    return NextResponse.json({
      success: true,
      status: result.Status,
      originalAmount: result.OriginalAmount,
      newAmount: result.NewAmount,
    })
  } catch (error) {
    console.error("[Payment Cancel] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to cancel payment"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
