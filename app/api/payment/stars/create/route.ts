/**
 * POST /api/payment/stars/create
 * Create a Telegram Stars payment
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { starsProvider } from '@/lib/payments/providers/telegram-stars'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramUserId, tierId, photoCount, avatarId } = body

    // Validate required fields
    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'telegramUserId is required' },
        { status: 400 }
      )
    }

    if (!tierId || !['starter', 'standard', 'premium'].includes(tierId)) {
      return NextResponse.json(
        { error: 'Valid tierId is required (starter, standard, premium)' },
        { status: 400 }
      )
    }

    // Check if Stars payments are enabled
    const isEnabled = await starsProvider.isEnabled()
    if (!isEnabled) {
      return NextResponse.json(
        { error: 'Telegram Stars payments are not enabled' },
        { status: 400 }
      )
    }

    // Get or create user by telegram_user_id
    let user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      // Create user with telegram_user_id
      const [newUser] = await sql`
        INSERT INTO users (telegram_user_id, created_at, updated_at)
        VALUES (${telegramUserId}, NOW(), NOW())
        RETURNING id
      `
      user = newUser
    }

    // Create payment
    const result = await starsProvider.createPayment({
      userId: user.id,
      tierId,
      avatarId: avatarId || undefined,
      provider: 'stars',
    })

    console.log('[Stars Create] Payment created:', {
      paymentId: result.paymentId,
      stars: result.amount,
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      paymentId: result.paymentId.toString(),
      starsAmount: result.amount,
      amountRub: result.amountRub,
      // No URL - invoice is sent directly to Telegram chat
      message: 'Invoice sent to your Telegram',
    })
  } catch (error) {
    console.error('[Stars Create] Error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create Stars payment',
      },
      { status: 500 }
    )
  }
}
