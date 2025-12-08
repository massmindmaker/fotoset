import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { initPayment, IS_TEST_MODE, IS_DEMO_MODE, type PaymentMethod } from "@/lib/tbank"

export async function POST(request: NextRequest) {
  try {
    const { deviceId, email, paymentMethod, tierId, photoCount } = await request.json() as {
      deviceId: string
      email?: string
      paymentMethod?: PaymentMethod
      tierId?: string
      photoCount?: number
    }

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
      return NextResponse.json({ error: "Вы уже Pro пользователь" }, { status: 400 })
    }

    // Определяем return URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000"

    // В демо-режиме направляем на специальную демо-страницу оплаты
    if (IS_DEMO_MODE) {
      const demoPaymentId = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`

      // Сохраняем демо-платеж в БД
      await sql`
        INSERT INTO payments (user_id, yookassa_payment_id, amount, status)
        VALUES (${user.id}, ${demoPaymentId}, 500, 'pending')
      `

      const demoUrl = `${baseUrl}/payment/demo?device_id=${deviceId}&payment_id=${demoPaymentId}&amount=500&tier=${tierId || 'standard'}&photos=${photoCount || 15}`

      console.log("[Payment] Demo mode: created demo payment", { demoPaymentId, demoUrl })

      return NextResponse.json({
        paymentId: demoPaymentId,
        confirmationUrl: demoUrl,
        testMode: true,
        demoMode: true,
      })
    }

    const successUrl = `${baseUrl}/payment/callback?device_id=${deviceId}&status=success`
    const failUrl = `${baseUrl}/payment/callback?device_id=${deviceId}&status=failed`
    const notificationUrl = `${baseUrl}/api/payment/webhook`

    // Генерируем уникальный OrderId
    const orderId = `order_${user.id}_${Date.now()}`

    // Создаем платеж в T-Bank
    const payment = await initPayment(
      500, // сумма в рублях
      orderId,
      "PinGlass Pro - Генерация 23 AI-фотографий",
      successUrl,
      failUrl,
      notificationUrl,
      email, // Email для чека
      paymentMethod, // Способ оплаты
    )

    // Сохраняем платеж в БД
    await sql`
      INSERT INTO payments (user_id, yookassa_payment_id, amount, status)
      VALUES (${user.id}, ${payment.PaymentId}, 500, 'pending')
    `

    console.log("[Payment] Created:", { orderId, paymentId: payment.PaymentId, email, paymentMethod, testMode: IS_TEST_MODE })

    return NextResponse.json({
      paymentId: payment.PaymentId,
      confirmationUrl: payment.PaymentURL,
      testMode: IS_TEST_MODE,
    })
  } catch (error) {
    console.error("Payment creation error:", error)
    const message = error instanceof Error ? error.message : "Failed to create payment"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
