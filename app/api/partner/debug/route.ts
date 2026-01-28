/**
 * Debug endpoint for partner session and database
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getCurrentPartnerSession } from '@/lib/partner/session'

export async function GET(request: NextRequest) {
  const debug: any = {
    timestamp: new Date().toISOString(),
    steps: []
  }

  try {
    // Step 1: Session check
    debug.steps.push({ step: 'session_start', time: Date.now() })
    const session = await Promise.race([
      getCurrentPartnerSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    ])
    debug.steps.push({ step: 'session_done', time: Date.now(), hasSession: !!session })

    if (!session) {
      return NextResponse.json({
        ...debug,
        error: 'No session',
        userId: null
      })
    }

    debug.userId = session.userId

    // Step 2: Simple DB query
    debug.steps.push({ step: 'db_start', time: Date.now() })
    const userResult = await Promise.race([
      sql`SELECT id, telegram_user_id FROM users WHERE id = ${session.userId}`.then((r: any) => r[0]),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    ])
    debug.steps.push({ step: 'db_done', time: Date.now(), hasUser: !!userResult })

    if (!userResult) {
      return NextResponse.json({
        ...debug,
        error: 'DB query timeout or user not found'
      })
    }

    debug.user = { id: userResult.id, telegram_user_id: userResult.telegram_user_id }

    // Step 3: Check referral balance
    debug.steps.push({ step: 'balance_start', time: Date.now() })
    const balanceResult = await Promise.race([
      sql`SELECT id, balance_rub FROM referral_balances WHERE user_id = ${session.userId}`.then((r: any) => r[0]),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    ])
    debug.steps.push({ step: 'balance_done', time: Date.now(), hasBalance: !!balanceResult })

    debug.balance = balanceResult || null

    return NextResponse.json({
      success: true,
      ...debug
    })

  } catch (error) {
    return NextResponse.json({
      ...debug,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
