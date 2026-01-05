import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { processReferralEarning } from '@/lib/referral-earnings'
import { paymentLogger as log } from '@/lib/logger'

const PAYMENT_EXPIRATION_MS = 30 * 60 * 1000 // 30 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserId = searchParams.get('telegram_user_id')
    const paymentId = searchParams.get('payment_id')

    log.debug('🟢 TON Status Check:', {
      telegramUserId,
      paymentId,
    })

    // SECURITY: Require telegramUserId (Telegram-only authentication)
    if (!telegramUserId || telegramUserId.trim().length === 0) {
      return NextResponse.json(
        { error: 'telegram_user_id is required' },
        { status: 400 }
      )
    }

    if (!process.env.DATABASE_URL) {
      log.warn('⚠️ DATABASE_URL not configured, using test mode')
      return NextResponse.json({
        status: 'pending',
        testMode: true,
      })
    }

    // Find user by telegram_user_id
    const user = await sql`
      SELECT id FROM users
      WHERE telegram_user_id = ${parseInt(telegramUserId)}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    let payment

    // If no paymentId provided, find the latest TON payment for this user
    if (!paymentId) {
      log.debug('🔍 Finding latest TON payment for user', user.id)

      payment = await sql`
        SELECT
          id,
          status,
          amount,
          ton_amount,
          provider_payment_id,
          ton_tx_hash,
          ton_confirmations,
          exchange_rate,
          rate_expires_at,
          created_at,
          updated_at
        FROM payments
        WHERE user_id = ${user.id}
          AND provider = 'ton'
        ORDER BY created_at DESC
        LIMIT 1
      `.then((rows: any[]) => rows[0])

      if (!payment) {
        return NextResponse.json({
          status: 'no_payment',
          message: 'No TON payments found for this user',
        })
      }
    } else {
      // Find specific payment by ID
      log.debug('🔍 Finding TON payment by ID', paymentId)

      payment = await sql`
        SELECT
          id,
          status,
          amount,
          ton_amount,
          provider_payment_id,
          ton_tx_hash,
          ton_confirmations,
          exchange_rate,
          rate_expires_at,
          created_at,
          updated_at,
          user_id
        FROM payments
        WHERE id = ${parseInt(paymentId)}
          AND provider = 'ton'
      `.then((rows: any[]) => rows[0])

      if (!payment) {
        return NextResponse.json(
          { error: 'TON payment not found' },
          { status: 404 }
        )
      }

      // SECURITY: Verify payment belongs to this user
      if (payment.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Payment does not belong to this user' },
          { status: 403 }
        )
      }
    }

    // Check if payment is expired
    const now = new Date()
    const rateExpiresAt = payment.rate_expires_at ? new Date(payment.rate_expires_at) : null
    const isExpired = rateExpiresAt && rateExpiresAt < now

    // If expired and still pending, mark as expired
    if (isExpired && payment.status === 'pending') {
      log.debug('⏰ Payment expired, updating status')

      await sql`
        UPDATE payments
        SET status = 'expired', updated_at = NOW()
        WHERE id = ${payment.id}
          AND status = 'pending'
      `

      payment.status = 'expired'
    }

    // Get wallet address for manual payment instructions
    const walletAddress = await getWalletAddress()

    // Build response
    const response: any = {
      paymentId: payment.id,
      status: payment.status,
      provider: 'ton',
      amount: {
        rub: Number(payment.amount),
        ton: Number(payment.ton_amount),
      },
      exchangeRate: payment.exchange_rate,
      comment: payment.provider_payment_id, // Format: PG<payment_id>
      walletAddress,
      expiresAt: rateExpiresAt?.toISOString(),
      isExpired,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    }

    // Add transaction details if payment is processing or succeeded
    if (payment.ton_tx_hash) {
      response.transaction = {
        hash: payment.ton_tx_hash,
        confirmations: payment.ton_confirmations || 0,
        requiredConfirmations: 10, // From ton.ts REQUIRED_CONFIRMATIONS
      }
    }

    // If payment succeeded, ensure referral was processed
    if (payment.status === 'succeeded') {
      log.debug('✅ Payment succeeded, checking referral')

      const referralResult = await processReferralEarning(payment.id, user.id)

      if (referralResult.success && referralResult.credited) {
        log.debug(`💰 Credited ${referralResult.credited} to referrer ${referralResult.referrerId}`)
      }
    }

    log.debug('📤 TON Status Response:', response)
    return NextResponse.json(response)

  } catch (error) {
    log.error('❌ TON Status check error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check TON payment status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Get TON wallet address from admin settings
 */
async function getWalletAddress(): Promise<string | null> {
  try {
    const [setting] = await sql`
      SELECT value FROM admin_settings WHERE key = 'payment_methods'
    `.catch(() => [null])

    return setting?.value?.ton?.walletAddress || null
  } catch {
    return null
  }
}
