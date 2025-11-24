import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createPayment, IS_TEST_MODE } from "@/lib/yookassa"

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

    // Определяем return URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000"
    const returnUrl = `${baseUrl}/payment/callback?device_id=${deviceId}`

    // Создаем платеж в YooKassa
    const payment = await createPayment(500, "Photoset Pro - Генерация 23 AI-фотографий", returnUrl, {
      device_id: deviceId,
      avatar_id: avatarId?.toString() || "",
      user_id: user.id.toString(),
    })

    // Сохраняем платеж в БД
    await sql`
      INSERT INTO payments (user_id, yookassa_payment_id, amount, status)
      VALUES (${user.id}, ${payment.id}, 500, 'pending')
    `

    return NextResponse.json({
      paymentId: payment.id,
      confirmationUrl: payment.confirmation?.confirmation_url,
      testMode: IS_TEST_MODE,
    })
  } catch (error) {
    console.error("Payment creation error:", error)
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 })
  }
}
