/**
 * POST /api/partner/verify-npd
 *
 * Verifies self-employed (НПД) status through Jump.Finance / FNS
 *
 * Required fields:
 * - inn: 12-digit Individual Tax Number
 * - phone: Phone number for SBP payouts (+7XXXXXXXXXX)
 *
 * Returns:
 * - verified: Whether the person is a registered self-employed
 * - status: 'active' | 'inactive' | 'not_found'
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { jumpFinance } from '@/lib/jump'

export async function POST(request: NextRequest) {
  try {
    // Get user from session/auth
    const telegramUserId = request.headers.get('x-telegram-user-id')

    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login.' },
        { status: 401 }
      )
    }

    // Get user from DB
    const user = await sql`
      SELECT u.id, rb.is_partner
      FROM users u
      LEFT JOIN referral_balances rb ON rb.user_id = u.id
      WHERE u.telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { inn, phone } = body

    // Validate INN (12 digits for individuals)
    if (!inn || !/^\d{12}$/.test(inn)) {
      return NextResponse.json(
        { error: 'Invalid INN format. Must be 12 digits.' },
        { status: 400 }
      )
    }

    // Validate phone format
    if (!phone || !/^\+7\d{10}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone format. Use +7XXXXXXXXXX' },
        { status: 400 }
      )
    }

    // Check if Jump.Finance is configured
    if (!jumpFinance.isConfigured()) {
      // Fallback: store data without verification (manual verification later)
      console.log('[verify-npd] Jump.Finance not configured, storing without verification', {
        userId: user.id,
        inn: inn.slice(0, 4) + '****',
      })

      // Store verification request for manual processing
      await sql`
        INSERT INTO self_employed_verifications (user_id, inn, phone, is_verified, verification_source)
        VALUES (${user.id}, ${inn}, ${phone}, false, 'pending_manual')
        ON CONFLICT (user_id) DO UPDATE SET
          inn = EXCLUDED.inn,
          phone = EXCLUDED.phone,
          is_verified = false,
          verification_source = 'pending_manual',
          updated_at = NOW()
      `

      return NextResponse.json({
        verified: false,
        status: 'pending',
        message: 'Verification submitted. Will be processed manually within 24 hours.',
      })
    }

    // Verify self-employed status via Jump.Finance
    const verification = await jumpFinance.verifySelfEmployed(inn)

    // Store verification result
    await sql`
      INSERT INTO self_employed_verifications (
        user_id, inn, phone, full_name, is_verified, verification_source,
        verified_at, registration_date, region_code, expires_at
      )
      VALUES (
        ${user.id},
        ${inn},
        ${phone},
        ${verification.fullName || null},
        ${verification.verified},
        'jump',
        ${verification.verified ? new Date().toISOString() : null},
        ${verification.registrationDate || null},
        ${verification.regionCode || null},
        ${verification.verified ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        inn = EXCLUDED.inn,
        phone = EXCLUDED.phone,
        full_name = EXCLUDED.full_name,
        is_verified = EXCLUDED.is_verified,
        verification_source = EXCLUDED.verification_source,
        verified_at = EXCLUDED.verified_at,
        registration_date = EXCLUDED.registration_date,
        region_code = EXCLUDED.region_code,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `

    // Also update partner payout settings
    await sql`
      INSERT INTO partner_payout_settings (user_id, inn, sbp_phone, is_self_employed)
      VALUES (${user.id}, ${inn}, ${phone}, ${verification.verified})
      ON CONFLICT (user_id) DO UPDATE SET
        inn = EXCLUDED.inn,
        sbp_phone = EXCLUDED.sbp_phone,
        is_self_employed = EXCLUDED.is_self_employed,
        updated_at = NOW()
    `

    console.log('[verify-npd] Verification completed', {
      userId: user.id,
      verified: verification.verified,
      status: verification.status,
    })

    return NextResponse.json({
      verified: verification.verified,
      status: verification.status,
      message: verification.verified
        ? 'Статус самозанятого подтверждён. Комиссия при выводе: 3%'
        : 'Статус самозанятого не подтверждён. При выводе будет удержана комиссия 6%',
      fullName: verification.fullName,
      registrationDate: verification.registrationDate,
    })

  } catch (error) {
    console.error('[verify-npd] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: Check current verification status
export async function GET(request: NextRequest) {
  try {
    const telegramUserId = request.headers.get('x-telegram-user-id')

    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await sql`
      SELECT u.id FROM users u
      WHERE u.telegram_user_id = ${telegramUserId}
    `.then((rows: any[]) => rows[0])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get current verification
    const verification = await sql`
      SELECT
        inn,
        phone,
        full_name,
        is_verified,
        verification_source,
        verified_at,
        expires_at,
        registration_date
      FROM self_employed_verifications
      WHERE user_id = ${user.id}
    `.then((rows: any[]) => rows[0])

    if (!verification) {
      return NextResponse.json({
        hasVerification: false,
        verified: false,
      })
    }

    // Check if verification expired
    const isExpired = verification.expires_at && new Date(verification.expires_at) < new Date()

    return NextResponse.json({
      hasVerification: true,
      verified: verification.is_verified && !isExpired,
      isExpired,
      inn: verification.inn ? verification.inn.slice(0, 4) + '****' + verification.inn.slice(-2) : null,
      phone: verification.phone,
      fullName: verification.full_name,
      verifiedAt: verification.verified_at,
      expiresAt: verification.expires_at,
      source: verification.verification_source,
    })

  } catch (error) {
    console.error('[verify-npd] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
