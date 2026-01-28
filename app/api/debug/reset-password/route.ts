/**
 * Debug endpoint to reset admin/partner passwords
 * REMOVE AFTER DEBUGGING
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { secret, email, newPassword } = await request.json()

    // Simple security check
    if (secret !== 'debug-reset-2026') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
    }

    // Generate hash (use sync because it works in Edge for hashing)
    const hash = bcrypt.hashSync(newPassword, 10)

    // Try admin_users first
    const adminResult = await sql`
      UPDATE admin_users
      SET password_hash = ${hash}
      WHERE email = ${email}
      RETURNING id, email
    `

    if (adminResult.length > 0) {
      return NextResponse.json({
        success: true,
        type: 'admin',
        email: adminResult[0].email,
        hashPrefix: hash.substring(0, 20)
      })
    }

    // Try partner_users
    const partnerResult = await sql`
      UPDATE partner_users
      SET password_hash = ${hash}
      WHERE email = ${email}
      RETURNING id, email
    `

    if (partnerResult.length > 0) {
      return NextResponse.json({
        success: true,
        type: 'partner',
        email: partnerResult[0].email,
        hashPrefix: hash.substring(0, 20)
      })
    }

    return NextResponse.json({ error: 'User not found' }, { status: 404 })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
