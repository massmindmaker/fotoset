/**
 * Unit tests for GET /api/admin/stats
 * Dashboard KPIs and statistics endpoint
 */

import { NextResponse } from 'next/server'

// Mock dependencies - must be declared before imports
const mockSql = jest.fn()
const mockGetCurrentSession = jest.fn()

jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql),
}))

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: jest.fn(),
}))

// Import after mocks
import { GET } from '@/app/api/admin/stats/route'
import { getCurrentSession } from '@/lib/admin/session'

// Cast mock
const mockedGetCurrentSession = getCurrentSession as jest.MockedFunction<typeof getCurrentSession>

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
  })

  describe('Authentication', () => {
    it('should return 401 without session', async () => {
      mockedGetCurrentSession.mockResolvedValue(null)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(mockSql).not.toHaveBeenCalled()
    })

    it('should proceed with valid session', async () => {
      mockedGetCurrentSession.mockResolvedValue({ adminId: 1 })
      mockSql.mockResolvedValue([{ count: '0' }])

      const response = await GET()

      expect(response.status).toBe(200)
      expect(mockSql).toHaveBeenCalled()
    })
  })

  describe('KPI Metrics', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({ adminId: 1 })
    })

    it('should return complete KPI metrics', async () => {
      // Mock all 12 parallel queries
      mockSql
        // Total users
        .mockResolvedValueOnce([{ count: '150' }])
        // Pro users
        .mockResolvedValueOnce([{ count: '45' }])
        // Revenue MTD
        .mockResolvedValueOnce([{ total: '22500' }])
        // Revenue today
        .mockResolvedValueOnce([{ total: '1500' }])
        // Total generations
        .mockResolvedValueOnce([{ count: '200' }])
        // Pending generations
        .mockResolvedValueOnce([{ count: '5' }])
        // Tier stats
        .mockResolvedValueOnce([])
        // Revenue by day
        .mockResolvedValueOnce([])
        // Registrations by day
        .mockResolvedValueOnce([])
        // Recent payments
        .mockResolvedValueOnce([])
        // Recent users
        .mockResolvedValueOnce([])
        // Recent generations
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.kpi).toEqual({
        totalUsers: 150,
        proUsers: 45,
        revenueMtd: 22500,
        revenueToday: 1500,
        conversionRate: 30.0,
        avgCheck: 500,
        totalGenerations: 200,
        pendingGenerations: 5,
      })
    })

    it('should calculate conversionRate correctly', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '100' }]) // Total users
        .mockResolvedValueOnce([{ count: '25' }]) // Pro users
        .mockResolvedValueOnce([{ total: '12500' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.kpi.conversionRate).toBe(25.0)
    })

    it('should calculate avgCheck correctly', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '100' }])
        .mockResolvedValueOnce([{ count: '20' }]) // 20 pro users
        .mockResolvedValueOnce([{ total: '10000' }]) // 10000 revenue
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.kpi.avgCheck).toBe(500) // 10000 / 20 = 500
    })

    it('should handle empty data gracefully (zeros)', async () => {
      // All queries return empty or zero
      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.kpi).toEqual({
        totalUsers: 0,
        proUsers: 0,
        revenueMtd: 0,
        revenueToday: 0,
        conversionRate: 0,
        avgCheck: 0,
        totalGenerations: 0,
        pendingGenerations: 0,
      })
    })

    it('should handle division by zero in conversionRate', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '0' }]) // 0 total users
        .mockResolvedValueOnce([{ count: '5' }]) // 5 pro users (edge case)
        .mockResolvedValueOnce([{ total: '2500' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.kpi.conversionRate).toBe(0)
    })

    it('should handle division by zero in avgCheck', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '50' }])
        .mockResolvedValueOnce([{ count: '0' }]) // 0 pro users
        .mockResolvedValueOnce([{ total: '5000' }]) // revenue exists but no pro users
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.kpi.avgCheck).toBe(0)
    })
  })

  describe('Charts Data', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({ adminId: 1 })
    })

    it('should return revenueByDay chart data', async () => {
      const mockRevenueByDay = [
        { date: '2024-01-01', revenue: '1500', transactions: '3' },
        { date: '2024-01-02', revenue: '2000', transactions: '4' },
      ]

      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRevenueByDay)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.charts.revenueByDay).toEqual([
        { date: '2024-01-01', revenue: 1500, transactions: 3 },
        { date: '2024-01-02', revenue: 2000, transactions: 4 },
      ])
    })

    it('should return registrationsByDay chart data', async () => {
      const mockRegistrationsByDay = [
        { date: '2024-01-01', registrations: '10' },
        { date: '2024-01-02', registrations: '15' },
      ]

      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRegistrationsByDay)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.charts.registrationsByDay).toEqual([
        { date: '2024-01-01', registrations: 10 },
        { date: '2024-01-02', registrations: 15 },
      ])
    })

    it('should return tierDistribution stats', async () => {
      const mockTierStats = [
        { tier: 'basic', count: '30', revenue: '3000' },
        { tier: 'standard', count: '20', revenue: '8000' },
        { tier: 'premium', count: '10', revenue: '15000' },
      ]

      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce(mockTierStats)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.charts.tierDistribution).toEqual({
        basic: { count: 30, revenue: 3000 },
        standard: { count: 20, revenue: 8000 },
        premium: { count: 10, revenue: 15000 },
      })
    })

    it('should handle empty charts data (empty arrays)', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]) // Empty tier stats
        .mockResolvedValueOnce([]) // Empty revenue by day
        .mockResolvedValueOnce([]) // Empty registrations by day
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.charts.revenueByDay).toEqual([])
      expect(data.charts.registrationsByDay).toEqual([])
      expect(data.charts.tierDistribution).toEqual({})
    })
  })

  describe('Recent Activity Lists', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({ adminId: 1 })
    })

    it('should return recent payments list', async () => {
      const mockRecentPayments = [
        {
          id: 1,
          amount: '500',
          tier: 'basic',
          status: 'succeeded',
          created_at: '2024-01-01T10:00:00Z',
          telegram_user_id: '123456',
        },
        {
          id: 2,
          amount: '1000',
          tier: 'premium',
          status: 'succeeded',
          created_at: '2024-01-01T11:00:00Z',
          telegram_user_id: '789012',
        },
      ]

      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRecentPayments)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.recent.payments).toEqual([
        {
          id: 1,
          amount: 500,
          tier: 'basic',
          status: 'succeeded',
          createdAt: '2024-01-01T10:00:00Z',
          telegramUserId: '123456',
        },
        {
          id: 2,
          amount: 1000,
          tier: 'premium',
          status: 'succeeded',
          createdAt: '2024-01-01T11:00:00Z',
          telegramUserId: '789012',
        },
      ])
    })

    it('should return recent users list', async () => {
      const mockRecentUsers = [
        {
          id: 1,
          telegram_user_id: '123456',
          created_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 2,
          telegram_user_id: '789012',
          created_at: '2024-01-01T11:00:00Z',
        },
      ]

      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRecentUsers)
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(data.recent.users).toEqual([
        {
          id: 1,
          telegramUserId: '123456',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: 2,
          telegramUserId: '789012',
          createdAt: '2024-01-01T11:00:00Z',
        },
      ])
    })

    it('should return recent generations list', async () => {
      const mockRecentGenerations = [
        {
          id: 1,
          status: 'completed',
          tier: 'premium',
          total_photos: 23,
          completed_photos: 23,
          created_at: '2024-01-01T10:00:00Z',
          telegram_user_id: '123456',
        },
        {
          id: 2,
          status: 'processing',
          tier: 'basic',
          total_photos: 23,
          completed_photos: 10,
          created_at: '2024-01-01T11:00:00Z',
          telegram_user_id: '789012',
        },
      ]

      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRecentGenerations)

      const response = await GET()
      const data = await response.json()

      expect(data.recent.generations).toEqual([
        {
          id: 1,
          status: 'completed',
          tier: 'premium',
          totalPhotos: 23,
          completedPhotos: 23,
          createdAt: '2024-01-01T10:00:00Z',
          telegramUserId: '123456',
        },
        {
          id: 2,
          status: 'processing',
          tier: 'basic',
          totalPhotos: 23,
          completedPhotos: 10,
          createdAt: '2024-01-01T11:00:00Z',
          telegramUserId: '789012',
        },
      ])
    })

    it('should handle empty recent lists (empty arrays)', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]) // Empty payments
        .mockResolvedValueOnce([]) // Empty users
        .mockResolvedValueOnce([]) // Empty generations

      const response = await GET()
      const data = await response.json()

      expect(data.recent.payments).toEqual([])
      expect(data.recent.users).toEqual([])
      expect(data.recent.generations).toEqual([])
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({ adminId: 1 })
    })

    it('should handle database connection errors', async () => {
      mockSql.mockRejectedValue(new Error('Connection failed'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch stats' })
    })

    it('should handle query execution errors', async () => {
      mockSql.mockRejectedValue(new Error('Query syntax error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch stats')
    })

    it('should handle missing DATABASE_URL', async () => {
      delete process.env.DATABASE_URL

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch stats' })
    })

    it('should handle malformed query results', async () => {
      // Return unexpected data structure
      mockSql
        .mockResolvedValueOnce([{ wrong_field: 'value' }])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([null])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 'invalid' }])
        .mockResolvedValueOnce([{ count: null }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()

      // Should still return 200 with safe defaults
      expect(response.status).toBe(200)
    })
  })

  describe('Data Type Conversions', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({ adminId: 1 })
    })

    it('should convert string counts to integers', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '999' }])
        .mockResolvedValueOnce([{ count: '42' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ count: '500' }])
        .mockResolvedValueOnce([{ count: '15' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(typeof data.kpi.totalUsers).toBe('number')
      expect(typeof data.kpi.proUsers).toBe('number')
      expect(typeof data.kpi.totalGenerations).toBe('number')
      expect(typeof data.kpi.pendingGenerations).toBe('number')
      expect(data.kpi.totalUsers).toBe(999)
      expect(data.kpi.proUsers).toBe(42)
    })

    it('should convert string amounts to floats', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ total: '12345.67' }])
        .mockResolvedValueOnce([{ total: '890.12' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(typeof data.kpi.revenueMtd).toBe('number')
      expect(typeof data.kpi.revenueToday).toBe('number')
      expect(data.kpi.revenueMtd).toBe(12345.67)
      expect(data.kpi.revenueToday).toBe(890.12)
    })
  })
})
