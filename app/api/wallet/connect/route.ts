/**
 * POST /api/wallet/connect
 * 
 * Saves the connected TON wallet address to the user's profile.
 * Called after TonConnect successfully connects a wallet.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { findOrCreateUser } from '@/lib/user-identity'

// Validate TON address format
function isValidTonAddress(address: string): boolean {
  // User-friendly format: EQ... or UQ... (48 chars base64)
  const userFriendlyRegex = /^[EU]Q[A-Za-z0-9_-]{46}$/
  // Raw format: -1:... or 0:... (workchain:hex, 66 chars hex part)
  const rawRegex = /^-?[0-9]+:[a-fA-F0-9]{64}$/

  return userFriendlyRegex.test(address) || rawRegex.test(address)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      walletAddress, 
      publicKey,
      telegramUserId,
      neonUserId 
    } = body

    // Validate wallet address
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    if (!isValidTonAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid TON wallet address format' },
        { status: 400 }
      )
    }

    // Get or create user
    const user = await findOrCreateUser({
      telegramUserId: telegramUserId ? Number(telegramUserId) : undefined,
      neonUserId: neonUserId ? String(neonUserId) : undefined
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userId = user.id

    // Check if this wallet is already connected to another user
    const existingWallet = await sql`
      SELECT id, telegram_user_id 
      FROM users 
      WHERE ton_wallet_address = ${walletAddress}
        AND id != ${userId}
    `

    if (existingWallet.length > 0) {
      return NextResponse.json(
        { error: 'This wallet is already connected to another account' },
        { status: 409 }
      )
    }

    // Update user with wallet address
    await sql`
      UPDATE users 
      SET ton_wallet_address = ${walletAddress},
          ton_wallet_connected_at = NOW()
      WHERE id = ${userId}
    `

    console.log(`[Wallet/Connect] User ${userId} connected wallet ${walletAddress.slice(0, 8)}...`)

    return NextResponse.json({
      success: true,
      walletAddress,
      message: 'Wallet connected successfully'
    })

  } catch (error) {
    console.error('[Wallet/Connect] Error:', error)
    return NextResponse.json(
      { error: 'Failed to connect wallet' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/wallet/connect
 * 
 * Disconnects the TON wallet from the user's profile.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserId = searchParams.get('telegram_user_id')
    const neonUserId = searchParams.get('neon_user_id')

    if (!telegramUserId && !neonUserId) {
      return NextResponse.json(
        { error: 'User identifier is required' },
        { status: 400 }
      )
    }

    // Find user
    let userId: number | null = null

    if (telegramUserId) {
      const result = await sql`
        SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
      `
      userId = result[0]?.id
    } else if (neonUserId) {
      const result = await sql`
        SELECT id FROM users WHERE neon_user_id = ${neonUserId}
      `
      userId = result[0]?.id
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Disconnect wallet
    await sql`
      UPDATE users 
      SET ton_wallet_address = NULL,
          ton_wallet_connected_at = NULL
      WHERE id = ${userId}
    `

    console.log(`[Wallet/Connect] User ${userId} disconnected wallet`)

    return NextResponse.json({
      success: true,
      message: 'Wallet disconnected successfully'
    })

  } catch (error) {
    console.error('[Wallet/Connect] Disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect wallet' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/wallet/connect
 * 
 * Get the connected wallet for a user.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramUserId = searchParams.get('telegram_user_id')
    const neonUserId = searchParams.get('neon_user_id')

    if (!telegramUserId && !neonUserId) {
      return NextResponse.json(
        { error: 'User identifier is required' },
        { status: 400 }
      )
    }

    // Find user
    let user: any = null

    if (telegramUserId) {
      const result = await sql`
        SELECT id, ton_wallet_address, ton_wallet_connected_at 
        FROM users 
        WHERE telegram_user_id = ${telegramUserId}
      `
      user = result[0]
    } else if (neonUserId) {
      const result = await sql`
        SELECT id, ton_wallet_address, ton_wallet_connected_at 
        FROM users 
        WHERE neon_user_id = ${neonUserId}
      `
      user = result[0]
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      connected: !!user.ton_wallet_address,
      walletAddress: user.ton_wallet_address,
      connectedAt: user.ton_wallet_connected_at
    })

  } catch (error) {
    console.error('[Wallet/Connect] Get error:', error)
    return NextResponse.json(
      { error: 'Failed to get wallet info' },
      { status: 500 }
    )
  }
}
