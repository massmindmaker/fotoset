/**
 * GET /api/payment/stars/status
 * Check Telegram Stars payment status
 *
 * Query params:
 * - telegram_user_id (required): Telegram user ID
 * - payment_id (optional): Specific payment to check
 *
 * Returns:
 * - paid: boolean - Whether user has paid
 * - status: string - Payment status (succeeded, pending, etc.)
 * - paymentId: string - The payment ID checked
 */

import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { processReferralEarning } from '@/lib/referral-earnings'
import { paymentLogger as log } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserId = searchParams.get('telegram_user_id')
    let paymentId = searchParams.get('payment_id')

    log.debug('🌟 Stars Status Check:', {
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
      log.warn('🌟 DATABASE_URL not configured, using test mode')
      return NextResponse.json({
        paid: false,
        status: 'pending',
        testMode: true,
      })
    }

    // Find user by telegram_user_id
    const user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${parseInt(telegramUserId)}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      log.debug('🌟 User not found, returning no_payment')
      return NextResponse.json({
        paid: false,
        status: 'no_user',
      })
    }

    // If no paymentId provided, find latest Stars payment for this user
    if (!paymentId) {
      try {
        const latestPayment = await sql`
          SELECT id, status, payment_id
          FROM payments
          WHERE user_id = ${user.id}
            AND provider = 'stars'
          ORDER BY created_at DESC
          LIMIT 1
        `.then((rows: any[]) => rows[0])

        if (!latestPayment) {
          log.debug('🌟 No Stars payments found for user')
          return NextResponse.json({
            paid: false,
            status: 'no_payment',
          })
        }

        paymentId = latestPayment.payment_id

        // If already succeeded in DB, return immediately
        if (latestPayment.status === 'succeeded') {
          log.debug('🌟 Latest payment already succeeded:', {
            paymentId,
          })
          return NextResponse.json({
            paid: true,
            status: 'succeeded',
            paymentId,
          })
        }
      } catch (err) {
        log.error('🌟 Error finding latest payment:', err)
        return NextResponse.json({
          paid: false,
          status: 'pending',
        })
      }
    }

    // Check payment status in database
    // Stars payments are confirmed via webhook, no external API polling needed
    try {
      const payment = await sql`
        SELECT id, status, user_id, payment_id
        FROM payments
        WHERE payment_id = ${paymentId}
          AND provider = 'stars'
      `.then((rows: any[]) => rows[0])

      if (!payment) {
        log.warn('🌟 Payment not found:', { paymentId })
        return NextResponse.json({
          paid: false,
          status: 'not_found',
          error: 'Payment not found',
        })
      }

      // Verify payment belongs to this user (security check)
      if (payment.user_id !== user.id) {
        log.warn('🌟 Payment user mismatch:', {
          paymentUserId: payment.user_id,
          requestUserId: user.id,
        })
        return NextResponse.json(
          { error: 'Payment does not belong to user' },
          { status: 403 }
        )
      }

      const isSucceeded = payment.status === 'succeeded'

      // If payment just succeeded, process referral earnings
      // (Idempotent - processReferralEarning handles duplicate calls)
      if (isSucceeded) {
        try {
          const result = await processReferralEarning(payment.id, payment.user_id)

          if (result.success && result.credited) {
            log.info(`🌟 Referral earning processed: ${result.credited} to ${result.referrerId}`)
          } else if (result.alreadyProcessed) {
            log.debug('🌟 Referral earning already processed')
          }
        } catch (referralError) {
          // Don't fail the status check if referral processing fails
          log.error('🌟 Referral processing error:', referralError)
        }
      }

      log.debug('🌟 Payment status:', {
        paymentId: payment.payment_id,
        status: payment.status,
        paid: isSucceeded,
      })

      return NextResponse.json({
        paid: isSucceeded,
        status: payment.status,
        paymentId: payment.payment_id,
      })
    } catch (dbError) {
      log.error('🌟 Database error:', dbError)
      return NextResponse.json({
        paid: false,
        status: 'pending',
        error: 'db_error',
      })
    }
  } catch (error) {
    log.error('🌟 Stars status check error:', error)
    return NextResponse.json(
      {
        paid: false,
        status: 'pending',
        error: 'check_failed',
      },
      { status: 500 }
    )
  }
}
