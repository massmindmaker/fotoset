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

    // Check 1: Can we just select id?
    console.log('[TestParamQuery] Step 2a: Simple SELECT...')
    const simpleCheck = await sql`
      SELECT id, email FROM admin_users WHERE LOWER(email) = ${normalizedEmail}
    `
    if (simpleCheck.length === 0) {
      return NextResponse.json({ checkpoint: 'step2a', error: 'Admin not found' })
    }

    // Check 2: Add password_hash
    console.log('[TestParamQuery] Step 2b: SELECT with password_hash...')
    const withHash = await sql`
      SELECT id, email, password_hash FROM admin_users WHERE LOWER(email) = ${normalizedEmail}
    `
    const admin = withHash[0]
    console.log('[TestParamQuery] Got admin, hash prefix:', admin.password_hash?.substring(0, 20))

    // Check 3: bcrypt compare
    console.log('[TestParamQuery] Step 3: bcrypt compare...')
    const isValidPassword = await bcrypt.compare(password, admin.password_hash)
    console.log('[TestParamQuery] bcrypt result:', isValidPassword)

    return NextResponse.json({
      checkpoint: 'after_bcrypt',
      admin: {
        id: admin.id,
        email: admin.email,
        hashPrefix: admin.password_hash?.substring(0, 30),
        hashLength: admin.password_hash?.length
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
