/**
 * POST /api/payment/ton/create
 * Create a TON cryptocurrency payment
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { tonProvider } from '@/lib/payments/providers/ton'

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

    // Check if TON payments are enabled
    const isEnabled = await tonProvider.isEnabled()
    if (!isEnabled) {
      return NextResponse.json(
        { error: 'TON payments are not enabled' },
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
    const result = await tonProvider.createPayment({
      userId: user.id,
      tierId,
      avatarId: avatarId || undefined,
      provider: 'ton',
    })

    console.log('[TON Create] Payment created:', {
      paymentId: result.paymentId,
      tonAmount: result.amount,
      walletAddress: result.walletAddress,
      userId: user.id,
    })

    // Generate ton:// deep link for mobile wallets
    const tonLink = `ton://transfer/${result.walletAddress}?amount=${Math.floor(result.amount * 1e9)}&text=${result.providerPaymentId}`

    return NextResponse.json({
      success: true,
      paymentId: result.paymentId.toString(),
      tonAmount: result.amount,
      walletAddress: result.walletAddress,
      amountRub: result.amountRub,
      exchangeRate: result.exchangeRate,
      expiresAt: result.expiresAt,
      // Payment comment for matching
      comment: result.providerPaymentId,
      // Deep link for mobile wallets
      tonLink,
    })
  } catch (error) {
    console.error('[TON Create] Error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create TON payment',
      },
      { status: 500 }
    )
  }
}
