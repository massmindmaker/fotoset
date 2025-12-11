import { type NextRequest, NextResponse } from "next/server"
import { sql, query } from "@/lib/db"
import { verifyWebhookSignature } from "@/lib/tbank"

const REFERRAL_RATE = 0.10 // 10% партнёру

// Webhook from T-Bank
export async function POST(request: NextRequest) {
  try {
    const notification = await request.json()

    // Log incoming webhook (without sensitive data)
    console.log("[T-Bank Webhook] Received:", {
      status: notification.Status,
      paymentId: notification.PaymentId,
      orderId: notification.OrderId,
      amount: notification.Amount,
      errorCode: notification.ErrorCode,
    })

    // Verify webhook signature
    const receivedToken = notification.Token || ""
    const isValid = verifyWebhookSignature(notification, receivedToken)

    if (!isValid) {
      console.error("[T-Bank Webhook] Invalid signature for payment:", notification.PaymentId)
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    const paymentId = notification.PaymentId
    const status = notification.Status

    // T-Bank statuses: NEW, CONFIRMED, REJECTED, AUTHORIZED, PARTIAL_REFUNDED, REFUNDED
    if (status === "CONFIRMED" || status === "AUTHORIZED") {
      console.log("[T-Bank Webhook] Payment confirmed:", paymentId)

      // Update payment status
      await sql`
        UPDATE payments
        SET status = 'succeeded', updated_at = NOW()
        WHERE yookassa_payment_id = ${paymentId}
      `

      // Get payment for referral program
      const payment = await sql`
        SELECT user_id FROM payments
        WHERE yookassa_payment_id = ${paymentId}
      `.then((rows) => rows[0])

      if (payment) {
        // Process referral earning
        await processReferralEarning(payment.user_id, paymentId)
      }
    } else if (status === "REJECTED") {
      console.log("[T-Bank Webhook] Payment rejected:", paymentId)

      await sql`
        UPDATE payments
        SET status = 'canceled', updated_at = NOW()
        WHERE yookassa_payment_id = ${paymentId}
      `
    } else {
      console.log("[T-Bank Webhook] Unhandled status:", status, "for payment:", paymentId)
    }

    // T-Bank expects "OK" response to confirm receipt
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("[T-Bank Webhook] Error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

// Process referral earning when payment succeeds
async function processReferralEarning(userId: number, paymentId: string) {
  try {
    // Check if user was referred
    const referralResult = await query<{ referrer_id: number }>(
      "SELECT referrer_id FROM referrals WHERE referred_id = $1",
      [userId]
    )

    if (referralResult.rows.length === 0) {
      return // User has no referrer
    }

    const referrerId = referralResult.rows[0].referrer_id

    // Get payment amount
    const paymentResult = await query<{ id: number; amount: number }>(
      "SELECT id, amount FROM payments WHERE yookassa_payment_id = $1",
      [paymentId]
    )

    if (paymentResult.rows.length === 0) {
      return
    }

    const payment = paymentResult.rows[0]
    const originalAmount = Number(payment.amount)
    const earningAmount = Math.round(originalAmount * REFERRAL_RATE * 100) / 100

    // ATOMIC: Insert earning with ON CONFLICT to prevent duplicates
    // This handles race conditions when webhook fires multiple times
    const insertResult = await query<{ id: number }>(
      `INSERT INTO referral_earnings (referrer_id, referred_id, payment_id, amount, original_amount)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (payment_id) DO NOTHING
       RETURNING id`,
      [referrerId, userId, payment.id, earningAmount, originalAmount]
    )

    // If no row returned, earning was already processed (idempotent)
    if (insertResult.rows.length === 0) {
      console.log(`[Referral] Earning already processed for payment ${paymentId}`)
      return
    }

    // Update referrer balance atomically
    await query(
      `INSERT INTO referral_balances (user_id, balance, total_earned, referrals_count)
       VALUES ($1, $2, $2, 0)
       ON CONFLICT (user_id) DO UPDATE SET
         balance = referral_balances.balance + $2,
         total_earned = referral_balances.total_earned + $2,
         updated_at = NOW()`,
      [referrerId, earningAmount]
    )

    console.log(`[Referral] Credited ${earningAmount} RUB to user ${referrerId} from payment ${paymentId}`)
  } catch (error) {
    console.error("[Referral] Error processing earning:", error)
    // Don't throw - referral is not critical for payment success
  }
}
