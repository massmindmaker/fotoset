/**
 * GET /api/admin/auth/session
 * Check if admin session is valid
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { findAdminById } from '@/lib/admin/auth'

export async function GET() {
  const envCheck = {
    hasSecret: !!process.env.ADMIN_SESSION_SECRET,
    hasDb: !!process.env.DATABASE_URL,
    runtime: 'edge'
  }

  // If env vars are missing, return immediately
  if (!envCheck.hasSecret || !envCheck.hasDb) {
    return NextResponse.json({
      authenticated: false,
      error: !envCheck.hasSecret
        ? 'ADMIN_SESSION_SECRET not set'
        : 'DATABASE_URL not set',
      envCheck
    }, { status: 500 })
  }

  try {
    // Get session with timeout protection
    const sessionPromise = getCurrentSession()
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Session check timeout after 10s')), 10000)
    )

    const session = await Promise.race([sessionPromise, timeoutPromise])

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        error: 'No session',
        envCheck
      })
    }

    // Verify admin exists
    const admin = await findAdminById(session.adminId)

    if (!admin || !admin.isActive) {
      return NextResponse.json({
        authenticated: false,
        error: 'Admin not found or inactive',
        envCheck
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
    return NextResponse.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Session check failed',
      envCheck
    }, { status: 500 })
  }
}
