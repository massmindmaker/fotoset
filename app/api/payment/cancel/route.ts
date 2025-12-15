import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { cancelPayment, type Receipt } from "@/lib/tbank"

export async function POST(request: NextRequest) {
  try {
    const { deviceId, paymentId, amount } = await request.json() as {
      deviceId: string
      paymentId: string
      amount?: number // Optional for partial refund
    }

    // Validate required fields
    if (!deviceId || !paymentId) {
      return NextResponse.json(
        { error: "deviceId and paymentId are required" },
        { status: 400 }
      )
    }

    // Verify payment belongs to user
    const paymentResult = await sql`
      SELECT p.id, p.amount, p.status, u.id as user_id
      FROM payments p
      JOIN users u ON p.user_id = u.id
      WHERE p.tbank_payment_id = ${paymentId}
      AND u.device_id = ${deviceId}
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

    // Create refund receipt
    const refundAmount = amount || payment.amount
    const receipt: Receipt = {
      Email: "noreply@pinglass.ru",
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
      deviceId,
      originalAmount: payment.amount,
      refundAmount,
    })

    // Call T-Bank Cancel API
    const result = await cancelPayment(paymentId, amount, receipt)

    // Update payment status in DB
    await sql`
      UPDATE payments
      SET status = 'canceled', updated_at = NOW()
      WHERE tbank_payment_id = ${paymentId}
    `

    // Update user pro status if needed
    await sql`
      UPDATE users
      SET is_pro = false, updated_at = NOW()
      WHERE id = ${payment.user_id}
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
