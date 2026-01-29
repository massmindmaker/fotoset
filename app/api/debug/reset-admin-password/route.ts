/**
 * DEBUG ONLY: Reset admin password
 * DELETE IMMEDIATELY AFTER USE!
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, newPassword, secretKey } = body

    // Simple protection - require a secret key
    if (secretKey !== 'TEMP_DEBUG_KEY_2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and newPassword required' }, { status: 400 })
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(newPassword, salt)

    console.log('[ResetPassword] Hashing new password for:', email)
    console.log('[ResetPassword] New hash prefix:', passwordHash.substring(0, 25))

    // Update in database
    const result = await sql`
      UPDATE admin_users
      SET password_hash = ${passwordHash}
      WHERE LOWER(email) = LOWER(${email})
      RETURNING id, email
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Verify the hash works
    const isValid = await bcrypt.compare(newPassword, passwordHash)

    return NextResponse.json({
      success: true,
      admin: result[0],
      hashPrefix: passwordHash.substring(0, 25),
      verificationOk: isValid
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
