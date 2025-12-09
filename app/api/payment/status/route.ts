import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getPaymentState, IS_TEST_MODE } from "@/lib/tbank"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("device_id")
    const paymentId = searchParams.get("payment_id")
    const isTestRequest = searchParams.get("test") === "true"

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID required" }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      console.warn("[v0] DATABASE_URL not configured, using test mode")
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
      console.error("[v0] Database error:", dbError)
      return NextResponse.json({ paid: false, status: "pending", error: "db_unavailable" })
    }

    // Если нет payment_id, просто возвращаем pending
    if (!paymentId) {
      return NextResponse.json({ paid: false, status: "pending" })
    }

    // Обработка демо-платежей
    if (paymentId.startsWith("demo_")) {
      const isDemoConfirmed = searchParams.get("demo_confirmed") === "true"
      if (isDemoConfirmed) {
        console.log("[Payment] Demo mode: confirming payment for user", user.id)
        await sql`
          UPDATE payments SET status = 'succeeded', updated_at = NOW()
          WHERE yookassa_payment_id = ${paymentId}
        `.catch(() => {})
        return NextResponse.json({ paid: true, status: "succeeded", demoMode: true })
      }
      return NextResponse.json({ paid: false, status: "pending", demoMode: true })
    }

    // Test mode
    if ((IS_TEST_MODE || isTestRequest) && paymentId) {
      console.log("[Payment] Test mode: confirming payment for user", user.id)
      if (paymentId.startsWith("test_")) {
        await sql`
          UPDATE payments SET status = 'succeeded', updated_at = NOW()
          WHERE yookassa_payment_id = ${paymentId}
        `.catch(() => {})
      }
      return NextResponse.json({ paid: true, status: "succeeded", testMode: true })
    }

    // Проверяем статус платежа в T-Bank
    try {
      const payment = await getPaymentState(paymentId)

      if (payment.Status === "CONFIRMED" || payment.Status === "AUTHORIZED") {
        await sql`
          UPDATE payments SET status = 'succeeded', updated_at = NOW()
          WHERE yookassa_payment_id = ${paymentId}
        `
        return NextResponse.json({ paid: true, status: "succeeded" })
      }

      return NextResponse.json({ paid: false, status: payment.Status?.toLowerCase() || "pending" })
    } catch {
      // Проверяем статус платежа в БД если T-Bank недоступен
      const dbPayment = await sql`
        SELECT status FROM payments WHERE yookassa_payment_id = ${paymentId}
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
