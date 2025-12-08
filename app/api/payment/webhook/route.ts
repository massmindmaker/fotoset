import { type NextRequest, NextResponse } from "next/server"
import { sql, query } from "@/lib/db"
import { verifyWebhookSignature } from "@/lib/tbank"

const REFERRAL_RATE = 0.10 // 10% партнёру

// Webhook от T-Bank
export async function POST(request: NextRequest) {
  try {
    const notification = await request.json()

    // Проверяем подпись вебхука
    const receivedToken = notification.Token || ""
    const isValid = verifyWebhookSignature(notification, receivedToken)

    if (!isValid) {
      console.error("Invalid webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    const paymentId = notification.PaymentId
    const status = notification.Status

    // T-Bank статусы: NEW, CONFIRMED, REJECTED, AUTHORIZED, PARTIAL_REFUNDED, REFUNDED
    if (status === "CONFIRMED" || status === "AUTHORIZED") {
      // Обновляем статус платежа
      await sql`
        UPDATE payments
        SET status = 'succeeded', updated_at = NOW()
        WHERE yookassa_payment_id = ${paymentId}
      `

      // Получаем платеж и обновляем пользователя на Pro
      const payment = await sql`
        SELECT user_id FROM payments
        WHERE yookassa_payment_id = ${paymentId}
      `.then((rows) => rows[0])

      if (payment) {
        await sql`
          UPDATE users
          SET is_pro = TRUE, updated_at = NOW()
          WHERE id = ${payment.user_id}
        `

        // Process referral earning
        await processReferralEarning(payment.user_id, paymentId)
      }
    } else if (status === "REJECTED") {
      await sql`
        UPDATE payments
        SET status = 'canceled', updated_at = NOW()
        WHERE yookassa_payment_id = ${paymentId}
      `
    }

    // T-Bank требует ответ "OK" для подтверждения получения
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Webhook error:", error)
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

    // Check if earning already recorded for this payment
    const existingEarning = await query(
      "SELECT id FROM referral_earnings WHERE payment_id = $1",
      [payment.id]
    )

    if (existingEarning.rows.length > 0) {
      return // Already processed
    }

    // Record earning
    await query(
      `INSERT INTO referral_earnings (referrer_id, referred_id, payment_id, amount, original_amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [referrerId, userId, payment.id, earningAmount, originalAmount]
    )

    // Update referrer balance
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
