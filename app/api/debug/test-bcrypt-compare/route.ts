/**
 * Test bcrypt compare in Node.js runtime
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  console.log('[TestBcryptCompare] Starting...')

  try {
    // Step 1: Get admin from DB
    console.log('[TestBcryptCompare] Getting admin...')
    const admins = await sql`
      SELECT id, email, password_hash
      FROM admin_users
      WHERE LOWER(email) = 'massmindmaker@gmail.com'
    `

    if (admins.length === 0) {
      return NextResponse.json({ error: 'Admin not found' })
    }

    const admin = admins[0]
    console.log('[TestBcryptCompare] Admin found, id:', admin.id)
    console.log('[TestBcryptCompare] Hash prefix:', admin.password_hash.substring(0, 30))
    console.log('[TestBcryptCompare] Hash length:', admin.password_hash.length)

    // Step 2: Compare password
    const testPassword = 'MegaAdmin2025!'
    console.log('[TestBcryptCompare] Comparing password...')

    const startTime = Date.now()
    const isValid = await bcrypt.compare(testPassword, admin.password_hash)
    const duration = Date.now() - startTime

    console.log('[TestBcryptCompare] Result:', isValid, 'Duration:', duration, 'ms')

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        hashPrefix: admin.password_hash.substring(0, 30),
        hashLength: admin.password_hash.length
      },
      bcrypt: {
        password: testPassword,
        isValid,
        durationMs: duration
      }
    })
  } catch (error) {
    console.error('[TestBcryptCompare] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
    })
  }
}
