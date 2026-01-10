/**
 * Integration tests for Generate API with web user support
 * Tests POST /api/generate with neonUserId
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/generate/route'
import { sql } from '@/lib/db'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  sql: jest.fn(),
}))

jest.mock('@/lib/qstash', () => ({
  publishGenerationJob: jest.fn().mockResolvedValue({ messageId: 'mock_msg_123' }),
  GENERATION_CONFIG: {
    CHUNK_SIZE: 5,
    MAX_CONCURRENT: 1,
    CHUNK_DELAY_MS: 500,
    TASK_CREATION_DELAY_MS: 500,
  },
  HAS_QSTASH: true,
}))

jest.mock('@/lib/kie-ai', () => ({
  createKieTask: jest.fn().mockResolvedValue({
    taskId: 'kie_task_123',
    status: 'pending',
  }),
}))

jest.mock('@/lib/telegram-auth', () => ({
  validateTelegramInitData: jest.fn(),
}))

import { validateTelegramInitData } from '@/lib/telegram-auth'
import { publishGenerationJob } from '@/lib/qstash'

const mockSql = sql as jest.MockedFunction<typeof sql>
const mockValidate = validateTelegramInitData as jest.MockedFunction<typeof validateTelegramInitData>
const mockPublishJob = publishGenerationJob as jest.MockedFunction<typeof publishGenerationJob>

// Test data
const validReferenceImages = [
  'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
]

function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('POST /api/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Web user support (neonUserId)', () => {
    it('should accept request with neonUserId (web user)', async () => {
      mockSql
        .mockResolvedValueOnce([{ id: 1, neon_user_id: 'neon_123' }]) // Find user
        .mockResolvedValueOnce([{ id: 100 }]) // Find avatar
        .mockResolvedValueOnce([{ id: 1, status: 'succeeded' }]) // Check payment
        .mockResolvedValueOnce([{ id: 200 }]) // Create job
        .mockResolvedValueOnce([]) // Update avatar status

      const request = createRequest({
        neonUserId: 'neon_123',
        avatarId: 100,
        styleId: 'professional',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.jobId).toBeDefined()
    })

    it('should accept request with telegramUserId (backwards compatibility)', async () => {
      mockValidate.mockReturnValue({
        user: { id: 12345, username: 'testuser' },
        auth_date: Date.now() / 1000,
        hash: 'test_hash',
      })

      mockSql
        .mockResolvedValueOnce([{ id: 1, telegram_user_id: 12345 }]) // Find user
        .mockResolvedValueOnce([{ id: 100 }]) // Find avatar
        .mockResolvedValueOnce([{ id: 1, status: 'succeeded' }]) // Check payment
        .mockResolvedValueOnce([{ id: 200 }]) // Create job
        .mockResolvedValueOnce([]) // Update avatar status

      const request = createRequest({
        initData: 'valid_init_data',
        avatarId: 100,
        styleId: 'lifestyle',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject request without any user identifier', async () => {
      const request = createRequest({
        avatarId: 100,
        styleId: 'creative',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should prioritize telegramUserId when both are provided', async () => {
      mockValidate.mockReturnValue({
        user: { id: 12345, username: 'testuser' },
        auth_date: Date.now() / 1000,
        hash: 'test_hash',
      })

      mockSql
        .mockResolvedValueOnce([{ id: 1, telegram_user_id: 12345 }])
        .mockResolvedValueOnce([{ id: 100 }])
        .mockResolvedValueOnce([{ id: 1, status: 'succeeded' }])
        .mockResolvedValueOnce([{ id: 200 }])
        .mockResolvedValueOnce([])

      const request = createRequest({
        initData: 'valid_init_data',
        neonUserId: 'neon_999', // Should be ignored
        avatarId: 100,
        styleId: 'professional',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      // The job should use telegramUserId, not neonUserId
      expect(mockPublishJob).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: 12345,
        }),
        expect.any(String)
      )
    })
  })

  describe('QStash payload with neonUserId', () => {
    it('should include neonUserId in QStash payload for web users', async () => {
      mockSql
        .mockResolvedValueOnce([{ id: 1, neon_user_id: 'neon_abc' }])
        .mockResolvedValueOnce([{ id: 100 }])
        .mockResolvedValueOnce([{ id: 1, status: 'succeeded' }])
        .mockResolvedValueOnce([{ id: 200 }])
        .mockResolvedValueOnce([])

      const request = createRequest({
        neonUserId: 'neon_abc',
        avatarId: 100,
        styleId: 'creative',
        referenceImages: validReferenceImages,
      })

      await POST(request)

      expect(mockPublishJob).toHaveBeenCalledWith(
        expect.objectContaining({
          neonUserId: 'neon_abc',
          avatarId: 100,
          styleId: 'creative',
        }),
        expect.any(String)
      )
    })

    it('should NOT include neonUserId for Telegram users', async () => {
      mockValidate.mockReturnValue({
        user: { id: 12345, username: 'testuser' },
        auth_date: Date.now() / 1000,
        hash: 'test_hash',
      })

      mockSql
        .mockResolvedValueOnce([{ id: 1, telegram_user_id: 12345 }])
        .mockResolvedValueOnce([{ id: 100 }])
        .mockResolvedValueOnce([{ id: 1, status: 'succeeded' }])
        .mockResolvedValueOnce([{ id: 200 }])
        .mockResolvedValueOnce([])

      const request = createRequest({
        initData: 'valid_init_data',
        avatarId: 100,
        styleId: 'professional',
        referenceImages: validReferenceImages,
      })

      await POST(request)

      expect(mockPublishJob).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: 12345,
        }),
        expect.any(String)
      )
      // neonUserId should not be in the payload
      const callArgs = mockPublishJob.mock.calls[0][0]
      expect(callArgs.neonUserId).toBeUndefined()
    })
  })

  describe('Payment verification for web users', () => {
    it('should verify payment exists for web user', async () => {
      mockSql
        .mockResolvedValueOnce([{ id: 1, neon_user_id: 'neon_xyz' }])
        .mockResolvedValueOnce([{ id: 100 }])
        .mockResolvedValueOnce([]) // No payment found

      const request = createRequest({
        neonUserId: 'neon_xyz',
        avatarId: 100,
        styleId: 'professional',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(402) // Payment required
      expect(data.error).toContain('payment')
    })

    it('should allow generation when payment succeeded for web user', async () => {
      mockSql
        .mockResolvedValueOnce([{ id: 1, neon_user_id: 'neon_paid' }])
        .mockResolvedValueOnce([{ id: 100 }])
        .mockResolvedValueOnce([{ id: 1, status: 'succeeded', amount: 499 }])
        .mockResolvedValueOnce([{ id: 200 }])
        .mockResolvedValueOnce([])

      const request = createRequest({
        neonUserId: 'neon_paid',
        avatarId: 100,
        styleId: 'lifestyle',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSql.mockRejectedValueOnce(new Error('Connection failed'))

      const request = createRequest({
        neonUserId: 'neon_123',
        avatarId: 100,
        styleId: 'professional',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should handle user not found', async () => {
      mockSql.mockResolvedValueOnce([]) // No user found

      const request = createRequest({
        neonUserId: 'nonexistent_user',
        avatarId: 100,
        styleId: 'creative',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
    })

    it('should handle avatar not found', async () => {
      mockSql
        .mockResolvedValueOnce([{ id: 1, neon_user_id: 'neon_123' }])
        .mockResolvedValueOnce([]) // No avatar found

      const request = createRequest({
        neonUserId: 'neon_123',
        avatarId: 999,
        styleId: 'professional',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
    })
  })

  describe('Input validation', () => {
    it('should require styleId', async () => {
      const request = createRequest({
        neonUserId: 'neon_123',
        avatarId: 100,
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('style')
    })

    it('should require minimum reference images', async () => {
      const request = createRequest({
        neonUserId: 'neon_123',
        avatarId: 100,
        styleId: 'professional',
        referenceImages: ['only_one_image'],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
    })

    it('should validate styleId value', async () => {
      mockSql
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ id: 100 }])

      const request = createRequest({
        neonUserId: 'neon_123',
        avatarId: 100,
        styleId: 'invalid_style',
        referenceImages: validReferenceImages,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('style')
    })
  })
})
