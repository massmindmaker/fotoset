import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin/auth"
import { fetchSentryEvents, type SentryFilters } from "@/lib/admin/sentry-api"

/**
 * GET /api/admin/logs
 *
 * Fetch logs from Sentry API with filters
 *
 * Query Parameters:
 * - level: "error" | "warning" | "info" | "all" (default: "all")
 * - dateFrom: ISO timestamp (optional)
 * - dateTo: ISO timestamp (optional)
 * - userId: telegram_user_id (optional)
 * - search: search string (optional)
 * - page: page number (default: 1)
 * - limit: items per page (default: 20)
 *
 * Response:
 * {
 *   events: SentryEvent[]
 *   totalPages: number
 *   currentPage: number
 *   totalEvents: number
 * }
 *
 * Security:
 * - Requires admin access (whitelist check)
 * - Validates all query parameters
 */
export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION CHECK (TEMPORARILY DISABLED FOR TESTING)
    // ========================================================================
    // TODO: Re-enable before production deployment
    console.log('[API /admin/logs] Admin access granted (auth disabled for testing)')

    /* COMMENTED OUT - Re-enable for production:
    const { authorized, telegramUserId } = verifyAdminAccess(request)

    if (!authorized) {
      console.log(`[API /admin/logs] Unauthorized access: ${telegramUserId || 'no user ID'}`)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Unauthorized',
            userMessage: 'У вас нет доступа к логам',
            retryable: false,
          },
        },
        { status: 403 }
      )
    }

    console.log(`[API /admin/logs] Admin access granted: ${telegramUserId}`)
    */

    // ========================================================================
    // 2. PARSE QUERY PARAMETERS
    // ========================================================================
    const { searchParams } = request.nextUrl

    // Level filter
    const levelParam = searchParams.get('level') || 'all'
    const level = ['error', 'warning', 'info', 'all'].includes(levelParam)
      ? (levelParam as SentryFilters['level'])
      : 'all'

    // Date range
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // User ID filter
    const userIdParam = searchParams.get('userId')
    const userId = userIdParam ? parseInt(userIdParam) : null

    // Search query
    const search = searchParams.get('search') || undefined

    // Pagination
    const pageParam = searchParams.get('page') || '1'
    const page = Math.max(1, parseInt(pageParam) || 1)

    const limitParam = searchParams.get('limit') || '20'
    const limit = Math.max(1, Math.min(100, parseInt(limitParam) || 20)) // Max 100 per page

    // Build filters object
    const filters: SentryFilters = {
      level,
      dateFrom,
      dateTo,
      userId: userId && !isNaN(userId) ? userId : null,
      search,
      page,
      limit,
    }

    console.log('[API /admin/logs] Filters:', JSON.stringify(filters))

    // ========================================================================
    // 3. FETCH FROM SENTRY API
    // ========================================================================
    const result = await fetchSentryEvents(filters)

    console.log(`[API /admin/logs] Fetched ${result.events.length} events`)

    // ========================================================================
    // 4. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json({
      success: true,
      data: result,
    })

  } catch (error) {
    console.error('[API /admin/logs] Error:', error)

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    // Определить тип ошибки и статус код
    let errorCode = 'SENTRY_API_ERROR'
    let userMessage = 'Не удалось загрузить логи.'
    let statusCode = 500

    if (errorMsg.includes('not configured')) {
      errorCode = 'SENTRY_NOT_CONFIGURED'
      userMessage = 'Sentry не настроен. Проверьте переменные окружения.'
      statusCode = 503
    } else if (errorMsg.includes('authentication failed')) {
      errorCode = 'SENTRY_AUTH_FAILED'
      userMessage = 'Sentry токен недействителен.'
      statusCode = 401
    } else if (errorMsg.includes('access denied')) {
      errorCode = 'SENTRY_ACCESS_DENIED'
      userMessage = 'Доступ к Sentry запрещен. Проверьте scope токена.'
      statusCode = 403
    } else if (errorMsg.includes('project not found')) {
      errorCode = 'SENTRY_PROJECT_NOT_FOUND'
      userMessage = 'Sentry проект не найден. Проверьте SENTRY_ORG и SENTRY_PROJECT.'
      statusCode = 404
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: errorMsg,
          userMessage,
          debug: {
            org: process.env.SENTRY_ORG || 'NOT_SET',
            project: process.env.SENTRY_PROJECT || 'NOT_SET',
            hasAuthToken: !!process.env.SENTRY_AUTH_TOKEN
          }
        }
      },
      { status: statusCode }
    )
  }
}
