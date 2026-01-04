/**
 * TON Cryptocurrency Payment Provider
 * Handles payments via TON blockchain
 * Uses wallet address matching for payment verification
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
} from '../types'
import { sql } from '../../db'
import { convertToRUB, fetchExchangeRate } from '../rates'

// Default TON pricing
const DEFAULT_TON_PRICING: Record<string, number> = {
  starter: 1.5,
  standard: 3.0,
  premium: 4.5,
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

// Required confirmations before crediting payment
const REQUIRED_CONFIRMATIONS = 10

// Payment expiration time (30 minutes)
const PAYMENT_EXPIRATION_MS = 30 * 60 * 1000

export class TonProvider implements IPaymentProvider {
  name: 'ton' = 'ton'

  private async getTonPricing(): Promise<Record<string, number>> {
    try {
      const [setting] = await sql`
        SELECT value FROM admin_settings WHERE key = 'payment_methods'
      `.catch(() => [null])

      return setting?.value?.ton?.pricing || DEFAULT_TON_PRICING
    } catch {
      return DEFAULT_TON_PRICING
    }
  }

  private async getWalletAddress(): Promise<string | null> {
    try {
      const [setting] = await sql`
        SELECT value FROM admin_settings WHERE key = 'payment_methods'
      `.catch(() => [null])

      return setting?.value?.ton?.walletAddress || null
    } catch {
      return null
    }
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const { userId, tierId, avatarId } = request
    const pricing = await this.getTonPricing()
    const tonAmount = pricing[tierId] || 3.0
    const photoCount = TIER_PHOTOS[tierId] || 15
    const amountRub = RUB_PRICES[tierId] || 999

    // Get wallet address
    const walletAddress = await this.getWalletAddress()
    if (!walletAddress) {
      throw new Error('TON wallet address not configured')
    }

    // Get current exchange rate
    const rateData = await fetchExchangeRate('TON', 'RUB')
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRATION_MS)

    // Create payment record
    const [payment] = await sql`
      INSERT INTO payments (
        user_id, provider, amount, currency, status, tier_id, photo_count,
        original_currency, original_amount, ton_amount,
        exchange_rate, rate_locked_at, rate_expires_at
      )
      VALUES (
        ${userId}, 'ton', ${amountRub}, 'RUB', 'pending', ${tierId}, ${photoCount},
        'TON', ${tonAmount}, ${tonAmount},
        ${rateData.rate}, NOW(), ${expiresAt}
      )
      RETURNING id
    `

    // Create unique payment comment for matching
    const paymentComment = `PG${payment.id}`

    // Update with payment comment
    await sql`
      UPDATE payments
      SET provider_payment_id = ${paymentComment},
          updated_at = NOW()
      WHERE id = ${payment.id}
    `

    return {
      success: true,
      paymentId: payment.id,
      providerPaymentId: paymentComment,
      walletAddress,
      amount: tonAmount,
      currency: 'TON',
      amountRub,
      exchangeRate: rateData.rate,
      expiresAt,
    }
  }

  async getStatus(paymentId: number): Promise<PaymentStatusResponse> {
    const payment = await sql`
      SELECT id, status, amount, ton_amount, ton_tx_hash, ton_confirmations,
             original_currency, exchange_rate, updated_at
      FROM payments
      WHERE id = ${paymentId}
    `.then((rows: any[]) => rows[0])

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`)
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      provider: 'ton',
      amountRub: Number(payment.amount),
      originalAmount: payment.ton_amount,
      originalCurrency: 'TON',
      exchangeRate: payment.exchange_rate,
      tonTxHash: payment.ton_tx_hash,
      tonConfirmations: payment.ton_confirmations,
      updatedAt: new Date(payment.updated_at),
    }
  }

  /**
   * Process incoming TON transaction
   * Called by blockchain monitoring service
   */
  async processWebhook(payload: unknown): Promise<WebhookResult> {
    const data = payload as {
      txHash: string
      amount: number
      senderAddress: string
      comment?: string
      confirmations: number
    }

    // Check for duplicate transaction
    const existing = await sql`
      SELECT id FROM payments WHERE ton_tx_hash = ${data.txHash}
    `.then((rows: any[]) => rows[0])

    if (existing) {
      // Update confirmations only
      await sql`
        UPDATE payments
        SET ton_confirmations = ${data.confirmations},
            updated_at = NOW()
        WHERE ton_tx_hash = ${data.txHash}
      `

      // Check if we have enough confirmations now
      if (data.confirmations >= REQUIRED_CONFIRMATIONS) {
        await sql`
          UPDATE payments
          SET status = 'succeeded', updated_at = NOW()
          WHERE ton_tx_hash = ${data.txHash}
            AND status = 'processing'
        `
      }

      return { success: true, paymentId: existing.id }
    }

    // Try to match by comment (format: PG<payment_id>)
    const commentMatch = data.comment?.match(/PG(\d+)/)
    if (commentMatch) {
      const paymentId = parseInt(commentMatch[1], 10)

      const payment = await sql`
        SELECT id, ton_amount, rate_expires_at
        FROM payments
        WHERE id = ${paymentId}
          AND provider = 'ton'
          AND status = 'pending'
      `.then((rows: any[]) => rows[0])

      if (payment) {
        // Verify amount (allow 1% tolerance for network fees)
        const expectedAmount = Number(payment.ton_amount)
        const receivedAmount = data.amount
        const tolerance = expectedAmount * 0.01

        if (Math.abs(receivedAmount - expectedAmount) <= tolerance) {
          // Check if rate hasn't expired
          const rateExpired = payment.rate_expires_at && new Date(payment.rate_expires_at) < new Date()

          const newStatus = data.confirmations >= REQUIRED_CONFIRMATIONS
            ? 'succeeded'
            : 'processing'

          await sql`
            UPDATE payments
            SET status = ${newStatus},
                ton_tx_hash = ${data.txHash},
                ton_sender_address = ${data.senderAddress},
                ton_confirmations = ${data.confirmations},
                updated_at = NOW()
            WHERE id = ${paymentId}
          `

          // User access is determined by having a successful payment, not by is_pro flag

          return {
            success: true,
            paymentId,
            status: newStatus as any,
          }
        }
      }
    }

    // No match - save as orphan for manual review
    await sql`
      INSERT INTO orphan_payments (tx_hash, amount, wallet_address, status)
      VALUES (${data.txHash}, ${data.amount}, ${data.senderAddress}, 'unmatched')
      ON CONFLICT (tx_hash) DO NOTHING
    `

    return { success: false, error: 'Payment not matched' }
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    const { paymentId, reason } = request

    const payment = await sql`
      SELECT ton_amount, ton_sender_address, ton_tx_hash
      FROM payments
      WHERE id = ${paymentId}
    `.then((rows: any[]) => rows[0])

    if (!payment) {
      return {
        success: false,
        manualRefund: true,
        manualInstructions: 'Payment not found.',
      }
    }

    // TON refunds are always manual - we can't auto-send crypto
    const instructions = payment.ton_sender_address
      ? `Send ${payment.ton_amount} TON to ${payment.ton_sender_address}. Original TX: ${payment.ton_tx_hash}`
      : `TON refund required (${payment.ton_amount} TON). Original TX: ${payment.ton_tx_hash}. User wallet unknown - contact user.`

    // Mark as pending refund
    await sql`
      UPDATE payments
      SET refund_status = 'pending',
          refund_reason = ${reason || 'По запросу'},
          updated_at = NOW()
      WHERE id = ${paymentId}
    `

    return {
      success: true, // "success" means we processed it correctly, not that refund is done
      manualRefund: true,
      manualInstructions: instructions,
    }
  }

  /**
   * Mark manual refund as completed
   */
  async confirmManualRefund(paymentId: number, txHash: string): Promise<void> {
    await sql`
      UPDATE payments
      SET status = 'refunded',
          refund_status = 'completed',
          refund_at = NOW(),
          updated_at = NOW()
      WHERE id = ${paymentId}
    `
  }

  async convertToRUB(amount: number): Promise<RateConversion> {
    return convertToRUB(amount, 'TON')
  }

  async isEnabled(): Promise<boolean> {
    try {
      const [setting] = await sql`
        SELECT value FROM admin_settings WHERE key = 'payment_methods'
      `.catch(() => [null])

      const methods = setting?.value || {}
      return methods.ton?.enabled === true // Default false
    } catch {
      return false
    }
  }

  /**
   * Check for expired pending payments
   * Should be called periodically by cron job
   */
  async expireOldPayments(): Promise<number> {
    const result = await sql`
      UPDATE payments
      SET status = 'expired', updated_at = NOW()
      WHERE provider = 'ton'
        AND status = 'pending'
        AND rate_expires_at < NOW()
    `

    return result.count || 0
  }
}

export const tonProvider = new TonProvider()
