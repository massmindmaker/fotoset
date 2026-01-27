import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPartnerSession } from '@/lib/partner/session'

export async function GET(_request: NextRequest) {
  try {
    const session = await getCurrentPartnerSession()

    if (!session) {
      return NextResponse.json({
        success: true,
        authenticated: false
      })
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      partner: {
        id: session.partnerId,
        userId: session.userId,
        email: session.email,
        firstName: session.firstName,
        lastName: session.lastName,
        commissionRate: session.commissionRate
      }
    })
  } catch (error) {
    console.error('[Partner Auth] Session check error:', error)
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: 'Session check failed'
    })
  }
}
