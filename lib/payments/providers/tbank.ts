/**
 * T-Bank Payment Provider
 * Wraps existing lib/tbank.ts with IPaymentProvider interface
 * Handles RUB payments with 54-ФЗ fiscal receipts
 */

import type {
  IPaymentProvider,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  WebhookResult,
  RefundRequest,
  RefundResponse,
  RateConversion,
  TBankWebhookPayload,
} from '../types'
import { sql } from '../../db'
import {
  initPayment as tbankInitPayment,
  getPaymentState as tbankGetState,
  cancelPayment as tbankCancelPayment,
  verifyWebhookSignature,
} from '../../tbank'

// Tier pricing in RUB
const TIER_PRICES: Record<string, number> = {
  starter: 499,
  standard: 999,
  premium: 1499,
}

const TIER_PHOTOS: Record<string, number> = {
  starter: 7,
  standard: 15,
  premium: 23,
}

export class TBankProvider implements IPaymentProvider {
  name: 'tbank' = 'tbank'

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const { userId, tierId, avatarId, email } = request
    const amount = TIER_PRICES[tierId] || 999
    const photoCount = TIER_PHOTOS[tierId] || 15

    // Create payment in database first
    const [payment] = await sql`
      INSERT INTO payments (
        user_id, provider, amount, currency, status, tier_id, photo_count,
        original_currency, original_amount
      )
      VALUES (
        ${userId}, 'tbank', ${amount}, 'RUB', 'pending', ${tierId}, ${photoCount},
        'RUB', ${amount}
      )
      RETURNING id
    `

    // Call T-Bank API
    const orderId = `order_${payment.id}`
    const description = `PinGlass Pro - ${photoCount} AI photos`
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pinglass.ru'
    const successUrl = `${baseUrl}/payment/callback?payment_id=${payment.id}`
    const failUrl = `${baseUrl}/payment/callback?payment_id=${payment.id}&status=failed`

    const result = await tbankInitPayment(
      amount,
      orderId,
      description,
      successUrl,
      failUrl,
      undefined,  // notificationUrl
      email || undefined  // customerEmail
    )

    // Update with T-Bank payment ID
    await sql`
      UPDATE payments
      SET tbank_payment_id = ${result.PaymentId?.toString()},
          provider_payment_id = ${result.PaymentId?.toString()},
          updated_at = NOW()
      WHERE id = ${payment.id}
    `

    return {
      success: true,
      paymentId: payment.id,
      providerPaymentId: result.PaymentId?.toString() || '',
      redirectUrl: result.PaymentURL,
      amount,
      currency: 'RUB',
      amountRub: amount,
    }
  }

  async getStatus(paymentId: number): Promise<PaymentStatusResponse> {
    const payment = await sql`
      SELECT id, status, amount, tbank_payment_id, provider, updated_at
      FROM payments
      WHERE id = ${paymentId}
    `.then((rows: any[]) => rows[0])

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`)
    }

    // If still pending, check T-Bank API
    if (payment.status === 'pending' && payment.tbank_payment_id) {
      try {
        const tbankStatus = await tbankGetState(payment.tbank_payment_id)

        let newStatus = payment.status
        if (tbankStatus.Status === 'CONFIRMED') {
          newStatus = 'succeeded'
        } else if (tbankStatus.Status === 'REJECTED' || tbankStatus.Status === 'CANCELED') {
          newStatus = 'canceled'
        }

        if (newStatus !== payment.status) {
          await sql`
            UPDATE payments
            SET status = ${newStatus}, updated_at = NOW()
            WHERE id = ${paymentId}
          `
          payment.status = newStatus
        }
      } catch (error) {
        console.error('[TBankProvider] Failed to check status:', error)
      }
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      provider: 'tbank',
      amountRub: Number(payment.amount),
      updatedAt: new Date(payment.updated_at),
    }
  }

  async processWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as TBankWebhookPayload

    // Verify signature (Token field contains the signature)
    const receivedToken = data.Token as string
    if (!receivedToken) {
      return { success: false, error: 'Missing webhook signature token' }
    }

    const isValid = verifyWebhookSignature(data as unknown as Record<string, unknown>, receivedToken)
    if (!isValid) {
      return { success: false, error: 'Invalid webhook signature' }
    }

    // Find payment by order ID
    const orderId = data.OrderId
    const paymentIdMatch = orderId?.match(/order_(\d+)/)
    if (!paymentIdMatch) {
      return { success: false, error: 'Invalid order ID format' }
    }

    const paymentId = parseInt(paymentIdMatch[1], 10)

    // Map T-Bank status to our status
    let status: string
    switch (data.Status) {
      case 'CONFIRMED':
        status = 'succeeded'
        break
      case 'REJECTED':
      case 'CANCELED':
        status = 'canceled'
        break
      case 'REFUNDED':
        status = 'refunded'
        break
      default:
        status = 'pending'
    }

    // Update payment
    await sql`
      UPDATE payments
      SET status = ${status},
          tbank_payment_id = ${data.PaymentId?.toString()},
          updated_at = NOW()
      WHERE id = ${paymentId}
    `

    // Payment status is already updated in the webhook handler
    // User access is determined by having a successful payment, not by is_pro flag

    return {
      success: true,
      paymentId,
      status: status as any,
    }
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    const { paymentId, reason } = request

    const payment = await sql`
      SELECT tbank_payment_id, amount
      FROM payments
      WHERE id = ${paymentId}
    `.then((rows: any[]) => rows[0])

    if (!payment?.tbank_payment_id) {
      return {
        success: false,
        manualRefund: true,
        manualInstructions: 'Payment missing T-Bank ID. Manual refund required.',
      }
    }

    try {
      // Create fiscal receipt for refund (54-ФЗ)
      const amountInKopeks = Math.round(Number(payment.amount) * 100)
      const receipt = {
        Email: 'noreply@pinglass.ru',
        Taxation: 'usn_income_outcome' as const,
        Items: [{
          Name: `Возврат - PinGlass AI (${reason || 'По запросу'})`,
          Price: amountInKopeks,
          Quantity: 1,
          Amount: amountInKopeks,
          Tax: 'none' as const,
          PaymentMethod: 'full_payment' as const,
          PaymentObject: 'service' as const,
        }],
      }

      const result = await tbankCancelPayment(payment.tbank_payment_id, undefined, receipt)

      // Update payment status
      await sql`
        UPDATE payments
        SET status = 'refunded',
            refund_status = 'completed',
            refund_reason = ${reason || 'По запросу'},
            refund_at = NOW(),
            refund_amount = ${payment.amount},
            updated_at = NOW()
        WHERE id = ${paymentId}
      `

      return {
        success: true,
        refundId: result.PaymentId?.toString(),
        manualRefund: false,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        manualRefund: true,
        manualInstructions: `T-Bank API error: ${errorMessage}`,
      }
    }
  }

  async convertToRUB(amount: number): Promise<RateConversion> {
    // T-Bank is already in RUB
    const now = new Date()
    return {
      originalAmount: amount,
      originalCurrency: 'RUB',
      convertedAmount: amount,
      convertedCurrency: 'RUB',
      rate: 1.0,
      rateLockedAt: now,
      rateExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    }
  }

  async isEnabled(): Promise<boolean> {
    try {
      const [setting] = await sql`
        SELECT value FROM admin_settings WHERE key = 'payment_methods'
      `.catch(() => [null])

      const methods = setting?.value || {}
      return methods.tbank?.enabled !== false // Default true
    } catch {
      return true // Default to enabled
    }
  }
}

export const tbankProvider = new TBankProvider()
