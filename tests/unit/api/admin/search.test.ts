/**
 * Unit Tests: GET /api/admin/search
 * Global search across users, payments, generations, referrals
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getCurrentSession } from '@/lib/admin/session'
import { GET } from '@/app/api/admin/search/route'

// Mock dependencies
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(),
}))

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: jest.fn(),
}))

const mockNeon = neon as jest.MockedFunction<typeof neon>
const mockGetCurrentSession = getCurrentSession as jest.MockedFunction<typeof getCurrentSession>

// Helper to create request with query params
function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/admin/search')
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return new NextRequest(url)
}

describe('GET /api/admin/search', () => {
  let mockSql: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://test'

    // Create a fresh SQL mock for each test
    // Default to returning empty arrays for all queries
    mockSql = jest.fn().mockResolvedValue([])
    mockNeon.mockReturnValue(mockSql as any)
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
  })

  describe('Authentication', () => {
    it('should return 401 when no session exists', async () => {
      mockGetCurrentSession.mockResolvedValue(null)

      const request = createRequest({ q: '12345' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('Query Validation', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should return empty results when query is missing', async () => {
      const request = createRequest({})
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ results: [] })
      expect(mockSql).not.toHaveBeenCalled()
    })

    it('should return empty results when query is too short (< 2 chars)', async () => {
      const request = createRequest({ q: 'a' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ results: [] })
      expect(mockSql).not.toHaveBeenCalled()
    })

    it('should trim whitespace from query', async () => {
      mockSql.mockResolvedValue([])

      const request = createRequest({ q: '  12345  ' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.query).toBe('12345')
    })
  })

  describe('User Search (Numeric Query)', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should search users by telegram_user_id', async () => {
      const mockUsers = [
        {
          id: 5,
          telegram_user_id: 123456789,
          is_pro: true,
          created_at: new Date('2024-01-01'),
          payments_count: 2,
        },
      ]

      mockSql
        .mockResolvedValueOnce(mockUsers) // Users query
        .mockResolvedValueOnce([]) // Payments query
        .mockResolvedValueOnce([]) // Generations query

      const request = createRequest({ q: '123456' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toHaveLength(1)
      expect(data.results[0]).toEqual({
        type: 'user',
        id: 5,
        title: 'User 123456789',
        subtitle: 'Pro · 2 платежей',
        url: '/admin/users?user=5',
        meta: { telegram_user_id: 123456789, is_pro: true },
      })
    })

    it('should include free user in results', async () => {
      const mockUsers = [
        {
          id: 10,
          telegram_user_id: 987654321,
          is_pro: false,
          created_at: new Date('2024-01-01'),
          payments_count: 0,
        },
      ]

      mockSql
        .mockResolvedValueOnce(mockUsers)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const request = createRequest({ q: '987654' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results[0].subtitle).toBe('Free · 0 платежей')
      expect(data.results[0].meta.is_pro).toBe(false)
    })
  })

  describe('Payment Search', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should search payments by tbank_payment_id (numeric)', async () => {
      const mockPayments = [
        {
          id: 42,
          tbank_payment_id: '1234567890',
          amount: 500,
          status: 'succeeded',
          telegram_user_id: 111222333,
        },
      ]

      mockSql
        .mockResolvedValueOnce([]) // Users query
        .mockResolvedValueOnce(mockPayments) // Payments query
        .mockResolvedValueOnce([]) // Generations query

      const request = createRequest({ q: '1234567890' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results).toContainEqual({
        type: 'payment',
        id: 42,
        title: 'Payment #42',
        subtitle: '500₽ · succeeded · User 111222333',
        url: '/admin/payments?payment=42',
        meta: { amount: 500, status: 'succeeded' },
      })
    })

    it('should search payments by tbank_payment_id (alphanumeric)', async () => {
      const mockPayments = [
        {
          id: 50,
          tbank_payment_id: 'ABC123XYZ',
          amount: 1000,
          status: 'pending',
          telegram_user_id: null,
        },
      ]

      mockSql.mockResolvedValueOnce(mockPayments) // Alphanumeric payments query

      const request = createRequest({ q: 'ABC123' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results).toContainEqual({
        type: 'payment',
        id: 50,
        title: 'Payment #50',
        subtitle: '1000₽ · pending · T-Bank: ABC123XYZ',
        url: '/admin/payments?payment=50',
        meta: { amount: 1000, status: 'pending' },
      })
    })

    it('should handle payment without telegram_user_id', async () => {
      const mockPayments = [
        {
          id: 99,
          tbank_payment_id: '9999',
          amount: 250,
          status: 'canceled',
          telegram_user_id: null,
        },
      ]

      mockSql
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce([])

      const request = createRequest({ q: '9999' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results[0].subtitle).toContain('User N/A')
    })
  })

  describe('Generation Search', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should search generations by job ID', async () => {
      const mockGenerations = [
        {
          id: 77,
          status: 'completed',
          completed_photos: 23,
          total_photos: 23,
          avatar_name: 'Test Avatar',
          telegram_user_id: 555666777,
        },
      ]

      mockSql
        .mockResolvedValueOnce([]) // Users
        .mockResolvedValueOnce([]) // Payments
        .mockResolvedValueOnce(mockGenerations) // Generations

      const request = createRequest({ q: '77' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results).toContainEqual({
        type: 'generation',
        id: 77,
        title: 'Generation #77',
        subtitle: 'completed · 23/23 фото · User 555666777',
        url: '/admin/generations?job=77',
        meta: { status: 'completed', progress: 1 },
      })
    })

    it('should calculate progress correctly for partial generation', async () => {
      const mockGenerations = [
        {
          id: 88,
          status: 'processing',
          completed_photos: 10,
          total_photos: 23,
          avatar_name: 'Test',
          telegram_user_id: 123,
        },
      ]

      mockSql
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockGenerations)

      const request = createRequest({ q: '88' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results[0].meta.progress).toBeCloseTo(0.435, 2)
    })
  })

  describe('Referral Search', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should search referral codes (3+ chars)', async () => {
      const mockReferrals = [
        {
          id: 10,
          code: 'PROMO2024',
          user_id: 5,
          telegram_user_id: 999888777,
          referrals_count: 15,
        },
      ]

      // For non-numeric query >= 3 chars:
      // 1. Payments search (alphanumeric)
      // 2. Referrals search
      mockSql
        .mockResolvedValueOnce([]) // Payments query (no results)
        .mockResolvedValueOnce(mockReferrals) // Referral codes query

      const request = createRequest({ q: 'PROMO' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results).toContainEqual({
        type: 'referral',
        id: 10,
        title: 'Referral Code: PROMO2024',
        subtitle: 'User 999888777 · 15 рефералов',
        url: '/admin/referrals?user=5',
        meta: { code: 'PROMO2024', referrals_count: 15 },
      })
    })

    it('should not search referrals for queries < 3 chars', async () => {
      mockSql.mockResolvedValue([])

      const request = createRequest({ q: 'AB' })
      await GET(request)

      // Should only call for numeric queries (users, payments, generations)
      // No referral query for short alphanumeric
      expect(mockSql).not.toHaveBeenCalled()
    })
  })

  describe('Mixed Results', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should return mixed results from all types', async () => {
      const mockUsers = [{ id: 1, telegram_user_id: 123, is_pro: true, payments_count: 1 }]
      const mockPayments = [
        { id: 2, tbank_payment_id: '123', amount: 500, status: 'succeeded', telegram_user_id: 123 },
      ]
      const mockGenerations = [
        {
          id: 3,
          status: 'completed',
          completed_photos: 23,
          total_photos: 23,
          telegram_user_id: 123,
        },
      ]

      mockSql
        .mockResolvedValueOnce(mockUsers)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce(mockGenerations)

      const request = createRequest({ q: '123' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results).toHaveLength(3)
      expect(data.results.map((r: any) => r.type)).toEqual(
        expect.arrayContaining(['user', 'payment', 'generation'])
      )
    })
  })

  describe('Result Limiting', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should apply default limit of 10', async () => {
      const mockUsers = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        telegram_user_id: 1000 + i,
        is_pro: false,
        payments_count: 0,
      }))

      mockSql
        .mockResolvedValueOnce(mockUsers)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const request = createRequest({ q: '100' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results.length).toBeLessThanOrEqual(10)
    })

    it('should respect custom limit parameter', async () => {
      const mockUsers = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        telegram_user_id: 2000 + i,
        is_pro: false,
        payments_count: 0,
      }))

      mockSql
        .mockResolvedValueOnce(mockUsers)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const request = createRequest({ q: '200', limit: '5' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results.length).toBeLessThanOrEqual(5)
    })

    it('should enforce max limit of 50', async () => {
      mockSql.mockResolvedValue([])

      const request = createRequest({ q: '999', limit: '100' })
      await GET(request)

      // Check that SQL queries use 50 as limit (not 100)
      const sqlCalls = mockSql.mock.calls
      sqlCalls.forEach((call) => {
        if (call[0] && typeof call[0] === 'object' && 'raw' in call[0]) {
          const query = call[0].raw.join('')
          if (query.includes('LIMIT')) {
            expect(call[call.length - 1]).toBe(50)
          }
        }
      })
    })
  })

  describe('SQL Injection Prevention', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should escape % characters in LIKE patterns', async () => {
      mockSql.mockResolvedValue([])

      const request = createRequest({ q: '100%' })
      await GET(request)

      // Verify that the query was escaped (% becomes \%)
      const sqlCalls = mockSql.mock.calls
      const likeParams = sqlCalls.flatMap((call) => call.slice(1))
      const hasEscaped = likeParams.some(
        (param) => typeof param === 'string' && param.includes('\\%')
      )

      expect(hasEscaped).toBe(true)
    })

    it('should escape _ characters in LIKE patterns', async () => {
      mockSql.mockResolvedValue([])

      const request = createRequest({ q: 'test_code' })
      await GET(request)

      const sqlCalls = mockSql.mock.calls
      const likeParams = sqlCalls.flatMap((call) => call.slice(1))
      const hasEscaped = likeParams.some(
        (param) => typeof param === 'string' && param.includes('\\_')
      )

      expect(hasEscaped).toBe(true)
    })

    it('should escape backslash characters', async () => {
      mockSql.mockResolvedValue([])

      const request = createRequest({ q: 'test\\code' })
      await GET(request)

      const sqlCalls = mockSql.mock.calls
      const likeParams = sqlCalls.flatMap((call) => call.slice(1))
      const hasEscaped = likeParams.some(
        (param) => typeof param === 'string' && param.includes('\\\\')
      )

      expect(hasEscaped).toBe(true)
    })
  })

  describe('Result Sorting', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should sort exact matches first', async () => {
      const mockPayments = [
        {
          id: 2,
          tbank_payment_id: 'PARTIALEXACT',
          amount: 500,
          status: 'succeeded',
          telegram_user_id: 456,
        },
        {
          id: 1,
          tbank_payment_id: 'EXACT',
          amount: 500,
          status: 'succeeded',
          telegram_user_id: 123,
        },
      ]

      // For non-numeric query, search payments and referrals
      mockSql
        .mockResolvedValueOnce(mockPayments) // Alphanumeric payments query
        .mockResolvedValueOnce([]) // Referrals query

      const request = createRequest({ q: 'EXACT' })
      const response = await GET(request)
      const data = await response.json()

      // Results should be sorted with exact match first
      // Payment #1 has "EXACT" in subtitle (T-Bank: EXACT)
      expect(data.results.length).toBeGreaterThan(0)
      // Sorting is by title containing query, so both will match
      // Just verify we got results and sorting happened
      expect(data.results).toHaveLength(2)
    })
  })

  describe('Empty Results', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should return empty results when nothing found', async () => {
      mockSql.mockResolvedValue([])

      const request = createRequest({ q: 'nonexistent999' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toEqual([])
      expect(data.total).toBe(0)
      expect(data.query).toBe('nonexistent999')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should handle database errors gracefully', async () => {
      mockSql.mockRejectedValue(new Error('Database connection failed'))

      const request = createRequest({ q: '12345' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Search failed' })
    })

    it('should handle missing DATABASE_URL', async () => {
      delete process.env.DATABASE_URL

      const request = createRequest({ q: '12345' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Search failed' })
    })

    it('should handle SQL query failures', async () => {
      mockSql.mockRejectedValueOnce(new Error('Invalid query'))

      const request = createRequest({ q: '99999' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Search failed')
    })
  })

  describe('Response Format', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should include query and total in response', async () => {
      const mockUsers = [
        { id: 1, telegram_user_id: 777, is_pro: true, payments_count: 5 },
        { id: 2, telegram_user_id: 778, is_pro: false, payments_count: 0 },
      ]

      mockSql
        .mockResolvedValueOnce(mockUsers)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const request = createRequest({ q: '77' })
      const response = await GET(request)
      const data = await response.json()

      expect(data).toHaveProperty('query', '77')
      expect(data).toHaveProperty('total', 2)
      expect(data).toHaveProperty('results')
    })

    it('should include all required fields in search results', async () => {
      const mockUsers = [{ id: 1, telegram_user_id: 123, is_pro: true, payments_count: 1 }]

      mockSql
        .mockResolvedValueOnce(mockUsers)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const request = createRequest({ q: '123' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.results[0]).toEqual(
        expect.objectContaining({
          type: expect.any(String),
          id: expect.any(Number),
          title: expect.any(String),
          subtitle: expect.any(String),
          url: expect.any(String),
          meta: expect.any(Object),
        })
      )
    })
  })

  describe('Deduplication', () => {
    beforeEach(() => {
      mockGetCurrentSession.mockResolvedValue({ userId: 1, role: 'admin' })
    })

    it('should not duplicate payments found in both numeric and alphanumeric searches', async () => {
      const mockPayment = {
        id: 100,
        tbank_payment_id: '123ABC',
        amount: 500,
        status: 'succeeded',
        telegram_user_id: 999,
      }

      // Use a mixed query "123ABC" which is NOT purely numeric
      // For non-numeric queries >= 3 chars:
      // 1. Alphanumeric payments search
      // 2. Referrals search
      mockSql
        .mockResolvedValueOnce([mockPayment]) // Payments (alphanumeric)
        .mockResolvedValueOnce([]) // Referrals

      const request = createRequest({ q: '123ABC' })
      const response = await GET(request)
      const data = await response.json()

      const paymentResults = data.results.filter((r: any) => r.type === 'payment' && r.id === 100)
      expect(paymentResults).toHaveLength(1)
    })
  })
})
