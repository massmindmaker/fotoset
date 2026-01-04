/**
 * GET /api/admin/tickets
 * List all support tickets with pagination, filtering, and search
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - status: TicketStatus (optional) - 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed' | 'all'
 * - priority: TicketPriority (optional) - 'P1' | 'P2' | 'P3' | 'P4' | 'all'
 * - search: string (optional) - searches ticket_number, user_name, telegram_username, subject
 * - assignedTo: string (optional) - filter by assigned operator username
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { getTicketsForAdmin } from '@/lib/support'

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

    const { searchParams } = request.nextUrl

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // Parse filters
    const status = searchParams.get('status') || undefined
    const priority = searchParams.get('priority') || undefined
    const search = searchParams.get('search') || undefined
    const assignedTo = searchParams.get('assignedTo') || undefined

    // Get tickets from service
    const result = await getTicketsForAdmin({
      page,
      limit,
      status: status === 'all' ? undefined : status,
      priority: priority === 'all' ? undefined : priority,
      search,
      assignedTo
    })

    return NextResponse.json({
      success: true,
      data: {
        tickets: result.tickets,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      }
    })
  } catch (error) {
    console.error('[Admin API] Error fetching tickets:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          userMessage: 'Ошибка загрузки тикетов',
          devMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}
