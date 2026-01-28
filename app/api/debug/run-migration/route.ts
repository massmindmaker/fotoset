/**
 * Debug endpoint to run critical migrations
 * REMOVE AFTER DEBUGGING
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { secret, migration } = await request.json()

    if (secret !== 'debug-migrate-2026') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
    }

    const results: string[] = []

    if (migration === 'partner_users' || migration === 'all') {
      // Create partner_users table
      await sql`
        CREATE TABLE IF NOT EXISTS partner_users (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          is_active BOOLEAN DEFAULT TRUE,
          last_login_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      results.push('Created partner_users table')

      // Create partner_sessions table
      await sql`
        CREATE TABLE IF NOT EXISTS partner_sessions (
          id SERIAL PRIMARY KEY,
          partner_id INTEGER NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
          session_token VARCHAR(255) NOT NULL UNIQUE,
          ip_address VARCHAR(45),
          user_agent TEXT,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      results.push('Created partner_sessions table')

      // Create indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_partner_users_email ON partner_users(email)`
      await sql`CREATE INDEX IF NOT EXISTS idx_partner_users_user_id ON partner_users(user_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_partner_sessions_partner_id ON partner_sessions(partner_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_partner_sessions_token ON partner_sessions(session_token)`
      results.push('Created indexes')
    }

    if (migration === 'test_partner' || migration === 'all') {
      // Find or create test user
      let userResult = await sql`
        SELECT id FROM users WHERE telegram_user_id = 123456789
      `

      let userId: number
      if (userResult.length === 0) {
        const newUser = await sql`
          INSERT INTO users (telegram_user_id, telegram_username, created_at)
          VALUES (123456789, 'test_partner', NOW())
          RETURNING id
        `
        userId = newUser[0].id
        results.push(`Created test user with id ${userId}`)
      } else {
        userId = userResult[0].id
        results.push(`Using existing user with id ${userId}`)
      }

      // Ensure referral_balances has is_partner=true
      await sql`
        INSERT INTO referral_balances (user_id, is_partner, commission_rate, balance)
        VALUES (${userId}, TRUE, 0.50, 0)
        ON CONFLICT (user_id) DO UPDATE SET is_partner = TRUE, commission_rate = 0.50
      `
      results.push('Set is_partner=true in referral_balances')

      // Create partner_user with bcrypt hash (sync works for hashing in Edge)
      const bcrypt = await import('bcryptjs')
      const hash = bcrypt.default.hashSync('partner123', 10)

      try {
        await sql`
          INSERT INTO partner_users (user_id, email, password_hash, first_name, last_name, is_active)
          VALUES (${userId}, 'partner@pinglass.ru', ${hash}, 'Test', 'Partner', TRUE)
        `
        results.push('Created test partner: partner@pinglass.ru / partner123')
      } catch (e) {
        // If duplicate, update
        await sql`
          UPDATE partner_users SET password_hash = ${hash} WHERE email = 'partner@pinglass.ru'
        `
        results.push('Updated existing partner password')
      }
    }

    return NextResponse.json({ success: true, results })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
