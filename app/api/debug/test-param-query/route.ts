/**
 * Test parameterized query like unified-login uses
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  console.log('[TestParamQuery] Starting...')

  try {
    // Step 1: Parse body (like unified-login)
    const body = await request.json()
    const { email, password } = body
    console.log('[TestParamQuery] Email:', email)
    console.log('[TestParamQuery] Password length:', password?.length)

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    console.log('[TestParamQuery] Normalized email:', normalizedEmail)

    // Step 2: Parameterized SELECT (exactly like unified-login)
    console.log('[TestParamQuery] Executing SELECT...')
    const admins = await sql`
      SELECT id, email, password_hash, role, first_name, last_name, is_active
      FROM admin_users
      WHERE LOWER(email) = ${normalizedEmail}
    `
    console.log('[TestParamQuery] SELECT done, rows:', admins.length)

    if (admins.length === 0) {
      return NextResponse.json({ error: 'Admin not found' })
    }

    const admin = admins[0]
    console.log('[TestParamQuery] Admin id:', admin.id)
    console.log('[TestParamQuery] Hash prefix:', admin.password_hash?.substring(0, 30))

    // Step 3: bcrypt compare
    console.log('[TestParamQuery] Comparing password...')
    const isValidPassword = await bcrypt.compare(password, admin.password_hash)
    console.log('[TestParamQuery] bcrypt result:', isValidPassword)

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        hashPrefix: admin.password_hash?.substring(0, 30)
      },
      bcrypt: {
        isValid: isValidPassword
      }
    })
  } catch (error) {
    console.error('[TestParamQuery] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
    })
  }
}
