import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getPaymentState } from "@/lib/tbank"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("device_id")
    let paymentId = searchParams.get("payment_id")

    console.log("[Payment Status] Check:", {
      deviceId: deviceId?.substring(0, 8) + "...",
      paymentId,
    })

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID required" }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      console.warn("[Payment Status] DATABASE_URL not configured, using test mode")
      return NextResponse.json({ paid: false, status: "pending", testMode: true })
    }

    // Проверяем пользователя
    let user
    try {
      user = await sql`
        SELECT * FROM users WHERE device_id = ${deviceId}
      `.then((rows) => rows[0])

      if (!user) {
        user = await sql`
          INSERT INTO users (device_id) VALUES (${deviceId})
          RETURNING *
        `.then((rows) => rows[0])
      }
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
        await sql`
          UPDATE payments SET status = 'succeeded', updated_at = NOW()
          WHERE tbank_payment_id = ${paymentId}
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
