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
import { processReferralEarning } from '@/lib/referral-earnings'
import { neon } from '@neondatabase/serverless'

// Verify webhook is from Telegram (REQUIRED in all environments except development)
function verifyTelegramWebhook(request: NextRequest): { valid: boolean; error?: string } {
  // Telegram doesn't sign webhooks like T-Bank does
  // We use the secret token header for verification
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token')
  const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET
  const isDevelopment = process.env.NODE_ENV === 'development'

  // SECURITY FIX: Secret is REQUIRED in all non-development environments
  // This prevents attacks when NODE_ENV is misconfigured or unset
  if (!expectedToken) {
    if (isDevelopment) {
      console.warn('[Telegram Webhook] DEV ONLY: TELEGRAM_WEBHOOK_SECRET not configured, allowing unverified webhook')
      return { valid: true }
    }
    console.error('[Telegram Webhook] CRITICAL: TELEGRAM_WEBHOOK_SECRET not configured! Rejecting webhook.', {
      nodeEnv: process.env.NODE_ENV || 'undefined',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    })
    return { valid: false, error: 'Server misconfiguration' }
  }

  // Always verify secret when configured
  if (secretToken !== expectedToken) {
    console.warn('[Telegram Webhook] Invalid secret token', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    })
    return { valid: false, error: 'Invalid secret token' }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    // Verify request origin
    const verification = verifyTelegramWebhook(request)
    if (!verification.valid) {
      const statusCode = verification.error === 'Server misconfiguration' ? 500 : 401
      return NextResponse.json(
        { error: verification.error || 'Unauthorized' },
        { status: statusCode }
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

        // Process referral earnings (non-blocking)
        try {
          const sql = neon(process.env.DATABASE_URL!)
          // Need database payment.id (not provider payment_id) for processReferralEarning
          // result.paymentId is already our internal database ID (payments.id)
          const payment = await sql`
            SELECT id, user_id FROM payments 
            WHERE id = ${result.paymentId}::integer 
            AND provider = 'stars'
          `

          if (payment[0]?.id && payment[0]?.user_id) {
            await processReferralEarning(payment[0].id, payment[0].user_id)
            console.log('[Telegram Webhook] Referral earnings processed for user:', payment[0].user_id)
          }
        } catch (referralError) {
          // Don't fail the webhook if referral processing fails
          console.error('[Telegram Webhook] Referral processing failed:', referralError)
        }

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
