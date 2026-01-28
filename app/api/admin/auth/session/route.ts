/**
 * GET /api/admin/auth/session
 * Check if admin session is valid
 */

import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { findAdminById } from '@/lib/admin/auth'

export async function GET() {
  console.log('[Admin Session] Checking session...')

  // Check if required env vars are set
  if (!process.env.ADMIN_SESSION_SECRET) {
    console.error('[Admin Session] ADMIN_SESSION_SECRET is not set!')
    return NextResponse.json({
      authenticated: false,
      error: 'Server configuration error: ADMIN_SESSION_SECRET not set'
    }, { status: 500 })
  }

  if (!process.env.DATABASE_URL) {
    console.error('[Admin Session] DATABASE_URL is not set!')
    return NextResponse.json({
      authenticated: false,
      error: 'Server configuration error: DATABASE_URL not set'
    }, { status: 500 })
  }

  try {
    const session = await getCurrentSession()
    console.log('[Admin Session] Session result:', session ? 'found' : 'not found')

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        error: 'No session'
      })
    }

    // Verify admin still exists and is active
    const admin = await findAdminById(session.adminId)
    console.log('[Admin Session] Admin lookup:', admin ? 'found' : 'not found')

    if (!admin || !admin.isActive) {
      return NextResponse.json({
        authenticated: false,
        error: 'Admin not found or inactive'
      })
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        firstName: admin.firstName,
        lastName: admin.lastName
      }
    })
  } catch (error) {
    console.error('[Admin Session] Error:', error)
    return NextResponse.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Session check failed'
    }, { status: 500 })
  }
}
