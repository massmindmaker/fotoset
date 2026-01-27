import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPartnerSession, deletePartnerSession, clearPartnerSessionCookie } from '@/lib/partner/session'

export async function POST(_request: NextRequest) {
  try {
    const session = await getCurrentPartnerSession()

    if (session) {
      // Delete session from database
      await deletePartnerSession(session.sessionId)
    }

    // Clear cookie
    await clearPartnerSessionCookie()

    const response = NextResponse.json({ success: true })

    // Ensure cookie is cleared in response
    response.cookies.delete('partner_session')

    return response
  } catch (error) {
    console.error('[Partner Auth] Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка при выходе' },
      { status: 500 }
    )
  }
}
