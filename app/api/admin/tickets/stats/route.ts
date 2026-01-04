/**
 * GET /api/admin/tickets/stats
 * Get ticket statistics for dashboard
 *
 * Returns:
 * - Total ticket counts by status
 * - SLA breach counts
 * - Average response and resolution times
 * - Breakdown by priority
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { getTicketStats } from '@/lib/support'

export async function GET(request: NextRequest) {
  try {
    // Validate admin session
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            userMessage: 'Необходима авторизация'
          }
        },
        { status: 401 }
      )
    }

    // Get ticket statistics
    const stats = await getTicketStats()

    return NextResponse.json({
      success: true,
      data: {
        stats
      }
    })
  } catch (error) {
    console.error('[Admin API] Error fetching ticket stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          userMessage: 'Ошибка загрузки статистики',
          devMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}
