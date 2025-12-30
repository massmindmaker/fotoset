/**
 * POST /api/admin/auth/logout
 * Logout endpoint - clears session
 */

import { NextResponse } from 'next/server'
import { getCurrentSession, deleteSession, clearSessionCookie } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'

export async function POST() {
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Logout] Error:', error)

    // Still clear cookie even if there's an error
    await clearSessionCookie()

    return NextResponse.json({ success: true })
  }
}
