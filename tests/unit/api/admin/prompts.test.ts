/**
 * Unit tests for /api/admin/prompts
 * Saved prompts management endpoints
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
import { GET, POST } from '@/app/api/admin/prompts/route'
import { getCurrentSession } from '@/lib/admin/session'

// Cast mocks
const mockedGetCurrentSession = getCurrentSession as jest.MockedFunction<typeof getCurrentSession>

// Helper to create requests
function createGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/prompts')
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  return new NextRequest(url)
}

function createPostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/prompts', {
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

describe('GET /api/admin/prompts', () => {
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
      mockSql.mockResolvedValueOnce([]) // prompts

      const request = createGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Prompts Retrieval', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue(mockSession)
    })

    it('should return prompts with pagination', async () => {
      const mockPrompts = [
        {
          id: 1,
          name: 'Business Portrait',
          prompt: 'Professional portrait...',
          style_id: 'professional',
          is_favorite: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Casual Shot',
          prompt: 'Casual lifestyle...',
          style_id: 'lifestyle',
          is_favorite: false,
          created_at: new Date().toISOString(),
        },
      ]

      mockSql.mockResolvedValueOnce([{ total: '2' }])
      mockSql.mockResolvedValueOnce(mockPrompts)

      const request = createGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.prompts).toHaveLength(2)
      expect(data.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      })
    })

    it('should handle pagination params', async () => {
      mockSql.mockResolvedValueOnce([{ total: '100' }])
      mockSql.mockResolvedValueOnce([])

      const request = createGetRequest({ page: '2', limit: '20' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.totalPages).toBe(5)
    })

    it('should return empty list when no prompts', async () => {
      mockSql.mockResolvedValueOnce([{ total: '0' }])
      mockSql.mockResolvedValueOnce([])

      const request = createGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.prompts).toEqual([])
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
      expect(data.error).toBe('Failed to fetch prompts')
    })
  })
})

describe('POST /api/admin/prompts', () => {
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

      const request = createPostRequest({ name: 'Test', prompt: 'Test prompt' })
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
      const request = createPostRequest({ prompt: 'Test prompt' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name and prompt are required')
    })

    it('should return 400 when prompt is missing', async () => {
      const request = createPostRequest({ name: 'Test Name' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name and prompt are required')
    })
  })

  describe('Prompt Creation', () => {
    beforeEach(() => {
      mockedGetCurrentSession.mockResolvedValue(mockSession)
    })

    it('should create prompt with required fields', async () => {
      const newPrompt = {
        id: 1,
        admin_id: 1,
        name: 'Business Portrait',
        prompt: 'Professional portrait in studio',
        negative_prompt: null,
        style_id: null,
        preview_url: null,
        is_favorite: false,
        tags: null,
        created_at: new Date().toISOString(),
      }

      mockSql.mockResolvedValueOnce([newPrompt])

      const request = createPostRequest({
        name: 'Business Portrait',
        prompt: 'Professional portrait in studio',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.prompt.name).toBe('Business Portrait')
      expect(data.prompt.prompt).toBe('Professional portrait in studio')
    })

    it('should create prompt with all fields', async () => {
      const newPrompt = {
        id: 2,
        admin_id: 1,
        name: 'Creative Portrait',
        prompt: 'Artistic portrait with dramatic lighting',
        negative_prompt: 'blur, noise',
        style_id: 'creative',
        preview_url: 'https://example.com/preview.jpg',
        is_favorite: true,
        tags: ['art', 'dramatic'],
        created_at: new Date().toISOString(),
      }

      mockSql.mockResolvedValueOnce([newPrompt])

      const request = createPostRequest({
        name: 'Creative Portrait',
        prompt: 'Artistic portrait with dramatic lighting',
        negative_prompt: 'blur, noise',
        style_id: 'creative',
        preview_url: 'https://example.com/preview.jpg',
        is_favorite: true,
        tags: ['art', 'dramatic'],
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.prompt.style_id).toBe('creative')
      expect(data.prompt.is_favorite).toBe(true)
      expect(data.prompt.negative_prompt).toBe('blur, noise')
    })
  })

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockedGetCurrentSession.mockResolvedValue(mockSession)
      mockSql.mockRejectedValueOnce(new Error('DB Error'))

      const request = createPostRequest({
        name: 'Test',
        prompt: 'Test prompt',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create prompt')
    })
  })
})
