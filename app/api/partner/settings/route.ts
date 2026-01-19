/**
 * GET/POST /api/partner/settings
 *
 * Partner payout settings management
 *
 * GET: Returns current settings
 * POST: Updates payout settings (phone, INN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const telegramUserId = request.headers.get('x-telegram-user-id')

    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user with settings
    const user = await sql`
      SELECT
        u.id,
        u.telegram_user_id,
        u.telegram_username,
        rb.referral_code,
        rb.is_partner,
        rb.commission_rate,
        pps.sbp_phone,
        pps.inn,
        pps.is_self_employed,
        pps.preferred_currency,
        pps.ton_wallet_address,
        sev.is_verified as npd_verified,
        sev.full_name as npd_full_name,
        sev.verified_at as npd_verified_at,
        sev.expires_at as npd_expires_at
      FROM users u
      LEFT JOIN referral_balances rb ON rb.user_id = u.id
      LEFT JOIN partner_payout_settings pps ON pps.user_id = u.id
      LEFT JOIN self_employed_verifications sev ON sev.user_id = u.id AND sev.is_verified = true
      WHERE u.telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if NPD verification is expired
    const npdExpired = user.npd_expires_at && new Date(user.npd_expires_at) < new Date()

    return NextResponse.json({
      user: {
        telegramUserId: String(user.telegram_user_id),
        username: user.telegram_username
      },
      referral: {
        code: user.referral_code,
        isPartner: user.is_partner || false,
        commissionRate: parseFloat(user.commission_rate || '0.10')
      },
      payout: {
        sbpPhone: user.sbp_phone || null,
        inn: user.inn ? user.inn.slice(0, 4) + '****' + user.inn.slice(-2) : null,
        hasInn: Boolean(user.inn),
        isSelfEmployed: user.is_self_employed || false,
        preferredCurrency: user.preferred_currency || 'RUB',
        tonWalletAddress: user.ton_wallet_address || null
      },
      npdVerification: {
        verified: user.npd_verified && !npdExpired,
        expired: npdExpired,
        fullName: user.npd_full_name || null,
        verifiedAt: user.npd_verified_at,
        expiresAt: user.npd_expires_at
      },
      feeInfo: {
        selfEmployedFee: 3, // 3% for self-employed
        regularFee: 6, // 6% for others
        currentFee: (user.npd_verified && !npdExpired) ? 3 : 6
      }
    })

  } catch (error) {
    console.error('[Partner Settings GET] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const telegramUserId = request.headers.get('x-telegram-user-id')

    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user
    const user = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { sbpPhone, tonWalletAddress, preferredCurrency } = body

    // Validate phone if provided
    if (sbpPhone !== undefined) {
      if (sbpPhone && !/^\+7\d{10}$/.test(sbpPhone)) {
        return NextResponse.json(
          { error: 'Invalid phone format. Use +7XXXXXXXXXX' },
          { status: 400 }
        )
      }
    }

    // Validate TON wallet if provided
    if (tonWalletAddress !== undefined) {
      if (tonWalletAddress && !/^(EQ|UQ)[a-zA-Z0-9_-]{46}$/.test(tonWalletAddress)) {
        return NextResponse.json(
          { error: 'Invalid TON wallet address format' },
          { status: 400 }
        )
      }
    }

    // Validate currency
    if (preferredCurrency && !['RUB', 'TON'].includes(preferredCurrency)) {
      return NextResponse.json(
        { error: 'Invalid currency. Use RUB or TON' },
        { status: 400 }
      )
    }

    // Upsert settings
    await sql`
      INSERT INTO partner_payout_settings (user_id, sbp_phone, ton_wallet_address, preferred_currency)
      VALUES (
        ${user.id},
        ${sbpPhone !== undefined ? sbpPhone : null},
        ${tonWalletAddress !== undefined ? tonWalletAddress : null},
        ${preferredCurrency || 'RUB'}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        sbp_phone = COALESCE(${sbpPhone !== undefined ? sbpPhone : sql`partner_payout_settings.sbp_phone`}, partner_payout_settings.sbp_phone),
        ton_wallet_address = COALESCE(${tonWalletAddress !== undefined ? tonWalletAddress : sql`partner_payout_settings.ton_wallet_address`}, partner_payout_settings.ton_wallet_address),
        preferred_currency = COALESCE(${preferredCurrency || null}, partner_payout_settings.preferred_currency),
        updated_at = NOW()
    `

    console.log('[Partner Settings] Updated settings', {
      userId: user.id,
      updatedFields: Object.keys(body)
    })

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully'
    })

  } catch (error) {
    console.error('[Partner Settings POST] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
