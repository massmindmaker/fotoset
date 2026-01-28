export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPartnerSession } from '@/lib/partner/session'

export async function GET(_request: NextRequest) {
  console.log('[Partner Session] Checking session...')

  // Check if required env vars are set (uses PARTNER_SESSION_SECRET or ADMIN_SESSION_SECRET)
  const sessionSecret = process.env.PARTNER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET
  if (!sessionSecret) {
    console.error('[Partner Session] PARTNER_SESSION_SECRET and ADMIN_SESSION_SECRET are not set!')
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: 'Server configuration error: Session secret not set'
    }, { status: 500 })
  }

  if (!process.env.DATABASE_URL) {
    console.error('[Partner Session] DATABASE_URL is not set!')
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: 'Server configuration error: DATABASE_URL not set'
    }, { status: 500 })
  }

  try {
    const session = await getCurrentPartnerSession()
    console.log('[Partner Session] Session result:', session ? 'found' : 'not found')

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
    console.error('[Partner Session] Error:', error)
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Session check failed'
    }, { status: 500 })
  }
}
