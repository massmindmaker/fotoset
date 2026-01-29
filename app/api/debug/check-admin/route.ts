/**
 * DEBUG ONLY - Check admin user and password hash
 * Remove after debugging
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  // Only allow in development/preview
  if (process.env.NODE_ENV === 'production' && !request.url.includes('test.pinglass.ru')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const email = url.searchParams.get('email') || ''
    const password = url.searchParams.get('password') || ''

    // Find admin
    const admins = await sql`
      SELECT id, email, password_hash, is_active
      FROM admin_users
      WHERE LOWER(email) = ${email.toLowerCase().trim()}
    `

    if (admins.length === 0) {
      return NextResponse.json({
        found: false,
        message: 'Admin not found',
        searchedEmail: email.toLowerCase().trim()
      })
    }

    const admin = admins[0]

    // Test bcrypt
    const isValid = await bcrypt.compare(password, admin.password_hash)

    return NextResponse.json({
      found: true,
      id: admin.id,
      email: admin.email,
      isActive: admin.is_active,
      hashPrefix: admin.password_hash.substring(0, 20) + '...',
      passwordValid: isValid
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
