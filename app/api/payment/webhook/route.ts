import { type NextRequest, NextResponse } from "next/server"
import { sql, query } from "@/lib/db"
import { verifyWebhookSignature } from "@/lib/tbank"
import { paymentLogger as log } from "@/lib/logger"
import { processReferralEarning } from "@/lib/referral-earnings"

// Webhook from T-Bank
export async function POST(request: NextRequest) {
  try {
    const notification = await request.json()

    // Log incoming webhook (without sensitive data)
    log.debug(" Received:", {
      status: notification.Status,
      paymentId: notification.PaymentId,
      orderId: notification.OrderId,
      amount: notification.Amount,
      errorCode: notification.ErrorCode,
    })

    // Save webhook to database for diagnostics (non-blocking)
    // Using proper JSONB cast to prevent SQL injection
    sql`
      INSERT INTO webhook_logs (source, event_type, payload)
      VALUES ('tbank', ${notification.Status || 'unknown'}, ${JSON.stringify(notification)}::jsonb)
    `.catch((err: unknown) => log.error(" Failed to save:", err))

    // Verify webhook signature
    const receivedToken = notification.Token || ""
    const isValid = verifyWebhookSignature(notification, receivedToken)

    if (!isValid) {
      log.error(" Invalid signature for payment:", notification.PaymentId)
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    const paymentId = notification.PaymentId
    const status = notification.Status

    // SECURITY: Validate payment exists in our database before processing
    const existingPayment = await sql`
      SELECT id, user_id, status FROM payments WHERE tbank_payment_id = ${paymentId}
    `
    if (existingPayment.length === 0) {
      log.error(" Unknown payment ID (not in our DB):", paymentId)
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // T-Bank statuses: NEW, CONFIRMED, REJECTED, AUTHORIZED, PARTIAL_REFUNDED, REFUNDED
    if (status === "CONFIRMED" || status === "AUTHORIZED") {
      log.debug(" Payment confirmed:", paymentId)

      // Idempotent update: only update if status is still pending
      // This prevents race conditions from duplicate webhook calls
      const updateResult = await sql`
        UPDATE payments
        SET status = 'succeeded', updated_at = NOW()
        WHERE tbank_payment_id = ${paymentId} AND status = 'pending'
        RETURNING id, user_id
      `

      if (updateResult.length === 0) {
        // Payment was already processed - this is a duplicate webhook
        log.debug(" Payment already processed (duplicate webhook):", paymentId)
        return NextResponse.json({ success: true }, { status: 200 })
      }

      const payment = updateResult[0]

      if (payment) {
        // Process referral earning using universal function
        await processReferralEarning(payment.id, payment.user_id)
      }
    } else if (status === "REJECTED") {
      log.debug(" Payment rejected:", paymentId)

      await sql`
        UPDATE payments
        SET status = 'canceled', updated_at = NOW()
        WHERE tbank_payment_id = ${paymentId}
      `
    } else if (status === "PARTIAL_REFUNDED" || status === "REFUNDED") {
      // Handle refund status from T-Bank (sync from their side)
      log.info(" Payment refunded via T-Bank:", { paymentId, status })

      await sql`
        UPDATE payments
        SET status = 'refunded', updated_at = NOW()
        WHERE tbank_payment_id = ${paymentId}
      `
    } else if (status === "CANCELED") {
      log.debug(" Payment canceled:", paymentId)

      await sql`
        UPDATE payments
        SET status = 'canceled', updated_at = NOW()
        WHERE tbank_payment_id = ${paymentId}
      `
    } else {
      log.debug(" Unhandled status:", status, "for payment:", paymentId)
    }

    // T-Bank expects "OK" response to confirm receipt
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    log.error(" Error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
