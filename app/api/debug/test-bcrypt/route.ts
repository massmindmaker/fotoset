/**
 * Debug endpoint to test bcrypt on Vercel
 * DELETE AFTER DEBUGGING
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    // Step 1: Check runtime
    const runtimeInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    }

    // Step 2: Get admin password hash
    const admins = await sql`
      SELECT id, email, password_hash
      FROM admin_users
      WHERE email = 'massmindmaker@gmail.com'
    `

    if (admins.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Admin not found',
        runtime: runtimeInfo
      })
    }

    const admin = admins[0]
    const testPassword = 'MegaAdmin2025!'

    // Step 3: Test bcrypt compare
    console.log('[TestBcrypt] Testing password comparison...')
    console.log('[TestBcrypt] Hash (first 30):', admin.password_hash.substring(0, 30))

    const startTime = Date.now()
    const isValid = await bcrypt.compare(testPassword, admin.password_hash)
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      runtime: runtimeInfo,
      admin: {
        id: admin.id,
        email: admin.email,
        hashPrefix: admin.password_hash.substring(0, 30),
        hashLength: admin.password_hash.length
      },
      bcrypt: {
        testPassword,
        isValid,
        durationMs: duration
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
    })
  }
}
