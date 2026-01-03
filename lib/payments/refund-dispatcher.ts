/**
 * Refund Dispatcher - Routes refunds to correct payment provider
 *
 * Handles:
 * - T-Bank: Full API refund with 54-ФЗ fiscal receipt
 * - Telegram Stars: Bot API refundStarPayment
 * - TON: Manual refund (crypto can't be auto-refunded)
 */

import type { PaymentDB, RefundResponse } from './types'

// Re-export for convenience
export type { RefundResponse }

export interface RefundContext {
  payment: PaymentDB
  reason: string
  adminId?: number
}

export interface DispatcherResult extends RefundResponse {
  provider: 'tbank' | 'stars' | 'ton'
}

/**
 * Main dispatcher - routes refund to correct provider
 */
export async function dispatchRefund(
  context: RefundContext
): Promise<DispatcherResult> {
  const { payment, reason, adminId } = context
  const provider = payment.provider || 'tbank'

  console.log(`[RefundDispatcher] Dispatching refund for payment ${payment.id}`, {
    provider,
    amount: payment.amount,
    reason,
    adminId,
  })

  switch (provider) {
    case 'tbank':
      return await refundTBank(payment, reason)
    case 'stars':
      return await refundStars(payment, reason)
    case 'ton':
      return refundTon(payment, reason)
    default:
      console.error(`[RefundDispatcher] Unknown provider: ${provider}`)
      return {
        success: false,
        provider: 'tbank',
        manualRefund: true,
        manualInstructions: `Unknown payment provider: ${provider}. Manual refund required.`,
      }
  }
}

/**
 * T-Bank refund - full API refund with fiscal receipt (54-ФЗ)
 */
async function refundTBank(
  payment: PaymentDB,
  reason: string
): Promise<DispatcherResult> {
  try {
    // Dynamic import to avoid circular dependencies
    const { cancelPayment } = await import('../tbank')
    const { sql } = await import('../db')

    if (!payment.tbank_payment_id) {
      console.error('[RefundDispatcher] T-Bank payment without tbank_payment_id', {
        paymentId: payment.id,
      })
      return {
        success: false,
        provider: 'tbank',
        manualRefund: true,
        manualInstructions: 'Payment missing T-Bank ID. Contact support.',
      }
    }

    // Create fiscal receipt (54-ФЗ compliance)
    // Amount in kopeks (payment.amount is in rubles)
    const amountInKopeks = Math.round(Number(payment.amount) * 100)
    const receipt = {
      Email: 'noreply@pinglass.ru',
      Taxation: 'usn_income_outcome' as const,
      Items: [{
        Name: `Возврат - PinGlass AI (${reason})`,
        Price: amountInKopeks,
        Quantity: 1,
        Amount: amountInKopeks,
        Tax: 'none' as const,
        PaymentMethod: 'full_payment' as const,
        PaymentObject: 'service' as const,
      }],
    }

    console.log('[RefundDispatcher] Calling T-Bank Cancel API', {
      paymentId: payment.tbank_payment_id,
      amount: payment.amount,
    })

    const result = await cancelPayment(payment.tbank_payment_id, undefined, receipt)

    // Update payment status
    await sql`
      UPDATE payments
      SET status = 'refunded',
          refund_status = 'completed',
          refund_reason = ${reason},
          refund_at = NOW(),
          refund_amount = ${payment.amount},
          updated_at = NOW()
      WHERE id = ${payment.id}
    `

    console.log('[RefundDispatcher] T-Bank refund successful', {
      paymentId: payment.tbank_payment_id,
      status: result.Status,
    })

    return {
      success: true,
      provider: 'tbank',
      refundId: result.PaymentId?.toString(),
      manualRefund: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[RefundDispatcher] T-Bank refund failed', {
      paymentId: payment.id,
      error: errorMessage,
    })

    return {
      success: false,
      provider: 'tbank',
      manualRefund: true,
      manualInstructions: `T-Bank API error: ${errorMessage}`,
    }
  }
}

/**
 * Telegram Stars refund - Bot API refundStarPayment
 * https://core.telegram.org/bots/api#refundstarpayment
 */
async function refundStars(
  payment: PaymentDB,
  reason: string
): Promise<DispatcherResult> {
  try {
    const { sql } = await import('../db')

    if (!payment.telegram_charge_id || !payment.user_id) {
      console.error('[RefundDispatcher] Stars payment missing charge ID or user', {
        paymentId: payment.id,
      })
      return {
        success: false,
        provider: 'stars',
        manualRefund: true,
        manualInstructions: 'Missing Telegram charge ID. Contact @BotFather support.',
      }
    }

    // Get user's telegram_user_id
    const userResult = await sql`
      SELECT telegram_user_id FROM users WHERE id = ${payment.user_id}
    `.then((rows: any[]) => rows[0])

    if (!userResult?.telegram_user_id) {
      console.error('[RefundDispatcher] User without telegram_user_id', {
        paymentId: payment.id,
        userId: payment.user_id,
      })
      return {
        success: false,
        provider: 'stars',
        manualRefund: true,
        manualInstructions: 'User missing Telegram ID. Manual refund via @BotFather.',
      }
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('[RefundDispatcher] TELEGRAM_BOT_TOKEN not configured')
      return {
        success: false,
        provider: 'stars',
        manualRefund: true,
        manualInstructions: 'Bot token not configured. Admin must refund via @BotFather.',
      }
    }

    // Call Telegram Bot API refundStarPayment
    console.log('[RefundDispatcher] Calling Telegram refundStarPayment', {
      telegramChargeId: payment.telegram_charge_id,
      telegramUserId: userResult.telegram_user_id,
    })

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/refundStarPayment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userResult.telegram_user_id,
          telegram_payment_charge_id: payment.telegram_charge_id,
        }),
      }
    )

    const result = await response.json()

    if (!result.ok) {
      console.error('[RefundDispatcher] Telegram API error', {
        paymentId: payment.id,
        error: result.description,
      })
      return {
        success: false,
        provider: 'stars',
        manualRefund: true,
        manualInstructions: `Telegram API: ${result.description}`,
      }
    }

    // Update payment status
    await sql`
      UPDATE payments
      SET status = 'refunded',
          refund_status = 'completed',
          refund_reason = ${reason},
          refund_at = NOW(),
          refund_amount = ${payment.amount},
          updated_at = NOW()
      WHERE id = ${payment.id}
    `

    console.log('[RefundDispatcher] Stars refund successful', {
      paymentId: payment.id,
      telegramChargeId: payment.telegram_charge_id,
    })

    return {
      success: true,
      provider: 'stars',
      refundId: payment.telegram_charge_id,
      manualRefund: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[RefundDispatcher] Stars refund failed', {
      paymentId: payment.id,
      error: errorMessage,
    })

    return {
      success: false,
      provider: 'stars',
      manualRefund: true,
      manualInstructions: `Telegram API error: ${errorMessage}`,
    }
  }
}

/**
 * TON refund - Manual only (crypto cannot be auto-refunded)
 * Returns instructions for admin to send refund to user's wallet
 */
function refundTon(
  payment: PaymentDB,
  reason: string
): DispatcherResult {
  console.log('[RefundDispatcher] TON refund requires manual processing', {
    paymentId: payment.id,
    tonAmount: payment.ton_amount,
    senderAddress: payment.ton_sender_address,
  })

  // TON refunds are always manual - we can't auto-send crypto
  const instructions = payment.ton_sender_address
    ? `Send ${payment.ton_amount} TON to ${payment.ton_sender_address}. TX hash: ${payment.ton_tx_hash}`
    : `TON refund required (${payment.ton_amount} TON). Original TX: ${payment.ton_tx_hash}. User wallet unknown - contact user.`

  return {
    success: true, // "success" means we processed it correctly
    provider: 'ton',
    manualRefund: true,
    manualInstructions: instructions,
  }
}

/**
 * Wrapper for autoRefundForFailedGeneration that uses dispatcher
 * Drop-in replacement for the old tbank-only version
 */
export async function autoRefundForFailedGeneration(
  avatarId: number,
  userId: number
): Promise<{ success: boolean; refundedPaymentId?: string; error?: string }> {
  const { sql } = await import('../db')

  console.log('[RefundDispatcher] Auto-refund check for failed generation', {
    avatarId,
    userId,
  })

  try {
    // Find payment linked to the generation job
    const paymentResult = await sql`
      SELECT p.* FROM generation_jobs gj
      JOIN payments p ON gj.payment_id = p.id
      WHERE gj.avatar_id = ${avatarId}
        AND p.status = 'succeeded'
      ORDER BY gj.created_at DESC
      LIMIT 1
    `.then((rows: any[]) => rows[0])

    if (!paymentResult) {
      // Fallback: latest succeeded payment for user
      const fallbackPayment = await sql`
        SELECT * FROM payments
        WHERE user_id = ${userId}
          AND status = 'succeeded'
        ORDER BY created_at DESC
        LIMIT 1
      `.then((rows: any[]) => rows[0])

      if (!fallbackPayment) {
        console.warn('[RefundDispatcher] No payment found for refund', {
          avatarId,
          userId,
        })
        return { success: false, error: 'No payment found' }
      }

      // Use fallback
      const result = await dispatchRefund({
        payment: fallbackPayment as PaymentDB,
        reason: 'Generation failed',
      })

      return {
        success: result.success,
        refundedPaymentId: result.refundId || paymentResult?.id?.toString(),
        error: result.manualRefund ? result.manualInstructions : undefined,
      }
    }

    // Dispatch to correct provider
    const result = await dispatchRefund({
      payment: paymentResult as PaymentDB,
      reason: 'Generation failed',
    })

    return {
      success: result.success,
      refundedPaymentId: result.refundId || paymentResult.id?.toString(),
      error: result.manualRefund ? result.manualInstructions : undefined,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[RefundDispatcher] Auto-refund failed', {
      avatarId,
      userId,
      error: errorMessage,
    })

    return { success: false, error: errorMessage }
  }
}
