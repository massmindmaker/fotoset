import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { initPayment, IS_TEST_MODE } from "@/lib/tbank"

export async function POST(request: NextRequest) {
  try {
    const { deviceId, avatarId } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID required" }, { status: 400 })
    }

    // Получаем или создаем пользователя
    let user = await sql`
      SELECT * FROM users WHERE device_id = ${deviceId}
    `.then((rows) => rows[0])

    if (!user) {
      user = await sql`
        INSERT INTO users (device_id) VALUES (${deviceId})
        RETURNING *
      `.then((rows) => rows[0])
    }

    // Проверяем, не Pro ли уже
    if (user.is_pro) {
      return NextResponse.json({ error: "Already Pro user" }, { status: 400 })
    }

    // Определяем return URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000"
    const successUrl = `${baseUrl}/payment/callback?device_id=${deviceId}&status=success`
    const failUrl = `${baseUrl}/payment/callback?device_id=${deviceId}&status=failed`
    const notificationUrl = `${baseUrl}/api/payment/webhook`

    // Генерируем уникальный OrderId
    const orderId = `order_${user.id}_${Date.now()}`

    // Создаем платеж в T-Bank
    const payment = await initPayment(
      500, // сумма в рублях
      orderId,
      "Fotoset Pro - Генерация 23 AI-фотографий",
      successUrl,
      failUrl,
      notificationUrl,
    )

    // Сохраняем платеж в БД
    await sql`
      INSERT INTO payments (user_id, yookassa_payment_id, amount, status)
      VALUES (${user.id}, ${payment.PaymentId}, 500, 'pending')
    `

    return NextResponse.json({
      paymentId: payment.PaymentId,
      confirmationUrl: payment.PaymentURL,
      testMode: IS_TEST_MODE,
    })
  } catch (error) {
    console.error("Payment creation error:", error)
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 })
  }
}
