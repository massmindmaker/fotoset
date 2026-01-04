/**
 * Unit tests for Admin Exports API Route
 * File: app/api/admin/exports/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { GET } from '@/app/api/admin/exports/route'

// Mock dependencies
const mockSql = jest.fn()

jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql),
}))

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: jest.fn(),
}))

jest.mock('@/lib/admin/audit', () => ({
  logAdminAction: jest.fn(),
}))

jest.mock('@/lib/admin/export', () => ({
  toCSV: jest.fn(),
  toJSON: jest.fn(),
}))

// Mock environment
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Get the mocked functions
const { getCurrentSession } = require('@/lib/admin/session')
const { logAdminAction } = require('@/lib/admin/audit')
const { toCSV, toJSON } = require('@/lib/admin/export')

describe('GET /api/admin/exports', () => {
  const mockSession = {
    adminId: 1,
    email: 'admin@test.com',
    name: 'Test Admin',
    permissions: ['payments.export'],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getCurrentSession as jest.Mock).mockResolvedValue(mockSession)
    ;(logAdminAction as jest.Mock).mockResolvedValue(undefined)
    ;(toCSV as jest.Mock).mockReturnValue('id,name\n1,test')
    ;(toJSON as jest.Mock).mockReturnValue('[]')
  })

  describe('Authentication', () => {
    it('should return 401 without session', async () => {
      ;(getCurrentSession as jest.Mock).mockResolvedValue(null)

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users')
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(mockSql).not.toHaveBeenCalled()
    })
  })

  describe('Validation', () => {
    it('should return 400 when type is missing', async () => {
      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports')
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ error: 'Invalid export type' })
      expect(mockSql).not.toHaveBeenCalled()
    })

    it('should return 400 for invalid type', async () => {
      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=invalid')
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ error: 'Invalid export type' })
      expect(mockSql).not.toHaveBeenCalled()
    })
  })

  describe('Export Users', () => {
    it('should export users as CSV', async () => {
      const mockUsers = [
        {
          id: 1,
          telegram_user_id: '123456',
          created_at: new Date('2025-01-01'),
          is_pro: true,
          avatars_count: 2,
          payments_count: 1,
          total_spent: 500,
        },
      ]

      mockSql.mockResolvedValue(mockUsers)
      ;(toCSV as jest.Mock).mockReturnValue('id,telegram_user_id\n1,123456')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users&format=csv')
      )

      const response = await GET(request)
      const content = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
      expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="users-export-.*\.csv"$/)
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(content).toBe('id,telegram_user_id\n1,123456')

      expect(mockSql).toHaveBeenCalledTimes(1)
      expect(toCSV).toHaveBeenCalledWith(mockUsers)
    })

    it('should export users as JSON', async () => {
      const mockUsers = [
        {
          id: 1,
          telegram_user_id: '123456',
          is_pro: true,
        },
      ]

      mockSql.mockResolvedValue(mockUsers)
      ;(toJSON as jest.Mock).mockReturnValue(JSON.stringify(mockUsers, null, 2))

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users&format=json')
      )

      const response = await GET(request)
      const content = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="users-export-.*\.json"$/)
      expect(content).toBe(JSON.stringify(mockUsers, null, 2))

      expect(toJSON).toHaveBeenCalledWith(mockUsers)
    })

    it('should default to CSV format when format not specified', async () => {
      mockSql.mockResolvedValue([])
      ;(toCSV as jest.Mock).mockReturnValue('')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users')
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
      expect(toCSV).toHaveBeenCalled()
      expect(toJSON).not.toHaveBeenCalled()
    })
  })

  describe('Export Payments', () => {
    it('should export payments as CSV', async () => {
      const mockPayments = [
        {
          id: 1,
          tbank_payment_id: 'tbank_123',
          user_id: 1,
          telegram_user_id: '123456',
          amount: 500,
          status: 'succeeded',
          tier_id: 'pro',
          photo_count: 23,
          refund_amount: null,
          refund_at: null,
          created_at: new Date('2025-01-01'),
        },
      ]

      mockSql.mockResolvedValue(mockPayments)
      ;(toCSV as jest.Mock).mockReturnValue('id,amount,status\n1,500,succeeded')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=payments&format=csv')
      )

      const response = await GET(request)
      const content = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
      expect(content).toBe('id,amount,status\n1,500,succeeded')
      expect(mockSql).toHaveBeenCalledTimes(1)
    })

    it('should export payments as JSON', async () => {
      const mockPayments = [
        {
          id: 1,
          tbank_payment_id: 'tbank_123',
          amount: 500,
          status: 'succeeded',
        },
      ]

      mockSql.mockResolvedValue(mockPayments)
      ;(toJSON as jest.Mock).mockReturnValue(JSON.stringify(mockPayments, null, 2))

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=payments&format=json')
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(toJSON).toHaveBeenCalledWith(mockPayments)
    })
  })

  describe('Export Generations', () => {
    it('should export generations as CSV', async () => {
      const mockGenerations = [
        {
          id: 1,
          avatar_id: 1,
          avatar_name: 'Test Avatar',
          telegram_user_id: '123456',
          status: 'completed',
          total_photos: 23,
          completed_photos: 23,
          progress: 100.0,
          duration: 300,
          error_message: null,
          created_at: new Date('2025-01-01'),
        },
      ]

      mockSql.mockResolvedValue(mockGenerations)
      ;(toCSV as jest.Mock).mockReturnValue('id,status,progress\n1,completed,100.0')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=generations&format=csv')
      )

      const response = await GET(request)
      const content = await response.text()

      expect(response.status).toBe(200)
      expect(content).toBe('id,status,progress\n1,completed,100.0')
      expect(mockSql).toHaveBeenCalledTimes(1)
    })
  })

  describe('Export Referrals', () => {
    it('should export referrals as CSV', async () => {
      const mockReferrals = [
        {
          user_id: 1,
          telegram_user_id: '123456',
          referral_code: 'ABC123',
          referrals_count: 5,
          conversions: 3,
          balance: 150,
          total_earned: 300,
          total_withdrawn: 150,
        },
      ]

      mockSql.mockResolvedValue(mockReferrals)
      ;(toCSV as jest.Mock).mockReturnValue('user_id,referral_code,balance\n1,ABC123,150')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=referrals&format=csv')
      )

      const response = await GET(request)
      const content = await response.text()

      expect(response.status).toBe(200)
      expect(content).toBe('user_id,referral_code,balance\n1,ABC123,150')
      expect(mockSql).toHaveBeenCalledTimes(1)
    })
  })

  describe('Export Withdrawals', () => {
    it('should export withdrawals as CSV', async () => {
      const mockWithdrawals = [
        {
          id: 1,
          telegram_user_id: '123456',
          amount: 200,
          ndfl_amount: 26,
          payout_amount: 174,
          method: 'tbank',
          status: 'completed',
          created_at: new Date('2025-01-01'),
          processed_at: new Date('2025-01-02'),
        },
      ]

      mockSql.mockResolvedValue(mockWithdrawals)
      ;(toCSV as jest.Mock).mockReturnValue('id,amount,status\n1,200,completed')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=withdrawals&format=csv')
      )

      const response = await GET(request)
      const content = await response.text()

      expect(response.status).toBe(200)
      expect(content).toBe('id,amount,status\n1,200,completed')
      expect(mockSql).toHaveBeenCalledTimes(1)
    })
  })

  describe('Date Filtering', () => {
    it('should filter by dateFrom', async () => {
      mockSql.mockResolvedValue([])
      ;(toCSV as jest.Mock).mockReturnValue('')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users&dateFrom=2025-01-01')
      )

      await GET(request)

      expect(mockSql).toHaveBeenCalledTimes(1)
      // SQL should include dateFrom parameter
      const sqlCall = mockSql.mock.calls[0]
      const sqlString = sqlCall[0].join('')
      expect(sqlString).toContain('created_at')
      expect(sqlString).toContain('>=')
    })

    it('should filter by dateTo', async () => {
      mockSql.mockResolvedValue([])
      ;(toCSV as jest.Mock).mockReturnValue('')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users&dateTo=2025-12-31')
      )

      await GET(request)

      expect(mockSql).toHaveBeenCalledTimes(1)
      // SQL should include dateTo parameter
      const sqlCall = mockSql.mock.calls[0]
      const sqlString = sqlCall[0].join('')
      expect(sqlString).toContain('created_at')
      expect(sqlString).toContain('<=')
    })

    it('should filter by date range (dateFrom and dateTo)', async () => {
      mockSql.mockResolvedValue([])
      ;(toCSV as jest.Mock).mockReturnValue('')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=payments&dateFrom=2025-01-01&dateTo=2025-12-31')
      )

      await GET(request)

      expect(mockSql).toHaveBeenCalledTimes(1)
      const sqlCall = mockSql.mock.calls[0]
      const sqlString = sqlCall[0].join('')
      expect(sqlString).toContain('created_at')
    })
  })

  describe('Row Limits', () => {
    it('should limit export to 10,000 rows max', async () => {
      mockSql.mockResolvedValue([])
      ;(toCSV as jest.Mock).mockReturnValue('')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users')
      )

      await GET(request)

      expect(mockSql).toHaveBeenCalledTimes(1)
      const sqlCall = mockSql.mock.calls[0]
      const sqlString = sqlCall[0].join('')
      expect(sqlString).toContain('LIMIT')
      // Check that the limit parameter is 10000
      const limitIndex = sqlCall.findIndex((arg: unknown) => arg === 10000)
      expect(limitIndex).toBeGreaterThan(-1)
    })
  })

  describe('Audit Logging', () => {
    it('should log admin action on export', async () => {
      mockSql.mockResolvedValue([{ id: 1, name: 'test' }])
      ;(toCSV as jest.Mock).mockReturnValue('id,name\n1,test')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users&format=csv&dateFrom=2025-01-01')
      )

      await GET(request)

      expect(logAdminAction).toHaveBeenCalledTimes(1)
      expect(logAdminAction).toHaveBeenCalledWith({
        adminId: mockSession.adminId,
        action: 'data_exported',
        metadata: {
          type: 'users',
          format: 'csv',
          rows: 1,
          dateFrom: '2025-01-01',
          dateTo: null,
        },
      })
    })

    it('should log export with all metadata', async () => {
      mockSql.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])
      ;(toJSON as jest.Mock).mockReturnValue('[]')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=payments&format=json&dateFrom=2025-01-01&dateTo=2025-12-31')
      )

      await GET(request)

      expect(logAdminAction).toHaveBeenCalledWith({
        adminId: mockSession.adminId,
        action: 'data_exported',
        metadata: {
          type: 'payments',
          format: 'json',
          rows: 3,
          dateFrom: '2025-01-01',
          dateTo: '2025-12-31',
        },
      })
    })
  })

  describe('Response Headers', () => {
    it('should set correct Content-Type for CSV', async () => {
      mockSql.mockResolvedValue([])
      ;(toCSV as jest.Mock).mockReturnValue('')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users&format=csv')
      )

      const response = await GET(request)

      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    })

    it('should set correct Content-Type for JSON', async () => {
      mockSql.mockResolvedValue([])
      ;(toJSON as jest.Mock).mockReturnValue('[]')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users&format=json')
      )

      const response = await GET(request)

      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should set Content-Disposition for download with correct filename', async () => {
      mockSql.mockResolvedValue([])
      ;(toCSV as jest.Mock).mockReturnValue('')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=payments&format=csv')
      )

      const response = await GET(request)

      const disposition = response.headers.get('Content-Disposition')
      expect(disposition).toMatch(/^attachment; filename="payments-export-\d{4}-\d{2}-\d{2}\.csv"$/)
    })

    it('should set Cache-Control to no-cache', async () => {
      mockSql.mockResolvedValue([])
      ;(toCSV as jest.Mock).mockReturnValue('')

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users')
      )

      const response = await GET(request)

      expect(response.headers.get('Cache-Control')).toBe('no-cache')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      mockSql.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users')
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to export data' })
    })

    it('should handle export utility errors', async () => {
      mockSql.mockResolvedValue([{ id: 1 }])
      ;(toCSV as jest.Mock).mockImplementation(() => {
        throw new Error('CSV conversion failed')
      })

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users&format=csv')
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to export data' })
    })

    it('should handle session retrieval errors', async () => {
      (getCurrentSession as jest.Mock).mockRejectedValue(new Error('Session error'))

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users')
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to export data' })
    })
  })

  describe('Environment Variables', () => {
    it('should throw error when DATABASE_URL is not set', async () => {
      const originalUrl = process.env.DATABASE_URL
      delete process.env.DATABASE_URL

      const request = new NextRequest(
        new URL('http://localhost/api/admin/exports?type=users')
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to export data' })

      // Restore environment
      process.env.DATABASE_URL = originalUrl
    })
  })
})
