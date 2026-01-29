/**
 * Telegram Affiliate Program API
 *
 * Manages the official Telegram Stars Affiliate Program.
 *
 * Endpoints:
 * - GET: Get current settings and status
 * - POST: Update affiliate program settings
 * - DELETE: Disable affiliate program
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import {
  getAffiliateSettings,
  updateAffiliateProgram,
  disableAffiliateProgram,
  checkAffiliateProgramStatus,
  getAffiliateStats,
} from '@/lib/telegram-affiliate'
import { isAuthenticated } from '@/lib/telegram-mtproto'

// Get affiliate program status
export async function GET() {
  try {
    const status = await checkAffiliateProgramStatus()

    // Try to get stats if authenticated and active
    let stats = null
    if (status.authenticated && status.active) {
      const statsResult = await getAffiliateStats()
      if (statsResult.success) {
        stats = statsResult.stats
      }
    }

    return NextResponse.json({
      ...status,
      stats,
    })
  } catch (error) {
    console.error('[Affiliate API] Status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Update affiliate program settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { commissionPermille, durationMonths = 0 } = body

    // Validate
    if (typeof commissionPermille !== 'number') {
      return NextResponse.json(
        { error: 'commissionPermille is required and must be a number' },
        { status: 400 }
      )
    }

    if (commissionPermille < 0 || commissionPermille > 1000) {
      return NextResponse.json(
        { error: 'commissionPermille must be between 0 and 1000' },
        { status: 400 }
      )
    }

    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json(
        { error: 'Not authenticated. Please login via MTProto first.' },
        { status: 401 }
      )
    }

    const result = await updateAffiliateProgram(commissionPermille, durationMonths)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: {
        commissionPermille,
        durationMonths,
        commissionPercent: commissionPermille / 10, // For display
      },
    })
  } catch (error) {
    console.error('[Affiliate API] Update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Disable affiliate program
export async function DELETE() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const result = await disableAffiliateProgram()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Affiliate API] Disable error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
