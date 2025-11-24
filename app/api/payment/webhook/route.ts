import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Webhook от YooKassa
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { event, object } = body

    if (event === "payment.succeeded") {
      const paymentId = object.id
      const metadata = object.metadata || {}

      // Обновляем статус платежа
      await sql`
        UPDATE payments 
        SET status = 'succeeded', updated_at = NOW()
        WHERE yookassa_payment_id = ${paymentId}
      `

      // Обновляем пользователя на Pro
      if (metadata.user_id) {
        await sql`
          UPDATE users 
          SET is_pro = TRUE, updated_at = NOW()
          WHERE id = ${Number.parseInt(metadata.user_id)}
        `
      }
    } else if (event === "payment.canceled") {
      const paymentId = object.id

      await sql`
        UPDATE payments 
        SET status = 'canceled', updated_at = NOW()
        WHERE yookassa_payment_id = ${paymentId}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
