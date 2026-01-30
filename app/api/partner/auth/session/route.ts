export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPartnerSession } from '@/lib/partner/session'

export async function GET(_request: NextRequest) {
  const envCheck = {
    hasSecret: !!(process.env.PARTNER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET),
    hasDb: !!process.env.DATABASE_URL,
    runtime: 'edge'
  }

  if (!envCheck.hasSecret || !envCheck.hasDb) {
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: !envCheck.hasSecret ? 'Session secret not set' : 'DATABASE_URL not set',
      envCheck
    }, { status: 500 })
  }

  try {
    // Get session with timeout protection
    const sessionPromise = getCurrentPartnerSession()
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Session check timeout after 10s')), 10000)
    )

    const session = await Promise.race([sessionPromise, timeoutPromise])

    if (!session) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        envCheck
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
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Session check failed',
      envCheck
    }, { status: 500 })
  }
}
