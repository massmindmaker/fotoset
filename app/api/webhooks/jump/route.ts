/**
 * POST /api/webhooks/jump
 *
 * Webhook handler for Jump.Finance payout status updates
 *
 * Events:
 * - payout.completed - Payout successfully sent via SBP
 * - payout.failed - Payout failed (insufficient funds, wrong phone, etc.)
 *
 * Security:
 * - Verifies HMAC-SHA256 signature using JUMP_SECRET_KEY
 * - Logs all webhook events to jump_webhook_logs table
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { jumpFinance } from '@/lib/jump'

// Webhook event types from Jump.Finance
interface JumpWebhookEvent {
  event: 'payout.completed' | 'payout.failed' | 'payout.pending'
  payoutId: string
  orderId: string // Our WD-{withdrawalId}
  status: 'pending' | 'processing' | 'completed' | 'failed'
  amount: number // In kopeks
  completedAt?: string
  receiptUrl?: string
  error?: {
    code: string
    message: string
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let rawPayload = ''

  try {
    // Read raw body for signature verification
    rawPayload = await request.text()

    // Get signature headers
    const signature = request.headers.get('x-signature') || ''
    const timestamp = request.headers.get('x-timestamp') || ''

    // Log incoming webhook
    console.log('[Jump Webhook] Received', {
      signature: signature.slice(0, 20) + '...',
      timestamp,
      bodyLength: rawPayload.length
    })

    // Verify signature if configured
    if (process.env.JUMP_SECRET_KEY) {
      const isValid = jumpFinance.verifyWebhookSignature(rawPayload, signature, timestamp)

      if (!isValid) {
        console.error('[Jump Webhook] Invalid signature')

        // Log failed verification
        await sql`
          INSERT INTO jump_webhook_logs (event_type, payload, signature_valid, error_message)
          VALUES ('unknown', ${rawPayload}::jsonb, false, 'Invalid signature')
        `.catch(console.error)

        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    } else {
      console.warn('[Jump Webhook] JUMP_SECRET_KEY not configured - skipping signature verification')
    }

    // Parse event
    const event: JumpWebhookEvent = JSON.parse(rawPayload)

    // Extract withdrawal ID from orderId (format: WD-{id})
    const withdrawalIdMatch = event.orderId?.match(/^WD-(\d+)$/)
    if (!withdrawalIdMatch) {
      console.error('[Jump Webhook] Invalid orderId format:', event.orderId)

      await sql`
        INSERT INTO jump_webhook_logs (event_type, payload, signature_valid, error_message, processing_time_ms)
        VALUES (${event.event}, ${rawPayload}::jsonb, true, 'Invalid orderId format', ${Date.now() - startTime})
      `

      return NextResponse.json(
        { error: 'Invalid orderId format' },
        { status: 400 }
      )
    }

    const withdrawalId = parseInt(withdrawalIdMatch[1], 10)

    // Get withdrawal
    const withdrawal = await sql`
      SELECT w.*, u.telegram_user_id
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      WHERE w.id = ${withdrawalId}
    `.then((rows: any[]) => rows[0])

    if (!withdrawal) {
      console.error('[Jump Webhook] Withdrawal not found:', withdrawalId)

      await sql`
        INSERT INTO jump_webhook_logs (event_type, payload, signature_valid, error_message, processing_time_ms)
        VALUES (${event.event}, ${rawPayload}::jsonb, true, 'Withdrawal not found', ${Date.now() - startTime})
      `

      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      )
    }

    // Process event
    let processed = false
    let errorMessage: string | null = null

    switch (event.event) {
      case 'payout.completed':
        // Success! Update withdrawal status
        await sql`
          UPDATE withdrawals
          SET
            status = 'completed',
            jump_receipt_url = ${event.receiptUrl || null},
            completed_at = ${event.completedAt || new Date().toISOString()},
            updated_at = NOW()
          WHERE id = ${withdrawalId}
        `

        processed = true
        console.log('[Jump Webhook] Payout completed', {
          withdrawalId,
          jumpPayoutId: event.payoutId,
          amount: event.amount / 100
        })

        // Send Telegram notification
        await sendTelegramNotification(
          withdrawal.telegram_user_id,
          `✅ Выплата ${parseFloat(withdrawal.payout_amount)}₽ отправлена на ${maskPhone(withdrawal.phone)}.\n\n` +
          (event.receiptUrl ? `📄 Чек: ${event.receiptUrl}` : '')
        )
        break

      case 'payout.failed':
        // Failure - need to restore balance
        const failError = event.error?.message || 'Unknown error'

        await sql`
          UPDATE withdrawals
          SET
            status = 'failed',
            error_message = ${failError},
            updated_at = NOW()
          WHERE id = ${withdrawalId}
        `

        // Restore balance
        await sql`
          UPDATE referral_balances
          SET
            balance_rub = balance_rub + ${withdrawal.amount},
            total_withdrawn_rub = total_withdrawn_rub - ${withdrawal.payout_amount},
            updated_at = NOW()
          WHERE user_id = ${withdrawal.user_id}
        `

        processed = true
        errorMessage = failError
        console.error('[Jump Webhook] Payout failed', {
          withdrawalId,
          jumpPayoutId: event.payoutId,
          error: failError
        })

        // Send Telegram notification
        await sendTelegramNotification(
          withdrawal.telegram_user_id,
          `❌ Выплата ${parseFloat(withdrawal.payout_amount)}₽ не удалась.\n\n` +
          `Причина: ${failError}\n\n` +
          `Средства возвращены на баланс. Попробуйте снова или обратитесь в поддержку.`
        )
        break

      case 'payout.pending':
        // Just update status, no action needed
        processed = true
        console.log('[Jump Webhook] Payout still pending', {
          withdrawalId,
          jumpPayoutId: event.payoutId
        })
        break

      default:
        console.warn('[Jump Webhook] Unknown event type:', event.event)
        errorMessage = `Unknown event type: ${event.event}`
    }

    // Log webhook
    await sql`
      INSERT INTO jump_webhook_logs (
        event_type,
        payout_id,
        withdrawal_id,
        payload,
        signature_valid,
        processed,
        error_message,
        processing_time_ms
      )
      VALUES (
        ${event.event},
        ${event.payoutId},
        ${withdrawalId},
        ${rawPayload}::jsonb,
        true,
        ${processed},
        ${errorMessage},
        ${Date.now() - startTime}
      )
    `

    return NextResponse.json({
      success: true,
      processed,
      withdrawalId,
      event: event.event
    })

  } catch (error) {
    console.error('[Jump Webhook] Error:', error)

    // Log error
    await sql`
      INSERT INTO jump_webhook_logs (
        event_type,
        payload,
        signature_valid,
        processed,
        error_message,
        processing_time_ms
      )
      VALUES (
        'error',
        ${rawPayload ? sql`${rawPayload}::jsonb` : null},
        false,
        false,
        ${error instanceof Error ? error.message : 'Unknown error'},
        ${Date.now() - startTime}
      )
    `.catch(console.error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper: Mask phone number for display
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone
  return phone.slice(0, 4) + '****' + phone.slice(-2)
}

// Helper: Send Telegram notification
async function sendTelegramNotification(telegramUserId: string | number, message: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

  if (!TELEGRAM_BOT_TOKEN || !telegramUserId) {
    console.log('[Jump Webhook] Telegram notification skipped - not configured')
    return
  }

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramUserId,
        text: message,
        parse_mode: 'HTML'
      })
    })
  } catch (error) {
    console.error('[Jump Webhook] Telegram notification failed:', error)
  }
}

// GET: Simple health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'jump-webhook',
    timestamp: new Date().toISOString()
  })
}
