/**
 * GET /api/admin/payments/[paymentId]
 * Get detailed payment information
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

import { getCurrentSession } from '@/lib/admin/session'
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { paymentId } = await context.params
    const paymentIdNum = parseInt(paymentId, 10)

    if (isNaN(paymentIdNum)) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }
    const [payment] = await sql`
      SELECT
        p.id,
        p.tbank_payment_id,
        p.user_id,
        u.telegram_user_id,
        u.telegram_username,
        p.amount,
        p.currency,
        p.tier_id,
        p.photo_count,
        p.status,
        p.refund_status,
        p.refund_amount,
        p.refund_reason,
        p.refund_at,
        p.is_test_mode,
        p.generation_consumed,
        p.consumed_at,
        p.created_at,
        p.updated_at,
        p.consumed_avatar_id as avatar_id,
        a.name as avatar_name,
        a.status as avatar_status,
        (SELECT COUNT(*) FROM generated_photos WHERE avatar_id = p.consumed_avatar_id)::int as photos_generated,
        -- Multi-provider columns
        COALESCE(p.provider, 'tbank') as provider,
        p.telegram_charge_id,
        p.stars_amount,
        p.ton_tx_hash,
        p.ton_amount,
        p.ton_sender_address,
        p.ton_confirmations,
        p.original_currency,
        p.original_amount,
        p.exchange_rate,
        p.rate_locked_at,
        p.rate_expires_at
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN avatars a ON a.id = p.consumed_avatar_id
      WHERE p.id = ${paymentIdNum}
    `

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({
      payment: {
        ...payment,
        telegram_user_id: payment.telegram_user_id?.toString()
      }
    })
  } catch (error) {
    console.error('[Admin Payment Details] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment details' },
      { status: 500 }
    )
  }
}
