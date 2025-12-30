/**
 * GET /api/admin/payments/[paymentId]
 * Get detailed payment information
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

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

    const sql = getSql()

    const [payment] = await sql`
      SELECT
        p.id,
        p.tbank_payment_id,
        p.user_id,
        u.telegram_user_id,
        p.amount,
        p.tier_id,
        p.photo_count,
        p.status,
        p.email,
        p.error_code,
        p.error_message,
        p.refund_id,
        p.refund_reason,
        p.created_at,
        p.updated_at,
        u.is_pro as user_is_pro,
        p.avatar_id,
        a.name as avatar_name,
        a.status as avatar_status,
        (SELECT COUNT(*) FROM generated_photos WHERE avatar_id = p.avatar_id)::int as photos_generated
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN avatars a ON a.id = p.avatar_id
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
