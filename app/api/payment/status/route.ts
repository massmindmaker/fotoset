import { type NextRequest, NextResponse } from "next/server"
import { sql, query } from "@/lib/db"
import { getPaymentState } from "@/lib/tbank"
import { findOrCreateUser } from "@/lib/user-identity"
import { paymentLogger as log } from "@/lib/logger"

const REFERRAL_RATE = 0.10 // 10% партнёру

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserId = searchParams.get("telegram_user_id")
    let paymentId = searchParams.get("payment_id")

    log.debug(" Check:", {
      telegramUserId,
      paymentId,
    })

    // SECURITY: Require telegramUserId (Telegram-only authentication)
    if (!telegramUserId || telegramUserId.trim().length === 0) {
      return NextResponse.json({ error: "telegram_user_id is required" }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      log.warn(" DATABASE_URL not configured, using test mode")
      return NextResponse.json({ paid: false, status: "pending", testMode: true })
    }

    // Find or create user (Telegram-only)
    let user
    try {
      user = await findOrCreateUser({
        telegramUserId: parseInt(telegramUserId)
      })
    } catch (dbError) {
      log.error(" Database error:", dbError)
      return NextResponse.json({ paid: false, status: "pending", error: "db_unavailable" })
    }

    // FIX: If no paymentId provided, find the latest pending payment for this user
    if (!paymentId) {
      try {
        const latestPayment = await sql`
          SELECT tbank_payment_id, status FROM payments 
          WHERE user_id = ${user.id} 
          ORDER BY created_at DESC 
          LIMIT 1
        `.then((rows: any[]) => rows[0])
        
        if (latestPayment) {
          paymentId = latestPayment.tbank_payment_id
          // If already succeeded in DB, return immediately
          if (latestPayment.status === 'succeeded') {
            return NextResponse.json({ paid: true, status: "succeeded" })
          }
        } else {
          return NextResponse.json({ paid: false, status: "no_payment" })
        }
      } catch (err) {
        log.error(" Error finding latest payment:", err)
        return NextResponse.json({ paid: false, status: "pending" })
      }
    }

    // Проверяем статус платежа в T-Bank
    try {
      const payment = await getPaymentState(paymentId!)

      if (payment.Status === "CONFIRMED" || payment.Status === "AUTHORIZED") {
        // IDEMPOTENT: Only update if not already succeeded (prevents race with webhook)
        const updateResult = await sql`
          UPDATE payments SET status = 'succeeded', updated_at = NOW()
          WHERE tbank_payment_id = ${paymentId} AND status != 'succeeded'
          RETURNING id, user_id
        `

        // Process referral earning if we actually updated the status
        // (prevents double-crediting if webhook already processed it)
        if (updateResult.length > 0) {
          const updatedPayment = updateResult[0]
          await processReferralEarning(updatedPayment.user_id, paymentId!)
        }

        return NextResponse.json({ paid: true, status: "succeeded" })
      }

      return NextResponse.json({ paid: false, status: payment.Status?.toLowerCase() || "pending" })
    } catch {
      // Проверяем статус платежа в БД если T-Bank недоступен
      const dbPayment = await sql`
        SELECT status FROM payments WHERE tbank_payment_id = ${paymentId}
      `.then((rows: any[]) => rows[0])

      if (dbPayment?.status === 'succeeded') {
        return NextResponse.json({ paid: true, status: "succeeded" })
      }
      return NextResponse.json({ paid: false, status: "pending" })
    }
  } catch (error) {
    log.error("Status check error:", error)
    return NextResponse.json({ paid: false, status: "pending", error: "check_failed" })
  }
}

// Process referral earning when payment succeeds
// Copied from webhook/route.ts to handle case when status endpoint processes payment first
async function processReferralEarning(userId: number, paymentId: string) {
  console.log(`[Referral/Status] START: Processing for user=${userId}, payment=${paymentId}`)
  try {
    // Check if user was referred (referrals table has: referrer_id, referred_id, created_at)
    const referralResult = await query<{ referrer_id: number }>(
      "SELECT referrer_id FROM referrals WHERE referred_id = $1",
      [userId]
    )

    if (referralResult.rows.length === 0) {
      console.log(`[Referral/Status] User ${userId} has no referrer - skipping`)
      return
    }

    console.log(`[Referral/Status] Found referral: referrer_id=${referralResult.rows[0].referrer_id}`)

    const referrerId = referralResult.rows[0].referrer_id

    // Get payment amount from our DB
    const paymentResult = await query<{ id: number; amount: number }>(
      "SELECT id, amount FROM payments WHERE tbank_payment_id = $1",
      [paymentId]
    )

    if (paymentResult.rows.length === 0) {
      console.log(`[Referral/Status] Payment not found in DB: ${paymentId}`)
      return
    }

    const payment = paymentResult.rows[0]
    const originalAmount = Number(payment.amount)
    const earningAmount = Math.round(originalAmount * REFERRAL_RATE * 100) / 100

    // ATOMIC: Insert earning with ON CONFLICT to prevent duplicates
    const insertResult = await query<{ id: number }>(
      `INSERT INTO referral_earnings (referrer_id, referred_id, payment_id, amount, original_amount)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (payment_id) DO NOTHING
       RETURNING id`,
      [referrerId, userId, payment.id, earningAmount, originalAmount]
    )

    // If no row returned, earning was already processed (idempotent)
    if (insertResult.rows.length === 0) {
      console.log(`[Referral/Status] Earning already processed for payment ${paymentId}`)
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
    console.log(`[Referral/Status] ✓ Credited ${earningAmount} RUB to user ${referrerId} from payment ${paymentId}`)
  } catch (error) {
    console.error("[Referral/Status] Error processing earning:", error)
    // Don't throw - referral is not critical for payment status check
  }
}
