/**
 * Unit tests for GET /api/admin/logs
 * Fetch and filter Sentry logs endpoint
 */

import { NextRequest } from 'next/server'

// Mock dependencies - must be declared before imports
const mockGetCurrentSession = jest.fn()
const mockFetchSentryEvents = jest.fn()

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: mockGetCurrentSession,
}))

jest.mock('@/lib/admin/sentry-api', () => ({
  fetchSentryEvents: mockFetchSentryEvents,
}))

// Import after mocks
import { GET } from '@/app/api/admin/logs/route'

// Helper to create NextRequest with query params
function createRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/logs')
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return new NextRequest(url)
}

describe('GET /api/admin/logs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SENTRY_AUTH_TOKEN = 'test-auth-token'
    process.env.SENTRY_ORG = 'test-org'
    process.env.SENTRY_PROJECT = 'test-project'
  })

  afterEach(() => {
    delete process.env.SENTRY_AUTH_TOKEN
    delete process.env.SENTRY_ORG
    delete process.env.SENTRY_PROJECT
  })

  describe('Authentication', () => {
    it('should return 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValue(null)

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Unauthorized',
          userMessage: 'У вас нет доступа к логам',
          retryable: false,
        },
      })
      expect(mockFetchSentryEvents).not.toHaveBeenCalled()
    })

    it('should proceed with valid session', async () => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })

      mockFetchSentryEvents.mockResolvedValue({
        events: [],
        totalPages: 1,
        currentPage: 1,
        totalEvents: 0,
      })

      const request = createRequest()
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockFetchSentryEvents).toHaveBeenCalled()
    })
  })

  describe('Default Pagination', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })
    })

    it('should use default page=1 and limit=20', async () => {
      mockFetchSentryEvents.mockResolvedValue({
        events: [],
        totalPages: 1,
        currentPage: 1,
        totalEvents: 0,
      })

      const request = createRequest()
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 20,
        })
      )
    })

    it('should return paginated logs with default settings', async () => {
      const mockEvents = [
        {
          id: '1',
          eventID: 'evt1',
          message: 'Test error',
          level: 'error' as const,
          timestamp: '2024-01-01T10:00:00Z',
        },
      ]

      mockFetchSentryEvents.mockResolvedValue({
        events: mockEvents,
        totalPages: 5,
        currentPage: 1,
        totalEvents: 100,
      })

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        data: {
          events: mockEvents,
          totalPages: 5,
          currentPage: 1,
          totalEvents: 100,
        },
      })
    })
  })

  describe('Level Filtering', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })

      mockFetchSentryEvents.mockResolvedValue({
        events: [],
        totalPages: 1,
        currentPage: 1,
        totalEvents: 0,
      })
    })

    it('should filter by level=error', async () => {
      const request = createRequest({ level: 'error' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
        })
      )
    })

    it('should filter by level=warning', async () => {
      const request = createRequest({ level: 'warning' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
        })
      )
    })

    it('should filter by level=info', async () => {
      const request = createRequest({ level: 'info' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
        })
      )
    })

    it('should default to level=all', async () => {
      const request = createRequest({ level: 'all' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'all',
        })
      )
    })

    it('should fallback to all for invalid level', async () => {
      const request = createRequest({ level: 'invalid-level' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'all',
        })
      )
    })
  })

  describe('Date Range Filtering', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })

      mockFetchSentryEvents.mockResolvedValue({
        events: [],
        totalPages: 1,
        currentPage: 1,
        totalEvents: 0,
      })
    })

    it('should filter by dateFrom', async () => {
      const request = createRequest({ dateFrom: '2024-01-01T00:00:00Z' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2024-01-01T00:00:00Z',
        })
      )
    })

    it('should filter by dateTo', async () => {
      const request = createRequest({ dateTo: '2024-01-31T23:59:59Z' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          dateTo: '2024-01-31T23:59:59Z',
        })
      )
    })

    it('should filter by date range (dateFrom and dateTo)', async () => {
      const request = createRequest({
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-01-31T23:59:59Z',
      })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2024-01-01T00:00:00Z',
          dateTo: '2024-01-31T23:59:59Z',
        })
      )
    })

    it('should handle missing date params (null)', async () => {
      const request = createRequest()
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: null,
          dateTo: null,
        })
      )
    })
  })

  describe('User ID Filtering', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })

      mockFetchSentryEvents.mockResolvedValue({
        events: [],
        totalPages: 1,
        currentPage: 1,
        totalEvents: 0,
      })
    })

    it('should filter by userId (telegram_user_id)', async () => {
      const request = createRequest({ userId: '123456' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 123456,
        })
      )
    })

    it('should handle invalid userId (non-numeric)', async () => {
      const request = createRequest({ userId: 'invalid' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
        })
      )
    })

    it('should handle missing userId (null)', async () => {
      const request = createRequest()
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
        })
      )
    })

    it('should parse userId as integer', async () => {
      const request = createRequest({ userId: '789012' })
      await GET(request)

      const callArg = mockFetchSentryEvents.mock.calls[0][0]
      expect(typeof callArg.userId).toBe('number')
      expect(callArg.userId).toBe(789012)
    })
  })

  describe('Search Filtering', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })

      mockFetchSentryEvents.mockResolvedValue({
        events: [],
        totalPages: 1,
        currentPage: 1,
        totalEvents: 0,
      })
    })

    it('should filter by search keyword', async () => {
      const request = createRequest({ search: 'payment error' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'payment error',
        })
      )
    })

    it('should handle missing search param (undefined)', async () => {
      const request = createRequest()
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          search: undefined,
        })
      )
    })

    it('should handle empty search string', async () => {
      const request = createRequest({ search: '' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          search: undefined,
        })
      )
    })
  })

  describe('Pagination', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })

      mockFetchSentryEvents.mockResolvedValue({
        events: [],
        totalPages: 1,
        currentPage: 1,
        totalEvents: 0,
      })
    })

    it('should paginate with page=2', async () => {
      const request = createRequest({ page: '2' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      )
    })

    it('should paginate with limit=50', async () => {
      const request = createRequest({ limit: '50' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        })
      )
    })

    it('should enforce minimum page=1', async () => {
      const request = createRequest({ page: '0' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      )
    })

    it('should enforce minimum page=1 for negative values', async () => {
      const request = createRequest({ page: '-5' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      )
    })

    it('should enforce maximum limit=100', async () => {
      const request = createRequest({ limit: '200' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        })
      )
    })

    it('should enforce minimum limit=1 (defaults to 20 for 0)', async () => {
      // When limit='0', parseInt('0') = 0 (falsy), so it defaults to 20
      const request = createRequest({ limit: '0' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20, // Falls back to default
        })
      )
    })

    it('should handle invalid page (non-numeric)', async () => {
      const request = createRequest({ page: 'invalid' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1, // Defaults to 1
        })
      )
    })

    it('should handle invalid limit (non-numeric)', async () => {
      const request = createRequest({ limit: 'invalid' })
      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20, // Defaults to 20
        })
      )
    })
  })

  describe('Event Data Structure', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })
    })

    it('should return logs with user info', async () => {
      const mockEvents = [
        {
          id: '1',
          eventID: 'evt1',
          message: 'Payment failed',
          level: 'error' as const,
          timestamp: '2024-01-01T10:00:00Z',
          user: {
            id: 'user123',
            telegram_id: 123456,
            username: 'testuser',
            ip_address: '192.168.1.1',
          },
        },
      ]

      mockFetchSentryEvents.mockResolvedValue({
        events: mockEvents,
        totalPages: 1,
        currentPage: 1,
        totalEvents: 1,
      })

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.events[0]).toEqual(mockEvents[0])
      expect(data.data.events[0].user).toBeDefined()
      expect(data.data.events[0].user.telegram_id).toBe(123456)
      expect(data.data.events[0].user.ip_address).toBe('192.168.1.1')
    })

    it('should return logs with event metadata (tags, context)', async () => {
      const mockEvents = [
        {
          id: '1',
          eventID: 'evt1',
          message: 'API error',
          level: 'error' as const,
          timestamp: '2024-01-01T10:00:00Z',
          tags: {
            environment: 'production',
            server: 'web-1',
          },
          context: {
            request: {
              url: '/api/payment',
              method: 'POST',
            },
          },
        },
      ]

      mockFetchSentryEvents.mockResolvedValue({
        events: mockEvents,
        totalPages: 1,
        currentPage: 1,
        totalEvents: 1,
      })

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.events[0].tags).toEqual({
        environment: 'production',
        server: 'web-1',
      })
      expect(data.data.events[0].context).toEqual({
        request: {
          url: '/api/payment',
          method: 'POST',
        },
      })
    })

    it('should handle events without user info', async () => {
      const mockEvents = [
        {
          id: '1',
          eventID: 'evt1',
          message: 'System error',
          level: 'error' as const,
          timestamp: '2024-01-01T10:00:00Z',
        },
      ]

      mockFetchSentryEvents.mockResolvedValue({
        events: mockEvents,
        totalPages: 1,
        currentPage: 1,
        totalEvents: 1,
      })

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.events[0].user).toBeUndefined()
    })
  })

  describe('Empty Results', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })
    })

    it('should return empty array when no logs found', async () => {
      mockFetchSentryEvents.mockResolvedValue({
        events: [],
        totalPages: 1,
        currentPage: 1,
        totalEvents: 0,
      })

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        data: {
          events: [],
          totalPages: 1,
          currentPage: 1,
          totalEvents: 0,
        },
      })
    })
  })

  describe('Error Handling - Sentry API Errors', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })
    })

    it('should handle Sentry not configured error (503)', async () => {
      mockFetchSentryEvents.mockRejectedValue(
        new Error('Sentry not configured. Required:\n  SENTRY_AUTH_TOKEN: MISSING')
      )

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data).toEqual({
        success: false,
        error: {
          code: 'SENTRY_NOT_CONFIGURED',
          message: 'Sentry not configured. Required:\n  SENTRY_AUTH_TOKEN: MISSING',
          userMessage: 'Sentry не настроен. Проверьте переменные окружения.',
          debug: {
            org: 'test-org',
            project: 'test-project',
            hasAuthToken: true,
          },
        },
      })
    })

    it('should handle Sentry authentication failed error (401)', async () => {
      mockFetchSentryEvents.mockRejectedValue(
        new Error('Sentry authentication failed. Check SENTRY_AUTH_TOKEN.')
      )

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('SENTRY_AUTH_FAILED')
      expect(data.error.userMessage).toBe('Sentry токен недействителен.')
    })

    it('should handle Sentry access denied error (403)', async () => {
      mockFetchSentryEvents.mockRejectedValue(
        new Error('Sentry access denied. Token needs "event:read" scope.')
      )

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('SENTRY_ACCESS_DENIED')
      expect(data.error.userMessage).toBe('Доступ к Sentry запрещен. Проверьте scope токена.')
    })

    it('should handle Sentry project not found error (404)', async () => {
      mockFetchSentryEvents.mockRejectedValue(
        new Error('Sentry project not found. Check SENTRY_ORG and SENTRY_PROJECT.')
      )

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('SENTRY_PROJECT_NOT_FOUND')
      expect(data.error.userMessage).toBe('Sentry проект не найден. Проверьте SENTRY_ORG и SENTRY_PROJECT.')
    })

    it('should handle generic Sentry API error (500)', async () => {
      mockFetchSentryEvents.mockRejectedValue(new Error('Network timeout'))

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('SENTRY_API_ERROR')
      expect(data.error.message).toBe('Network timeout')
      expect(data.error.userMessage).toBe('Не удалось загрузить логи.')
    })

    it('should include debug info in error response', async () => {
      mockFetchSentryEvents.mockRejectedValue(new Error('Test error'))

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(data.error.debug).toEqual({
        org: 'test-org',
        project: 'test-project',
        hasAuthToken: true,
      })
    })

    it('should handle missing environment variables in debug info', async () => {
      delete process.env.SENTRY_AUTH_TOKEN
      delete process.env.SENTRY_ORG
      delete process.env.SENTRY_PROJECT

      mockFetchSentryEvents.mockRejectedValue(new Error('Config error'))

      const request = createRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(data.error.debug).toEqual({
        org: 'NOT_SET',
        project: 'NOT_SET',
        hasAuthToken: false,
      })
    })
  })

  describe('Combined Filters', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1,
      })

      mockFetchSentryEvents.mockResolvedValue({
        events: [],
        totalPages: 1,
        currentPage: 1,
        totalEvents: 0,
      })
    })

    it('should apply all filters together', async () => {
      const request = createRequest({
        level: 'error',
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-01-31T23:59:59Z',
        userId: '123456',
        search: 'payment',
        page: '2',
        limit: '50',
      })

      await GET(request)

      expect(mockFetchSentryEvents).toHaveBeenCalledWith({
        level: 'error',
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-01-31T23:59:59Z',
        userId: 123456,
        search: 'payment',
        page: 2,
        limit: 50,
      })
    })
  })
})
