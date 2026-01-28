/**
 * Debug endpoint to create test partner
 * REMOVE AFTER TESTING
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json()

    // Simple security check
    if (secret !== 'create-partner-2026') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
    }

    const email = 'testpartner@pinglass.ru'
    const password = 'Partner123!'
    const firstName = 'Test'
    const lastName = 'Partner'

    // Generate password hash
    const passwordHash = bcrypt.hashSync(password, 10)

    // Step 1: Check if partner already exists
    const existingPartner = await sql`
      SELECT id, email, user_id FROM partner_users WHERE email = ${email}
    `.then((r: any[]) => r[0])

    if (existingPartner) {
      // Update password and return
      await sql`
        UPDATE partner_users
        SET password_hash = ${passwordHash}
        WHERE email = ${email}
      `
      return NextResponse.json({
        success: true,
        message: 'Partner already exists, password updated',
        email,
        password,
        userId: existingPartner.user_id
      })
    }

    // Step 2: Create user in users table
    const userResult = await sql`
      INSERT INTO users (telegram_user_id, telegram_username, created_at)
      VALUES (${999888777}, ${'testpartner'}, NOW())
      ON CONFLICT (telegram_user_id) DO UPDATE SET telegram_username = 'testpartner'
      RETURNING id
    `.then((r: any[]) => r[0])

    const userId = userResult.id

    // Step 3: Create partner_users entry
    await sql`
      INSERT INTO partner_users (user_id, email, password_hash, first_name, last_name, is_active)
      VALUES (${userId}, ${email}, ${passwordHash}, ${firstName}, ${lastName}, TRUE)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = ${passwordHash},
        user_id = ${userId}
    `

    // Step 4: Create referral_balances with is_partner=true
    await sql`
      INSERT INTO referral_balances (user_id, referral_code, balance_rub, balance_ton, earned_rub, earned_ton, is_partner, commission_rate)
      VALUES (${userId}, ${'TESTPARTNER2026'}, 1500.00, 0.5, 3500.00, 1.2, TRUE, 0.50)
      ON CONFLICT (user_id) DO UPDATE SET
        is_partner = TRUE,
        commission_rate = 0.50,
        referral_code = 'TESTPARTNER2026',
        balance_rub = 1500.00,
        balance_ton = 0.5,
        earned_rub = 3500.00,
        earned_ton = 1.2
    `

    // Step 5: Create some test referrals
    // First create referred users
    for (let i = 1; i <= 5; i++) {
      const refUserId = await sql`
        INSERT INTO users (telegram_user_id, telegram_username, created_at)
        VALUES (${100000 + i}, ${'referral_user_' + i}, NOW() - INTERVAL '${i} days')
        ON CONFLICT (telegram_user_id) DO UPDATE SET telegram_username = ${'referral_user_' + i}
        RETURNING id
      `.then((r: any[]) => r[0]?.id)

      if (refUserId) {
        // Create referral link
        await sql`
          INSERT INTO referrals (referrer_id, referred_id, created_at)
          VALUES (${userId}, ${refUserId}, NOW() - INTERVAL '${i} days')
          ON CONFLICT (referrer_id, referred_id) DO NOTHING
        `

        // Create some earnings for first 3 referrals
        if (i <= 3) {
          await sql`
            INSERT INTO referral_earnings (referrer_id, referred_id, amount, original_amount, rate, currency, status, created_at)
            VALUES (${userId}, ${refUserId}, ${100 + i * 50}, ${1000 + i * 500}, 0.10, 'RUB', 'credited', NOW() - INTERVAL '${i} days')
            ON CONFLICT DO NOTHING
          `
        }
      }
    }

    // Step 6: Create test withdrawal
    await sql`
      INSERT INTO referral_withdrawals (user_id, amount, ndfl_amount, payout_amount, method, card_number, status, created_at)
      VALUES (${userId}, 1000.00, 130.00, 870.00, 'card', '**** 1234', 'completed', NOW() - INTERVAL '7 days')
      ON CONFLICT DO NOTHING
    `

    return NextResponse.json({
      success: true,
      message: 'Test partner created successfully',
      credentials: {
        email,
        password
      },
      userId,
      referralCode: 'TESTPARTNER2026',
      testData: {
        referrals: 5,
        earnings: 3,
        withdrawals: 1
      }
    })

  } catch (error) {
    console.error('[Create Test Partner] Error:', error)
    return NextResponse.json({
      error: 'Failed to create test partner',
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
    }, { status: 500 })
  }
}
