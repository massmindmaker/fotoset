/**
 * POST /api/admin/auth/logout
 * Logout endpoint - clears session and redirects to login
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60


import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession, deleteSession, clearSessionCookie } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()

    if (session) {
      // Log logout
      await logAdminAction({
        adminId: session.adminId,
        action: 'logout'
      })

      // Delete session from database
      await deleteSession(session.sessionId)
    }

    // Clear session cookie
    await clearSessionCookie()

    // Redirect to login page
    return NextResponse.redirect(new URL('/admin/login', request.url))
  } catch (error) {
    console.error('[Admin Logout] Error:', error)

    // Still clear cookie even if there's an error
    await clearSessionCookie()

    // Redirect to login page even on error
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
}
