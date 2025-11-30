import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyWebhookSignature } from "@/lib/tbank"

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
