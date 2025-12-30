import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { cancelPayment } from "@/lib/tbank"
import { logAdminAction } from "@/lib/admin/audit"
import type { Receipt } from "@/lib/tbank"

/**
 * POST /api/admin/payments/refund
 *
 * Create a refund for a payment via T-Bank API
 *
 * Request Body:
 * {
 *   paymentId: number,      // Payment DB ID
 *   amount?: number,        // Optional partial refund amount (rubles)
 *   reason: string          // Required refund reason
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data?: { payment: Payment }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentId, amount, reason } = body

    // Validation
    if (!paymentId || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            userMessage: "Payment ID и причина возврата обязательны",
          },
        },
        { status: 400 }
      )
    }

    if (!reason.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            userMessage: "Укажите причину возврата",
          },
        },
        { status: 400 }
      )
    }

    // Get payment from DB
    const paymentResult = await sql`
      SELECT * FROM payments WHERE id = ${paymentId}
    `

    if (paymentResult.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            userMessage: "Платёж не найден",
          },
        },
        { status: 404 }
      )
    }

    const payment = paymentResult[0]

    // Validate payment status
    if (payment.status !== 'succeeded') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            userMessage: "Можно возвратить только успешные платежи",
          },
        },
        { status: 400 }
      )
    }

    // Calculate refund amount
    const currentRefund = payment.refund_amount || 0
    const maxRefund = payment.amount - currentRefund
    const refundAmount = amount !== undefined ? amount : maxRefund

    // Validate refund amount
    if (refundAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_AMOUNT",
            userMessage: "Сумма возврата должна быть больше 0",
          },
        },
        { status: 400 }
      )
    }

    if (refundAmount > maxRefund) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AMOUNT_EXCEEDED",
            userMessage: `Максимум ${maxRefund}₽ доступно для возврата`,
          },
        },
        { status: 400 }
      )
    }

    // Create receipt for T-Bank (54-ФЗ compliance)
    const amountInKopeks = Math.round(refundAmount * 100)
    const receipt: Receipt = {
      Email: "noreply@pinglass.ru",
      Taxation: "usn_income_outcome",
      Items: [{
        Name: `Возврат - PinGlass AI фото${reason ? ` (${reason.substring(0, 50)})` : ''}`,
        Price: amountInKopeks,
        Quantity: 1,
        Amount: amountInKopeks,
        Tax: "none",
        PaymentMethod: "full_payment",
        PaymentObject: "service",
      }],
    }

    console.log('[Admin Refund] Processing:', {
      paymentId,
      tbankPaymentId: payment.tbank_payment_id,
      refundAmount,
      isPartial: refundAmount < maxRefund,
    })

    // Call T-Bank Cancel API
    const tbankResult = await cancelPayment(
      payment.tbank_payment_id,
      refundAmount,
      receipt
    )

    console.log('[Admin Refund] T-Bank response:', {
      success: tbankResult.Success,
      status: tbankResult.Status,
    })

    // Update payment in DB
    const newRefundAmount = currentRefund + refundAmount
    const newStatus = newRefundAmount >= payment.amount ? 'refunded' : payment.status

    await sql`
      UPDATE payments
      SET
        refund_amount = ${newRefundAmount},
        refund_status = ${newStatus === 'refunded' ? 'full' : 'partial'},
        refund_reason = ${reason},
        refund_at = ${newStatus === 'refunded' ? sql`NOW()` : payment.refund_at || sql`NOW()`},
        status = ${newStatus},
        updated_at = NOW()
      WHERE id = ${paymentId}
    `

    // Audit log
    await logAdminAction(
      'REFUND_CREATED',
      paymentId,
      {
        amount: refundAmount,
        reason,
        isPartial: refundAmount < maxRefund,
        tbankStatus: tbankResult.Status,
      },
      request
    )

    console.log('[Admin Refund] Success:', {
      paymentId,
      newRefundAmount,
      newStatus,
    })

    // Return updated payment
    const updatedPayment = await sql`
      SELECT
        p.*,
        u.telegram_user_id
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id = ${paymentId}
    `

    return NextResponse.json({
      success: true,
      data: {
        payment: updatedPayment[0],
      },
    })

  } catch (error) {
    console.error("[Admin Refund] Error:", error)

    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "REFUND_ERROR",
          userMessage: errorMsg.includes('T-Bank')
            ? "Ошибка T-Bank API. Проверьте логи."
            : "Ошибка создания возврата",
          devMessage: errorMsg,
        },
      },
      { status: 500 }
    )
  }
}
