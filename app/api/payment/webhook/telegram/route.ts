/**
 * POST /api/payment/webhook/telegram
 * Handle Telegram Bot API webhooks for Stars payments
 *
 * Handles:
 * - pre_checkout_query: Payment confirmation request
 * - successful_payment: Payment completed
 */

import { NextRequest, NextResponse } from 'next/server'
import { starsProvider } from '@/lib/payments/providers/telegram-stars'

// Verify webhook is from Telegram (optional but recommended)
function verifyTelegramWebhook(request: NextRequest): boolean {
  // Telegram doesn't sign webhooks like T-Bank does
  // We rely on the secret webhook URL path being unknown to attackers
  // In production, consider using a secret token in the URL
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token')
  const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET

  // If secret is configured, verify it
  if (expectedToken && secretToken !== expectedToken) {
    console.warn('[Telegram Webhook] Invalid secret token')
    return false
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    // Verify request origin
    if (!verifyTelegramWebhook(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = await request.json()

    console.log('[Telegram Webhook] Received:', JSON.stringify(payload, null, 2))

    // Handle pre_checkout_query
    if (payload.pre_checkout_query) {
      const result = await starsProvider.processWebhook(payload)

      if (result.success) {
        // Telegram requires quick response for pre_checkout
        return NextResponse.json({ ok: true })
      } else {
        console.error('[Telegram Webhook] Pre-checkout failed:', result.error)
        return NextResponse.json({ ok: false, error: result.error })
      }
    }

    // Handle message with successful_payment
    if (payload.message?.successful_payment) {
      // Extract successful_payment to top level for provider
      const wrappedPayload = {
        ...payload,
        successful_payment: payload.message.successful_payment,
      }

      const result = await starsProvider.processWebhook(wrappedPayload)

      if (result.success) {
        console.log('[Telegram Webhook] Payment succeeded:', {
          paymentId: result.paymentId,
          status: result.status,
        })

        // Trigger generation if avatar was specified
        // This is handled by the payment polling on the frontend
        // or can be triggered here for immediate start

        return NextResponse.json({
          ok: true,
          paymentId: result.paymentId,
        })
      } else {
        console.error('[Telegram Webhook] Payment processing failed:', result.error)
        return NextResponse.json({
          ok: false,
          error: result.error,
        })
      }
    }

    // Handle refund event (if Telegram sends one)
    if (payload.refund) {
      console.log('[Telegram Webhook] Refund event:', payload.refund)
      // Refunds are initiated by us, not Telegram, so this is just logging
      return NextResponse.json({ ok: true })
    }

    // Unknown webhook type - log and acknowledge
    console.log('[Telegram Webhook] Unhandled update type:', Object.keys(payload))
    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)

    // Always return 200 to prevent Telegram from retrying
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Internal error',
    })
  }
}

// Also handle GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Telegram Stars webhook endpoint',
  })
}
