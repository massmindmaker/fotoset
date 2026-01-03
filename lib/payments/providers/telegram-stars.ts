/**
 * Telegram Stars Payment Provider
 * Handles payments via Telegram Stars (XTR) using Bot API
 * https://core.telegram.org/bots/api#payments
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
  StarsWebhookPayload,
} from '../types'
import { sql } from '../../db'
import { convertToRUB } from '../rates'

// Default Stars pricing (can be overridden in admin settings)
const DEFAULT_STARS_PRICING: Record<string, number> = {
  starter: 99,
  standard: 199,
  premium: 299,
}

const TIER_PHOTOS: Record<string, number> = {
  starter: 7,
  standard: 15,
  premium: 23,
}

// RUB equivalent for referral calculations
const RUB_PRICES: Record<string, number> = {
  starter: 499,
  standard: 999,
  premium: 1499,
}

export class TelegramStarsProvider implements IPaymentProvider {
  name: 'stars' = 'stars'

  private async getStarsPricing(): Promise<Record<string, number>> {
    try {
      const [setting] = await sql`
        SELECT value FROM admin_settings WHERE key = 'payment_methods'
      `.catch(() => [null])

      return setting?.value?.stars?.pricing || DEFAULT_STARS_PRICING
    } catch {
      return DEFAULT_STARS_PRICING
    }
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const { userId, tierId, avatarId } = request
    const pricing = await this.getStarsPricing()
    const starsAmount = pricing[tierId] || 199
    const photoCount = TIER_PHOTOS[tierId] || 15
    const amountRub = RUB_PRICES[tierId] || 999

    // Get user's telegram_user_id
    const user = await sql`
      SELECT telegram_user_id FROM users WHERE id = ${userId}
    `.then((rows: any[]) => rows[0])

    if (!user?.telegram_user_id) {
      throw new Error('User does not have a Telegram account linked')
    }

    // Create payment record
    const [payment] = await sql`
      INSERT INTO payments (
        user_id, provider, amount, currency, status, tier_id, photo_count,
        original_currency, original_amount, stars_amount
      )
      VALUES (
        ${userId}, 'stars', ${amountRub}, 'RUB', 'pending', ${tierId}, ${photoCount},
        'XTR', ${starsAmount}, ${starsAmount}
      )
      RETURNING id
    `

    // Create invoice payload for Telegram
    const payload = JSON.stringify({
      payment_id: payment.id,
      user_id: userId,
      avatar_id: avatarId,
      tier_id: tierId,
    })

    // Send invoice via Telegram Bot API
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured')
    }

    const invoiceResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendInvoice`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegram_user_id,
          title: `PinGlass Pro - ${photoCount} AI photos`,
          description: `Получите ${photoCount} профессиональных AI-портретов в различных стилях`,
          payload,
          currency: 'XTR',
          prices: [{ label: `${photoCount} AI Photos`, amount: starsAmount }],
          // Stars don't need provider_token
        }),
      }
    )

    const invoiceResult = await invoiceResponse.json()

    if (!invoiceResult.ok) {
      console.error('[TelegramStars] Failed to send invoice:', invoiceResult)
      throw new Error(`Telegram API error: ${invoiceResult.description}`)
    }

    // Update payment with message ID for tracking
    await sql`
      UPDATE payments
      SET provider_payment_id = ${invoiceResult.result?.message_id?.toString()},
          updated_at = NOW()
      WHERE id = ${payment.id}
    `

    return {
      success: true,
      paymentId: payment.id,
      providerPaymentId: invoiceResult.result?.message_id?.toString() || '',
      // No redirect URL - invoice appears in Telegram chat
      amount: starsAmount,
      currency: 'XTR',
      amountRub,
    }
  }

  async getStatus(paymentId: number): Promise<PaymentStatusResponse> {
    const payment = await sql`
      SELECT id, status, amount, stars_amount, original_currency, updated_at
      FROM payments
      WHERE id = ${paymentId}
    `.then((rows: any[]) => rows[0])

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`)
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      provider: 'stars',
      amountRub: Number(payment.amount),
      originalAmount: payment.stars_amount,
      originalCurrency: 'XTR',
      updatedAt: new Date(payment.updated_at),
    }
  }

  async processWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as StarsWebhookPayload

    // Handle pre_checkout_query (payment confirmation request)
    if (data.pre_checkout_query) {
      const query = data.pre_checkout_query
      const botToken = process.env.TELEGRAM_BOT_TOKEN

      if (!botToken) {
        return { success: false, error: 'Bot token not configured' }
      }

      // Always approve Stars payments (we validate on successful_payment)
      await fetch(
        `https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: query.id,
            ok: true,
          }),
        }
      )

      return { success: true }
    }

    // Handle successful_payment
    if (data.successful_payment) {
      const sp = data.successful_payment

      // Parse payload to get payment ID
      let paymentData: { payment_id: number }
      try {
        paymentData = JSON.parse(sp.invoice_payload)
      } catch {
        return { success: false, error: 'Invalid invoice payload' }
      }

      const paymentId = paymentData.payment_id

      // Update payment with Telegram charge ID
      await sql`
        UPDATE payments
        SET status = 'succeeded',
            telegram_charge_id = ${sp.telegram_payment_charge_id},
            provider_payment_id = ${sp.telegram_payment_charge_id},
            updated_at = NOW()
        WHERE id = ${paymentId}
      `

      // Mark user as pro
      const payment = await sql`
        SELECT user_id FROM payments WHERE id = ${paymentId}
      `.then((rows: any[]) => rows[0])

      if (payment) {
        await sql`
          UPDATE users SET is_pro = TRUE, updated_at = NOW()
          WHERE id = ${payment.user_id}
        `
      }

      return {
        success: true,
        paymentId,
        status: 'succeeded',
      }
    }

    return { success: false, error: 'Unknown webhook type' }
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    const { paymentId, reason } = request

    const payment = await sql`
      SELECT telegram_charge_id, user_id
      FROM payments
      WHERE id = ${paymentId}
    `.then((rows: any[]) => rows[0])

    if (!payment?.telegram_charge_id) {
      return {
        success: false,
        manualRefund: true,
        manualInstructions: 'Missing Telegram charge ID. Contact @BotFather support.',
      }
    }

    // Get user's telegram_user_id
    const user = await sql`
      SELECT telegram_user_id FROM users WHERE id = ${payment.user_id}
    `.then((rows: any[]) => rows[0])

    if (!user?.telegram_user_id) {
      return {
        success: false,
        manualRefund: true,
        manualInstructions: 'User missing Telegram ID. Manual refund via @BotFather.',
      }
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return {
        success: false,
        manualRefund: true,
        manualInstructions: 'Bot token not configured. Admin must refund via @BotFather.',
      }
    }

    try {
      // Call Telegram Bot API refundStarPayment
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/refundStarPayment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.telegram_user_id,
            telegram_payment_charge_id: payment.telegram_charge_id,
          }),
        }
      )

      const result = await response.json()

      if (!result.ok) {
        return {
          success: false,
          manualRefund: true,
          manualInstructions: `Telegram API: ${result.description}`,
        }
      }

      // Update payment status
      await sql`
        UPDATE payments
        SET status = 'refunded',
            refund_status = 'completed',
            refund_reason = ${reason || 'По запросу'},
            refund_at = NOW(),
            updated_at = NOW()
        WHERE id = ${paymentId}
      `

      return {
        success: true,
        refundId: payment.telegram_charge_id,
        manualRefund: false,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        manualRefund: true,
        manualInstructions: `Telegram API error: ${errorMessage}`,
      }
    }
  }

  async convertToRUB(amount: number): Promise<RateConversion> {
    return convertToRUB(amount, 'XTR')
  }

  async isEnabled(): Promise<boolean> {
    try {
      const [setting] = await sql`
        SELECT value FROM admin_settings WHERE key = 'payment_methods'
      `.catch(() => [null])

      const methods = setting?.value || {}
      return methods.stars?.enabled === true // Default false
    } catch {
      return false
    }
  }
}

export const starsProvider = new TelegramStarsProvider()
