/**
 * Sentry API Client
 *
 * Provides functions to fetch events (errors, warnings, info) from Sentry REST API.
 * Used by admin panel to display logs and monitor user activity.
 *
 * API Documentation: https://docs.sentry.io/api/events/
 */

// ============================================================================
// Types
// ============================================================================

export interface SentryEvent {
  id: string
  eventID: string
  message: string
  level: 'error' | 'warning' | 'info' | 'debug'
  timestamp: string // ISO 8601
  user?: {
    id?: string
    telegram_id?: number
    username?: string
    ip_address?: string
  }
  tags?: Record<string, string>
  context?: Record<string, unknown>
  platform?: string
  culprit?: string // function/file where error occurred
}

export interface SentryFilters {
  level: 'error' | 'warning' | 'info' | 'all'
  dateFrom?: string | null
  dateTo?: string | null
  userId?: number | null // telegram_user_id
  search?: string
  page: number
  limit: number
}

export interface SentryResponse {
  events: SentryEvent[]
  totalPages: number
  currentPage: number
  totalEvents: number
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get Sentry configuration from environment
 * Requires: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
 */
function getSentryConfig() {
  // Try with fotoset_ prefix first (Vercel env vars), then fallback to unprefixed
  const authToken = process.env.fotoset_SENTRY_AUTH_TOKEN || process.env.SENTRY_AUTH_TOKEN
  const org = process.env.fotoset_SENTRY_ORG || process.env.SENTRY_ORG
  const project = process.env.fotoset_SENTRY_PROJECT || process.env.SENTRY_PROJECT

  // Валидация длины токена
  if (authToken && authToken.length < 20) {
    throw new Error('SENTRY_AUTH_TOKEN appears invalid (too short)')
  }

  // Улучшенное сообщение об ошибке
  if (!authToken || !org || !project) {
    throw new Error(
      'Sentry not configured. Required:\n' +
      `  SENTRY_AUTH_TOKEN: ${authToken ? 'SET' : 'MISSING'}\n` +
      `  SENTRY_ORG: ${org ? 'SET' : 'MISSING'}\n` +
      `  SENTRY_PROJECT: ${project ? 'SET' : 'MISSING'}\n` +
      'Get token: https://sentry.io/settings/auth-tokens/'
    )
  }

  return {
    authToken,
    org,
    project,
    baseUrl: `https://sentry.io/api/0/projects/${org}/${project}/events/`,
  }
}

// ============================================================================
// Query Builder
// ============================================================================

/**
 * Build Sentry API query string from filters
 *
 * @example
 * buildSentryQuery({ level: 'error', page: 1, limit: 20 })
 * // Returns: "?query=level:error&per_page=20&cursor=..."
 */
export function buildSentryQuery(filters: SentryFilters): string {
  const params = new URLSearchParams()

  // Level filter
  if (filters.level !== 'all') {
    params.append('query', `level:${filters.level}`)
  }

  // User ID filter (search by tag - исправлено для Sentry tags)
  if (filters.userId) {
    const existingQuery = params.get('query') || ''
    const userQuery = `tags[telegram_user_id]:${filters.userId}`
    params.set('query', existingQuery ? `${existingQuery} ${userQuery}` : userQuery)
  }

  // Search query (message text)
  if (filters.search) {
    const existingQuery = params.get('query') || ''
    const searchQuery = `message:"${filters.search}"`
    params.set('query', existingQuery ? `${existingQuery} ${searchQuery}` : searchQuery)
  }

  // Date range (ISO 8601 format)
  if (filters.dateFrom) {
    params.append('start', filters.dateFrom)
  }
  if (filters.dateTo) {
    params.append('end', filters.dateTo)
  }

  // Добавить статистику по умолчанию (последние 14 дней)
  if (!filters.dateFrom && !filters.dateTo) {
    params.append('statsPeriod', '14d')
  }

  // Pagination
  params.append('per_page', filters.limit.toString())

  // Sentry uses cursor-based pagination
  // For page 1, no cursor needed
  // For page 2+, we'd need to store the cursor from previous response

  return params.toString()
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Fetch events from Sentry API
 *
 * @param filters - Filter criteria (level, date, user, search)
 * @returns Paginated list of Sentry events
 *
 * @example
 * const result = await fetchSentryEvents({
 *   level: 'error',
 *   page: 1,
 *   limit: 20
 * })
 */
export async function fetchSentryEvents(
  filters: SentryFilters
): Promise<SentryResponse> {
  try {
    const config = getSentryConfig()
    const queryString = buildSentryQuery(filters)
    const url = `${config.baseUrl}?${queryString}`

    console.log('[Sentry API] Fetching events:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      // Специфичные сообщения для разных HTTP статусов
      if (response.status === 401) {
        throw new Error('Sentry authentication failed. Check SENTRY_AUTH_TOKEN.')
      }
      if (response.status === 403) {
        throw new Error('Sentry access denied. Token needs "event:read" scope.')
      }
      if (response.status === 404) {
        throw new Error('Sentry project not found. Check SENTRY_ORG and SENTRY_PROJECT.')
      }

      const errorText = await response.text()
      console.error('[Sentry API] Error:', response.status, errorText)
      throw new Error(`Sentry API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`[Sentry API] Fetched ${data.length} events`)

    // Parse Link header for pagination info
    const linkHeader = response.headers.get('Link')
    let hasNextPage = false
    if (linkHeader) {
      // Sentry uses Link header with rel="next" for pagination
      hasNextPage = linkHeader.includes('rel="next"')
    }

    // Parse events
    const events = parseSentryEvents(data)

    // Calculate pagination
    // Sentry doesn't provide exact total count, estimate based on whether there's a next page
    // If we got a full page and there's a next page, assume at least 10 pages
    const hasFullPage = events.length >= filters.limit
    const estimatedTotalPages = hasNextPage || hasFullPage
      ? Math.max(filters.page + 1, 10)  // At least current page + 1, estimate 10 total
      : filters.page  // This is the last page
    const estimatedTotalEvents = estimatedTotalPages * filters.limit

    return {
      events,
      totalPages: estimatedTotalPages,
      currentPage: filters.page,
      totalEvents: estimatedTotalEvents,
    }
  } catch (error) {
    console.error('[Sentry API] Fatal error:', error)
    // НЕ ПОГЛОЩАТЬ ОШИБКУ - пробросить наверх
    throw error
  }
}

/**
 * Parse Sentry API response to typed events
 */
export function parseSentryEvents(data: any[]): SentryEvent[] {
  if (!Array.isArray(data)) {
    console.warn('[Sentry API] Invalid response format, expected array')
    return []
  }

  return data.map((event) => ({
    id: event.id || event.eventID,
    eventID: event.eventID || event.id,
    message: event.title || event.message || 'No message',
    level: (event.level || 'error') as SentryEvent['level'],
    timestamp: event.dateCreated || event.timestamp || new Date().toISOString(),
    user: event.user
      ? {
          id: event.user.id,
          telegram_id: event.user.telegram_id || event.tags?.telegram_user_id,
          username: event.user.username || event.user.name,
          ip_address: event.user.ip_address,
        }
      : undefined,
    tags: event.tags || {},
    context: event.context || {},
    platform: event.platform,
    culprit: event.culprit,
  }))
}

/**
 * Fetch single event details from Sentry
 *
 * @param eventId - Sentry event ID
 * @returns Full event details including stack trace
 */
export async function fetchSentryEventDetails(eventId: string): Promise<any> {
  try {
    const config = getSentryConfig()
    const url = `https://sentry.io/api/0/projects/${config.org}/${config.project}/events/${eventId}/`

    console.log('[Sentry API] Fetching event details:', eventId)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Sentry API] Error:', response.status, errorText)
      throw new Error(`Sentry API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('[Sentry API] Fetched event details')

    return data
  } catch (error) {
    console.error('[Sentry API] Failed to fetch event details:', error)
    throw error
  }
}

/**
 * Test Sentry API connection
 * Used to verify auth token and configuration
 */
export async function testSentryConnection(): Promise<{
  success: boolean
  message: string
}> {
  try {
    const config = getSentryConfig()

    const response = await fetch(
      `https://sentry.io/api/0/projects/${config.org}/${config.project}/`,
      {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
        },
      }
    )

    if (response.ok) {
      const data = await response.json()
      return {
        success: true,
        message: `Connected to Sentry project: ${data.name || config.project}`,
      }
    }

    const errorText = await response.text()
    return {
      success: false,
      message: `Sentry API returned ${response.status}: ${errorText.substring(0, 200)}`,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: msg,
    }
  }
}
