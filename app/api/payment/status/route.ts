import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getPayment, IS_TEST_MODE } from "@/lib/yookassa"

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
      return NextResponse.json({ isPro: false, status: "pending", testMode: true })
    }

    // Проверяем статус пользователя
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
      return NextResponse.json({ isPro: false, status: "pending", error: "db_unavailable" })
    }

    // Если уже Pro
    if (user.is_pro) {
      return NextResponse.json({ isPro: true, status: "succeeded" })
    }

    if ((IS_TEST_MODE || isTestRequest) && paymentId) {
      console.log("[Payment] Test mode: activating Pro for user", user.id)
      await sql`
        UPDATE users SET is_pro = TRUE, updated_at = NOW()
        WHERE id = ${user.id}
      `
      // Обновляем платеж если есть
      if (paymentId.startsWith("test_")) {
        await sql`
          UPDATE payments SET status = 'succeeded', updated_at = NOW()
          WHERE yookassa_payment_id = ${paymentId}
        `.catch(() => {}) // Игнорируем ошибку если платежа нет
      }
      return NextResponse.json({ isPro: true, status: "succeeded", testMode: true })
    }

    // Если передан payment_id, проверяем его статус в YooKassa
    if (paymentId) {
      try {
        const payment = await getPayment(paymentId)

        if (payment.status === "succeeded") {
          await sql`
            UPDATE users SET is_pro = TRUE, updated_at = NOW()
            WHERE id = ${user.id}
          `
          await sql`
            UPDATE payments SET status = 'succeeded', updated_at = NOW()
            WHERE yookassa_payment_id = ${paymentId}
          `
          return NextResponse.json({ isPro: true, status: "succeeded" })
        }

        return NextResponse.json({ isPro: false, status: payment.status })
      } catch {
        // Игнорируем ошибку проверки платежа
      }
    }

    return NextResponse.json({ isPro: user.is_pro, status: user.is_pro ? "succeeded" : "pending" })
  } catch (error) {
    console.error("Status check error:", error)
    return NextResponse.json({ isPro: false, status: "pending", error: "check_failed" })
  }
}
