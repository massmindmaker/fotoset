/**
 * Unit tests for /api/admin/settings
 * Admin settings management endpoints
 */

import { NextRequest } from 'next/server'

// Mock dependencies - must be declared before imports
const mockSql = jest.fn()
const mockGetCurrentSession = jest.fn()
const mockHasPermission = jest.fn()
const mockLogAdminAction = jest.fn()

jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql),
}))

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: jest.fn(),
}))

jest.mock('@/lib/admin/permissions', () => ({
  hasPermission: jest.fn(),
}))

jest.mock('@/lib/admin/audit', () => ({
  logAdminAction: jest.fn(),
}))

// Import after mocks
import { GET, PUT } from '@/app/api/admin/settings/route'
import { getCurrentSession } from '@/lib/admin/session'
import { hasPermission } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

// Cast mocks
const mockedGetCurrentSession = getCurrentSession as jest.MockedFunction<typeof getCurrentSession>
const mockedHasPermission = hasPermission as jest.MockedFunction<typeof hasPermission>
const mockedLogAdminAction = logAdminAction as jest.MockedFunction<typeof logAdminAction>

describe('GET /api/admin/settings', () => {
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
      mockedGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1
      })
      mockSql.mockResolvedValue([])

      const response = await GET()

      expect(response.status).toBe(200)
      expect(mockSql).toHaveBeenCalled()
    })
  })

  describe('Settings Retrieval', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1
      })
    })

    it('should return all settings with updatedAt timestamp', async () => {
      const mockSettings = [
        { key: 'maintenance_mode', value: false, updated_at: '2024-01-01T10:00:00Z' },
        { key: 'max_generations_per_day', value: 100, updated_at: '2024-01-01T10:00:00Z' },
        { key: 'feature_flags', value: { newUI: true }, updated_at: '2024-01-01T10:00:00Z' }
      ]

      mockSql.mockResolvedValue(mockSettings)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings).toEqual({
        maintenance_mode: false,
        max_generations_per_day: 100,
        feature_flags: { newUI: true }
      })
      expect(data.updatedAt).toBe('2024-01-01T10:00:00Z')
    })

    it('should return empty object when no settings exist', async () => {
      mockSql.mockResolvedValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings).toEqual({})
      expect(data.updatedAt).toBeUndefined()
    })

    it('should handle complex nested settings values', async () => {
      const mockSettings = [
        {
          key: 'notification_config',
          value: {
            email: { enabled: true, templates: ['welcome', 'generation_ready'] },
            telegram: { enabled: false }
          },
          updated_at: '2024-01-01T12:00:00Z'
        }
      ]

      mockSql.mockResolvedValue(mockSettings)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings.notification_config).toEqual({
        email: { enabled: true, templates: ['welcome', 'generation_ready'] },
        telegram: { enabled: false }
      })
    })

    it('should handle multiple settings with different updatedAt (use first)', async () => {
      const mockSettings = [
        { key: 'setting1', value: 'value1', updated_at: '2024-01-01T10:00:00Z' },
        { key: 'setting2', value: 'value2', updated_at: '2024-01-02T10:00:00Z' }
      ]

      mockSql.mockResolvedValue(mockSettings)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.updatedAt).toBe('2024-01-01T10:00:00Z')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 1
      })
    })

    it('should handle database connection errors', async () => {
      mockSql.mockRejectedValue(new Error('Connection failed'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch settings' })
    })

    it('should handle missing DATABASE_URL', async () => {
      delete process.env.DATABASE_URL

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch settings' })
    })

    it('should handle query execution errors', async () => {
      mockSql.mockRejectedValue(new Error('Query syntax error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch settings')
    })
  })
})

describe('PUT /api/admin/settings', () => {
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

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: { maintenance_mode: true } })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
      expect(mockSql).not.toHaveBeenCalled()
      expect(mockedLogAdminAction).not.toHaveBeenCalled()
    })
  })

  describe('Authorization', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'viewer',
        sessionId: 1
      })
    })

    it('should return 403 without settings.edit permission', async () => {
      mockedHasPermission.mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: { maintenance_mode: true } })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data).toEqual({ error: 'Forbidden' })
      expect(mockedHasPermission).toHaveBeenCalledWith('viewer', 'settings.edit')
      expect(mockSql).not.toHaveBeenCalled()
    })

    it('should proceed with settings.edit permission', async () => {
      mockedGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'super_admin',
        sessionId: 1
      })
      mockedHasPermission.mockReturnValue(true)
      mockSql.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: { maintenance_mode: true } })
      })

      const response = await PUT(request)

      expect(response.status).toBe(200)
      expect(mockedHasPermission).toHaveBeenCalledWith('super_admin', 'settings.edit')
      expect(mockSql).toHaveBeenCalled()
    })
  })

  describe('Settings Update', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'super_admin',
        sessionId: 1
      })
      mockedHasPermission.mockReturnValue(true)
      mockSql.mockResolvedValue([])
      mockedLogAdminAction.mockResolvedValue(undefined)
    })

    it('should update settings successfully', async () => {
      const newSettings = {
        maintenance_mode: true,
        max_generations_per_day: 50
      }

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: newSettings })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        settings: newSettings
      })

      // Verify database update
      expect(mockSql).toHaveBeenCalled()
      const sqlCall = mockSql.mock.calls[0]
      expect(sqlCall).toBeDefined()
    })

    it('should merge with existing settings', async () => {
      // Mock existing settings in DB
      mockSql
        .mockResolvedValueOnce([
          { key: 'maintenance_mode', value: false, updated_at: '2024-01-01T10:00:00Z' },
          { key: 'feature_flags', value: { oldFlag: true }, updated_at: '2024-01-01T10:00:00Z' }
        ])
        .mockResolvedValueOnce([]) // UPDATE query

      const newSettings = {
        max_generations_per_day: 100
      }

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: newSettings })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return updated settings in response', async () => {
      const newSettings = {
        feature_flags: { newUI: true, darkMode: false }
      }

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: newSettings })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings).toEqual(newSettings)
    })

    it('should log audit action', async () => {
      const newSettings = { maintenance_mode: true }

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: newSettings })
      })

      await PUT(request)

      expect(mockedLogAdminAction).toHaveBeenCalledWith({
        adminId: 1,
        action: 'settings_updated',
        targetType: 'setting',
        metadata: {
          newSettings
        }
      })
    })
  })

  describe('Validation', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'super_admin',
        sessionId: 1
      })
      mockedHasPermission.mockReturnValue(true)
    })

    it('should return 400 when body is empty', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({})
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
      expect(mockSql).not.toHaveBeenCalled()
    })

    it('should return 400 when settings is not an object', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: 'invalid' })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
      expect(mockSql).not.toHaveBeenCalled()
    })

    it('should return 400 when settings is null', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: null })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should return 400 when settings is array', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: [] })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
        role: 'super_admin',
        sessionId: 1
      })
      mockedHasPermission.mockReturnValue(true)
    })

    it('should handle database connection errors', async () => {
      mockSql.mockRejectedValue(new Error('Connection failed'))

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: { maintenance_mode: true } })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to update settings' })
    })

    it('should handle missing DATABASE_URL', async () => {
      delete process.env.DATABASE_URL

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: { maintenance_mode: true } })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to update settings' })
    })

    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: 'invalid json'
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should continue even if audit logging fails', async () => {
      mockSql.mockResolvedValue([])
      mockedLogAdminAction.mockRejectedValue(new Error('Audit log failed'))

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: { maintenance_mode: true } })
      })

      const response = await PUT(request)

      // Should still succeed even if audit fails
      expect(response.status).toBe(200)
    })
  })
})
