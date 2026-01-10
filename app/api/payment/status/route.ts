import { type NextRequest, NextResponse } from "next/server"
import { sql, query } from "@/lib/db"
import { getPaymentState } from "@/lib/tbank"
import { findOrCreateUser } from "@/lib/user-identity"
import { paymentLogger as log } from "@/lib/logger"
import { processReferralEarning } from "@/lib/referral-earnings"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserId = searchParams.get("telegram_user_id")
    const neonUserId = searchParams.get("neon_user_id")
    let paymentId = searchParams.get("payment_id")

    log.debug(" Check:", {
      telegramUserId,
      neonUserId,
      paymentId,
    })

    // SECURITY: Require at least one user identifier (Telegram OR Web)
    if ((!telegramUserId || telegramUserId.trim().length === 0) &&
        (!neonUserId || neonUserId.trim().length === 0)) {
      return NextResponse.json({ error: "telegram_user_id or neon_user_id is required" }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      log.warn(" DATABASE_URL not configured, using test mode")
      return NextResponse.json({ paid: false, status: "pending", testMode: true })
    }

    // Find or create user (Telegram OR Web)
    let user
    try {
      user = await findOrCreateUser({
        telegramUserId: telegramUserId ? parseInt(telegramUserId) : undefined,
        neonUserId: neonUserId || undefined,
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
          await processReferralEarning(updatedPayment.id, updatedPayment.user_id)
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
