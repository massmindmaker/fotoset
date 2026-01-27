/**
 * GET /api/admin/auth/session
 * Check if admin session is valid
 */

import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { findAdminById } from '@/lib/admin/auth'

export async function GET() {
  try {
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        error: 'No session'
      })
    }

    // Verify admin still exists and is active
    const admin = await findAdminById(session.adminId)

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
      error: 'Session check failed'
    })
  }
}
