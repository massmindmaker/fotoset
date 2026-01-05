import { type NextRequest, NextResponse } from "next/server"
import { sql, query } from "@/lib/db"
import { verifyWebhookSignature } from "@/lib/tbank"
import { paymentLogger as log } from "@/lib/logger"

// Default rates (can be overridden per user)
const DEFAULT_REFERRAL_RATE = 0.10 // 10% for regular referrals
const PARTNER_REFERRAL_RATE = 0.50 // 50% for partners

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
        // Process referral earning
        await processReferralEarning(payment.user_id, paymentId)
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

// Process referral earning when payment succeeds
async function processReferralEarning(userId: number, paymentId: string) {
  console.log(`[Referral] START: Processing for user=${userId}, payment=${paymentId}`)
  try {
    // Check if user was referred (referrals table has: referrer_id, referred_id, created_at)
    const referralResult = await query<{ referrer_id: number }>(
      "SELECT referrer_id FROM referrals WHERE referred_id = $1",
      [userId]
    )

    // DIAGNOSTIC: Log total referrals count
    const totalReferrals = await query("SELECT COUNT(*) as count FROM referrals")
    console.log(`[Referral] Total referrals in DB: ${totalReferrals.rows[0]?.count || 0}`)

    if (referralResult.rows.length === 0) {
      console.log(`[Referral] User ${userId} has no referrer in referrals table - skipping`)
      console.log(`[Referral] TIP: Referral code must be applied via /api/referral/apply or passed in payment create request`)
      return // User has no referrer
    }

    console.log(`[Referral] Found referral: referrer_id=${referralResult.rows[0].referrer_id}`)

    const referrerId = referralResult.rows[0].referrer_id

    // Get referrer's commission rate (partner=50%, regular=10%)
    const rateResult = await query<{ commission_rate: number; is_partner: boolean }>(
      "SELECT commission_rate, is_partner FROM referral_balances WHERE user_id = $1",
      [referrerId]
    )

    // Use partner rate if approved, otherwise default rate
    const commissionRate = rateResult.rows.length > 0 && rateResult.rows[0].is_partner
      ? Number(rateResult.rows[0].commission_rate) || PARTNER_REFERRAL_RATE
      : DEFAULT_REFERRAL_RATE

    console.log(`[Referral] Referrer ${referrerId} commission rate: ${commissionRate * 100}% (partner: ${rateResult.rows[0]?.is_partner || false})`)

    // Get payment amount
    const paymentResult = await query<{ id: number; amount: number }>(
      "SELECT id, amount FROM payments WHERE tbank_payment_id = $1",
      [paymentId]
    )

    if (paymentResult.rows.length === 0) {
      return
    }

    const payment = paymentResult.rows[0]
    const originalAmount = Number(payment.amount)
    const earningAmount = Math.round(originalAmount * commissionRate * 100) / 100

    // ATOMIC: Insert earning with status='confirmed' since payment is already succeeded
    // ON CONFLICT handles race conditions when webhook fires multiple times
    const insertResult = await query<{ id: number }>(
      `INSERT INTO referral_earnings (referrer_id, referred_id, payment_id, amount, original_amount, status)
       VALUES ($1, $2, $3, $4, $5, 'confirmed')
       ON CONFLICT (payment_id) DO UPDATE SET status = 'confirmed'
       RETURNING id`,
      [referrerId, userId, payment.id, earningAmount, originalAmount]
    )

    // If no row returned, earning was already processed (idempotent)
    if (insertResult.rows.length === 0) {
      log.debug(`Earning already processed for payment ${paymentId}`)
      return
    }

    // Update referrer balance atomically
    // NOTE: referrals_count is now incremented at onboarding completion, not here
    await query(
      `INSERT INTO referral_balances (user_id, balance, total_earned, referrals_count, commission_rate)
       VALUES ($1, $2, $2, 0, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         balance = referral_balances.balance + $2,
         total_earned = referral_balances.total_earned + $2,
         updated_at = NOW()`,
      [referrerId, earningAmount, DEFAULT_REFERRAL_RATE]
    )
    log.info(`Credited ${earningAmount} RUB (${commissionRate * 100}%) to user ${referrerId} from payment ${paymentId}`)
  } catch (error) {
    log.error("Error processing earning:", error)
    // Don't throw - referral is not critical for payment success
  }
}
