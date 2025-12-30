/**
 * GET /api/admin/auth/me
 * Get current authenticated admin info
 */

import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { findAdminById } from '@/lib/admin/auth'
import { getPermissions } from '@/lib/admin/permissions'

export async function GET() {
  try {
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get fresh admin data
    const admin = await findAdminById(session.adminId)

    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { error: 'Admin not found or inactive' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        firstName: admin.firstName,
        lastName: admin.lastName,
        avatarUrl: admin.avatarUrl,
        lastLoginAt: admin.lastLoginAt
      },
      permissions: getPermissions(admin.role)
    })
  } catch (error) {
    console.error('[Admin Me] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
