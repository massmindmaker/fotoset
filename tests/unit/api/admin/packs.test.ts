/**
 * Unit tests for /api/admin/packs
 * Photo packs management endpoints
 */

import { NextRequest } from 'next/server'

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
import { GET, POST } from '@/app/api/admin/packs/route'
import { getCurrentSession } from '@/lib/admin/session'

// Cast mocks
const mockedGetCurrentSession = getCurrentSession as jest.MockedFunction<typeof getCurrentSession>

// Helper to create requests
function createGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/packs')
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  return new NextRequest(url)
}

function createPostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/packs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// Mock session data
const mockSession = {
  adminId: 1,
  email: 'admin@test.com',
  role: 'admin' as const,
  sessionId: 1,
}

describe('GET /api/admin/packs', () => {
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

      const request = createGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('should proceed with valid session', async () => {
      mockedGetCurrentSession.mockResolvedValue(mockSession)
      mockSql.mockResolvedValueOnce([{ total: '0' }]) // count
      mockSql.mockResolvedValueOnce([]) // packs

      const request = createGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Packs Retrieval', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue(mockSession)
    })

    it('should return packs with pagination', async () => {
      const mockPacks = [
        {
          id: 1,
          name: 'Professional Pack',
          description: 'Business portraits',
          is_active: true,
          items_count: '5',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Creative Pack',
          description: 'Artistic portraits',
          is_active: false,
          items_count: '3',
          created_at: new Date().toISOString(),
        },
      ]

      mockSql.mockResolvedValueOnce([{ total: '2' }])
      mockSql.mockResolvedValueOnce(mockPacks)

      const request = createGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.packs).toHaveLength(2)
      expect(data.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      })
    })

    it('should filter active only packs', async () => {
      const activePacks = [
        {
          id: 1,
          name: 'Active Pack',
          is_active: true,
          items_count: '5',
        },
      ]

      mockSql.mockResolvedValueOnce([{ total: '1' }])
      mockSql.mockResolvedValueOnce(activePacks)

      const request = createGetRequest({ active: 'true' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.packs).toHaveLength(1)
      expect(data.packs[0].is_active).toBe(true)
    })

    it('should handle pagination params', async () => {
      mockSql.mockResolvedValueOnce([{ total: '100' }])
      mockSql.mockResolvedValueOnce([])

      const request = createGetRequest({ page: '3', limit: '10' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(3)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.totalPages).toBe(10)
    })

    it('should return empty list when no packs', async () => {
      mockSql.mockResolvedValueOnce([{ total: '0' }])
      mockSql.mockResolvedValueOnce([])

      const request = createGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.packs).toEqual([])
      expect(data.pagination.total).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockedGetCurrentSession.mockResolvedValue(mockSession)
      mockSql.mockRejectedValueOnce(new Error('DB Error'))

      const request = createGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch packs')
    })
  })
})

describe('POST /api/admin/packs', () => {
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

      const request = createPostRequest({ name: 'Test Pack' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('Validation', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue(mockSession)
    })

    it('should return 400 when name is missing', async () => {
      const request = createPostRequest({ description: 'Some pack' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name is required')
    })
  })

  describe('Pack Creation', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue(mockSession)
    })

    it('should create pack with required fields only', async () => {
      const newPack = {
        id: 1,
        admin_id: 1,
        name: 'New Pack',
        description: null,
        cover_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      }

      mockSql.mockResolvedValueOnce([newPack])

      const request = createPostRequest({ name: 'New Pack' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.pack.name).toBe('New Pack')
      expect(data.pack.is_active).toBe(true)
    })

    it('should create pack with all fields', async () => {
      const newPack = {
        id: 2,
        admin_id: 1,
        name: 'Premium Pack',
        description: 'High-quality portraits for professionals',
        cover_url: 'https://example.com/cover.jpg',
        is_active: true,
        created_at: new Date().toISOString(),
      }

      mockSql.mockResolvedValueOnce([newPack])

      const request = createPostRequest({
        name: 'Premium Pack',
        description: 'High-quality portraits for professionals',
        cover_url: 'https://example.com/cover.jpg',
        is_active: true,
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.pack.name).toBe('Premium Pack')
      expect(data.pack.description).toBe('High-quality portraits for professionals')
      expect(data.pack.cover_url).toBe('https://example.com/cover.jpg')
    })

    it('should create inactive pack when is_active is false', async () => {
      const newPack = {
        id: 3,
        admin_id: 1,
        name: 'Draft Pack',
        is_active: false,
        created_at: new Date().toISOString(),
      }

      mockSql.mockResolvedValueOnce([newPack])

      const request = createPostRequest({
        name: 'Draft Pack',
        is_active: false,
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.pack.is_active).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockedGetCurrentSession.mockResolvedValue(mockSession)
      mockSql.mockRejectedValueOnce(new Error('DB Error'))

      const request = createPostRequest({ name: 'Test Pack' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create pack')
    })
  })
})
