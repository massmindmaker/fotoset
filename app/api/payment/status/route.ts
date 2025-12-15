import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getPaymentState } from "@/lib/tbank"
import { findOrCreateUser } from "@/lib/user-identity"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserId = searchParams.get("telegram_user_id")
    const deviceId = searchParams.get("device_id")
    let paymentId = searchParams.get("payment_id")

    console.log("[Payment Status] Check:", {
      telegramUserId,
      deviceId: deviceId?.substring(0, 8) + "...",
      paymentId,
    })

    // SECURITY: Require at least one identifier
    if (!telegramUserId && (!deviceId || deviceId.trim().length === 0)) {
      return NextResponse.json({ error: "telegram_user_id or device_id required" }, { status: 400 })
    }
    if (deviceId && deviceId.length > 255) {
      return NextResponse.json({ error: "Device ID too long" }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      console.warn("[Payment Status] DATABASE_URL not configured, using test mode")
      return NextResponse.json({ paid: false, status: "pending", testMode: true })
    }

    // Find or create user with priority: telegram_user_id > device_id
    let user
    try {
      user = await findOrCreateUser({
        telegramUserId: telegramUserId ? parseInt(telegramUserId) : undefined,
        deviceId: deviceId || undefined,
      })
    } catch (dbError) {
      console.error("[Payment Status] Database error:", dbError)
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
        `.then(rows => rows[0])
        
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
        console.error("[Payment Status] Error finding latest payment:", err)
        return NextResponse.json({ paid: false, status: "pending" })
      }
    }

    // Проверяем статус платежа в T-Bank
    try {
      const payment = await getPaymentState(paymentId)

      if (payment.Status === "CONFIRMED" || payment.Status === "AUTHORIZED") {
        // IDEMPOTENT: Only update if not already succeeded (prevents race with webhook)
        await sql`
          UPDATE payments SET status = 'succeeded', updated_at = NOW()
          WHERE tbank_payment_id = ${paymentId} AND status != 'succeeded'
        `
        return NextResponse.json({ paid: true, status: "succeeded" })
      }

      return NextResponse.json({ paid: false, status: payment.Status?.toLowerCase() || "pending" })
    } catch {
      // Проверяем статус платежа в БД если T-Bank недоступен
      const dbPayment = await sql`
        SELECT status FROM payments WHERE tbank_payment_id = ${paymentId}
      `.then(rows => rows[0])

      if (dbPayment?.status === 'succeeded') {
        return NextResponse.json({ paid: true, status: "succeeded" })
      }
      return NextResponse.json({ paid: false, status: "pending" })
    }
  } catch (error) {
    console.error("Status check error:", error)
    return NextResponse.json({ paid: false, status: "pending", error: "check_failed" })
  }
}
