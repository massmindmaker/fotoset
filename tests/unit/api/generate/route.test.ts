/**
 * Unit Tests for /api/generate routes (POST and GET)
 *
 * Tests AI photo generation:
 * - POST: Start generation with payment validation
 * - GET: Poll generation status with ownership verification
 * - QStash integration (publish jobs)
 * - Auto-refund on failures
 * - Reference image validation
 * - IDOR security (access control)
 *
 * PRIORITY: P0 (Critical - Core business logic)
 * COVERAGE TARGET: 85%
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import {
  createUser,
  createProUser,
  createAvatar,
  createPayment,
  createSucceededPayment,
  createGenerationJob,
  createReferencePhotos,
  resetIdCounters,
  PRICING_TIERS,
} from '@/tests/fixtures/factory'

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockSql = jest.fn()
const mockFindOrCreateUser = jest.fn()
const mockPublishGenerationJob = jest.fn()
const mockAutoRefundForFailedGeneration = jest.fn()
const mockGetUserIdentifier = jest.fn()
const mockVerifyResourceOwnershipWithIdentifier = jest.fn()
const mockGenerateMultipleImages = jest.fn()
const mockUploadFromUrl = jest.fn()
const mockIsR2Configured = jest.fn()
const mockSendGenerationNotification = jest.fn()
const mockTrackGenerationStarted = jest.fn()
const mockTrackGenerationCompleted = jest.fn()
const mockTrackGenerationFailed = jest.fn()
const mockTrackQStashFallback = jest.fn()
const mockTrackQStashSuccess = jest.fn()

// Mock database
jest.mock('@/lib/db', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}))

// Mock user identity
jest.mock('@/lib/user-identity', () => ({
  findOrCreateUser: (...args: unknown[]) => mockFindOrCreateUser(...args),
}))

// Mock QStash
jest.mock('@/lib/qstash', () => ({
  HAS_QSTASH: true,
  publishGenerationJob: (...args: unknown[]) => mockPublishGenerationJob(...args),
  GENERATION_CONFIG: {
    CHUNK_SIZE: 5,
    MAX_CONCURRENT: 3,
    CHUNK_DELAY_MS: 1000,
    TASK_CREATION_DELAY_MS: 500,
  },
}))

// Mock T-Bank auto-refund
jest.mock('@/lib/tbank', () => ({
  autoRefundForFailedGeneration: (...args: unknown[]) => mockAutoRefundForFailedGeneration(...args),
}))

// Mock auth utils
jest.mock('@/lib/auth-utils', () => ({
  getUserIdentifier: (...args: unknown[]) => mockGetUserIdentifier(...args),
  verifyResourceOwnershipWithIdentifier: (...args: unknown[]) => mockVerifyResourceOwnershipWithIdentifier(...args),
}))

// Mock imagen
jest.mock('@/lib/imagen', () => ({
  generateMultipleImages: (...args: unknown[]) => mockGenerateMultipleImages(...args),
}))

// Mock R2
jest.mock('@/lib/r2', () => ({
  uploadFromUrl: (...args: unknown[]) => mockUploadFromUrl(...args),
  isR2Configured: () => mockIsR2Configured(),
  generatePromptKey: (avatarId: string, styleId: string, index: number, ext: string) =>
    `avatars/${avatarId}/${styleId}/${index}.${ext}`,
}))

// Mock telegram notify
jest.mock('@/lib/telegram-notify', () => ({
  sendGenerationNotification: (...args: unknown[]) => mockSendGenerationNotification(...args),
}))

// Mock Sentry events
jest.mock('@/lib/sentry-events', () => ({
  trackGenerationStarted: (...args: unknown[]) => mockTrackGenerationStarted(...args),
  trackGenerationCompleted: (...args: unknown[]) => mockTrackGenerationCompleted(...args),
  trackGenerationFailed: (...args: unknown[]) => mockTrackGenerationFailed(...args),
  trackQStashFallback: (...args: unknown[]) => mockTrackQStashFallback(...args),
  trackQStashSuccess: (...args: unknown[]) => mockTrackQStashSuccess(...args),
}))

// Mock image-utils
jest.mock('@/lib/image-utils', () => ({
  filterAndSortReferenceImages: (images: string[], max: number) => ({
    selected: images.slice(0, max),
    rejected: [],
  }),
  smartMergePrompt: ({ basePrompt, stylePrefix, styleSuffix }: {
    basePrompt: string
    stylePrefix: string
    styleSuffix: string
  }) => `${stylePrefix} ${basePrompt} ${styleSuffix}`,
  enhancePromptForConsistency: (prompt: string) => prompt,
}))

// Mock api-utils
jest.mock('@/lib/api-utils', () => ({
  success: (data: Record<string, unknown>) =>
    new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  error: (code: string, message: string, data?: Record<string, unknown>) =>
    new Response(JSON.stringify({ success: false, error: code, message, ...data }), {
      status: code === 'UNAUTHORIZED' || code === 'FORBIDDEN' ? 403 :
              code === 'NOT_FOUND' ? 404 :
              code === 'PAYMENT_REQUIRED' ? 402 :
              code === 'VALIDATION_ERROR' ? 400 : 500,
      headers: { 'Content-Type': 'application/json' },
    }),
  validateRequired: (body: Record<string, unknown>, fields: string[]) => {
    const missing = fields.filter(f => !body[f])
    return missing.length ? { valid: false, missing } : { valid: true }
  },
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}))

// Mock prompts
jest.mock('@/lib/prompts', () => ({
  PHOTOSET_PROMPTS: Array.from({ length: 23 }, (_, i) => `Prompt ${i + 1}`),
  STYLE_CONFIGS: {
    pinglass: {
      name: 'PinGlass',
      promptPrefix: 'Professional portrait,',
      promptSuffix: 'high quality, 4k',
    },
    professional: {
      name: 'Professional',
      promptPrefix: 'Business portrait,',
      promptSuffix: 'corporate style',
    },
    lifestyle: {
      name: 'Lifestyle',
      promptPrefix: 'Casual portrait,',
      promptSuffix: 'natural lighting',
    },
  },
}))

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createGenerateRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-user-id': String(body.telegramUserId || 123456789),
    },
    body: JSON.stringify(body),
  })
}

function createStatusRequest(params: { jobId?: string; avatarId?: string; telegramUserId?: number }): NextRequest {
  const searchParams = new URLSearchParams()
  if (params.jobId) searchParams.set('job_id', params.jobId)
  if (params.avatarId) searchParams.set('avatar_id', params.avatarId)

  return new NextRequest(`http://localhost:3000/api/generate?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      'x-telegram-user-id': String(params.telegramUserId || 123456789),
    },
  })
}

function createTestReferenceImages(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `https://cdn.pinglass.ru/refs/test-${i}.jpg`)
}

/**
 * Setup mocks for successful generation start
 *
 * SQL call order:
 * 1. Check successful payment
 * 2. Check existing avatar (if valid DB ID)
 * 3. Create new avatar (if not found) - OR use existing
 * 4. Insert reference images (multiple calls via Promise.allSettled)
 * 5. Get used prompts
 * 6. Create generation job
 */
function setupSuccessfulGenerationMocks(
  user: ReturnType<typeof createUser>,
  options: {
    existingAvatarId?: number
    referenceImageCount?: number
    usedPromptCount?: number
    totalPhotos?: number
  } = {}
) {
  const {
    existingAvatarId = 1,
    referenceImageCount = 5,
    usedPromptCount = 0,
    totalPhotos = 23,
  } = options

  mockFindOrCreateUser.mockResolvedValueOnce(user)

  // 1. Check successful payment
  mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])

  // 2. Check existing avatar
  if (existingAvatarId) {
    mockSql.mockResolvedValueOnce([{ id: existingAvatarId }])
  } else {
    mockSql.mockResolvedValueOnce([]) // No existing avatar
    // 3. Create new avatar
    mockSql.mockResolvedValueOnce([{ id: 1 }])
  }

  // 4. Insert reference images (one call per image)
  for (let i = 0; i < referenceImageCount; i++) {
    mockSql.mockResolvedValueOnce([])
  }

  // 5. Get used prompts
  const usedPrompts = Array.from({ length: usedPromptCount }, (_, i) => ({
    prompt: `Prompt ${i + 1} extra text for matching`,
  }))
  mockSql.mockResolvedValueOnce(usedPrompts)

  // 6. Create generation job
  const availablePhotos = Math.min(23 - usedPromptCount, totalPhotos)
  mockSql.mockResolvedValueOnce([{
    id: 1,
    avatar_id: existingAvatarId || 1,
    style_id: 'pinglass',
    status: 'pending',
    total_photos: availablePhotos,
    completed_photos: 0,
  }])

  // QStash publish success
  mockPublishGenerationJob.mockResolvedValueOnce({
    messageId: 'qstash-msg-123',
  })
}

// ============================================================================
// TESTS
// ============================================================================

describe('POST /api/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetIdCounters()
    mockIsR2Configured.mockReturnValue(false)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // VALIDATION TESTS
  // --------------------------------------------------------------------------

  describe('Validation', () => {
    test('GEN-VAL-001: should reject request without telegramUserId', async () => {
      const { POST } = await import('@/app/api/generate/route')

      const request = createGenerateRequest({
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      // Override telegramUserId to be missing
      const body = {
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      }

      const requestWithoutAuth = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const response = await POST(requestWithoutAuth)
      expect(response.status).toBe(403)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('UNAUTHORIZED')
    })

    test('GEN-VAL-002: should reject invalid telegramUserId format', async () => {
      const { POST } = await import('@/app/api/generate/route')

      const request = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: 'not-a-number',
          avatarId: '1',
          styleId: 'pinglass',
          referenceImages: createTestReferenceImages(5),
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    test('GEN-VAL-003: should reject missing avatarId', async () => {
      const { POST } = await import('@/app/api/generate/route')

      const request = createGenerateRequest({
        telegramUserId: 123456789,
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toContain('avatarId')
    })

    test('GEN-VAL-004: should reject missing styleId', async () => {
      const { POST } = await import('@/app/api/generate/route')

      const request = createGenerateRequest({
        telegramUserId: 123456789,
        avatarId: '1',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toContain('styleId')
    })

    test('GEN-VAL-005: should reject missing reference images (when not using stored)', async () => {
      const { POST } = await import('@/app/api/generate/route')

      const request = createGenerateRequest({
        telegramUserId: 123456789,
        avatarId: '1',
        styleId: 'pinglass',
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toContain('referenceImages')
    })

    test('GEN-VAL-006: should reject invalid style', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'invalid-style',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(500) // error() defaults to 500 for unknown codes

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('INVALID_STYLE')
    })
  })

  // --------------------------------------------------------------------------
  // PAYMENT VALIDATION TESTS
  // --------------------------------------------------------------------------

  describe('Payment Validation', () => {
    test('GEN-PAY-001: should reject user without payment', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      // No successful payment
      mockSql.mockResolvedValueOnce([])

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(402)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('PAYMENT_REQUIRED')
    })

    test('GEN-PAY-002: should accept user with successful payment', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      setupSuccessfulGenerationMocks(testUser)

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.jobId).toBeDefined()
    })

    test('GEN-PAY-003: should reject pending payment', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      // Pending payment (not succeeded)
      mockSql.mockResolvedValueOnce([])

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(402)

      const data = await response.json()
      expect(data.error).toBe('PAYMENT_REQUIRED')
    })
  })

  // --------------------------------------------------------------------------
  // QSTASH INTEGRATION TESTS
  // --------------------------------------------------------------------------

  describe('QStash Integration', () => {
    test('GEN-QS-001: should publish job to QStash successfully', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      setupSuccessfulGenerationMocks(testUser)

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.processingMode).toBe('qstash')

      expect(mockPublishGenerationJob).toHaveBeenCalledTimes(1)
      expect(mockTrackQStashSuccess).toHaveBeenCalled()
    })

    test('GEN-QS-002: should refund on QStash publish failure', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      // 1. Check successful payment
      mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])

      // 2. Check existing avatar
      mockSql.mockResolvedValueOnce([{ id: 1 }])

      // 3. Insert reference images (5 images)
      for (let i = 0; i < 5; i++) {
        mockSql.mockResolvedValueOnce([])
      }

      // 4. Get used prompts
      mockSql.mockResolvedValueOnce([])

      // 5. Create generation job
      mockSql.mockResolvedValueOnce([{ id: 1, status: 'pending', total_photos: 23 }])

      // QStash publish fails
      mockPublishGenerationJob.mockResolvedValueOnce(null)

      // Update job to failed
      mockSql.mockResolvedValueOnce([])

      // Auto-refund
      mockAutoRefundForFailedGeneration.mockResolvedValueOnce({
        success: true,
        refundedPaymentId: 'pay-refund-123',
      })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe('QUEUE_FAILED')
      expect(data.refunded).toBe(true)

      expect(mockAutoRefundForFailedGeneration).toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // STORED REFERENCES TESTS
  // --------------------------------------------------------------------------

  describe('Stored References', () => {
    test('GEN-REF-001: should use stored references when useStoredReferences=true', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      // Avatar ownership check
      mockSql.mockResolvedValueOnce([{ id: 1 }])

      // Get stored references
      mockSql.mockResolvedValueOnce([
        { image_url: 'https://cdn.pinglass.ru/ref1.jpg' },
        { image_url: 'https://cdn.pinglass.ru/ref2.jpg' },
        { image_url: 'https://cdn.pinglass.ru/ref3.jpg' },
      ])

      // Check successful payment
      mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])

      // Check existing avatar
      mockSql.mockResolvedValueOnce([{ id: 1 }])

      // Get used prompts
      mockSql.mockResolvedValueOnce([])

      // Create generation job
      mockSql.mockResolvedValueOnce([{ id: 1, status: 'pending', total_photos: 23 }])

      mockPublishGenerationJob.mockResolvedValueOnce({ messageId: 'qstash-msg-123' })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        useStoredReferences: true,
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.referenceImagesUsed).toBe(3)
    })

    test('GEN-REF-002: should fail if no stored references exist', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      // Avatar ownership check
      mockSql.mockResolvedValueOnce([{ id: 1 }])

      // No stored references
      mockSql.mockResolvedValueOnce([])

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        useStoredReferences: true,
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe('NO_REFERENCE_IMAGES')
    })

    test('GEN-REF-003: should deny access to another user avatar when using stored refs', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      // Avatar not found for this user (IDOR check)
      mockSql.mockResolvedValueOnce([])

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '999', // Avatar belongs to another user
        styleId: 'pinglass',
        useStoredReferences: true,
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe('AVATAR_NOT_FOUND')
    })
  })

  // --------------------------------------------------------------------------
  // PHOTO COUNT / TIER TESTS
  // --------------------------------------------------------------------------

  describe('Photo Count by Tier', () => {
    test('GEN-TIER-001: should limit photos to requested count', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      setupSuccessfulGenerationMocks(testUser, {
        referenceImageCount: 5,
        totalPhotos: 7,
      })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
        photoCount: 7, // Starter tier
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.totalPhotos).toBe(7)
    })

    test('GEN-TIER-002: should cap photos at max (23)', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      setupSuccessfulGenerationMocks(testUser, {
        referenceImageCount: 5,
        totalPhotos: 23,
      })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
        photoCount: 100, // Request more than max
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.totalPhotos).toBe(23) // Capped at max
    })
  })

  // --------------------------------------------------------------------------
  // PROMPT DEDUPLICATION TESTS
  // --------------------------------------------------------------------------

  describe('Prompt Deduplication', () => {
    test('GEN-PROMPT-001: should skip already used prompts', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      // 1. Check successful payment
      mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])

      // 2. Check existing avatar
      mockSql.mockResolvedValueOnce([{ id: 1 }])

      // 3. Insert reference images (5 images)
      for (let i = 0; i < 5; i++) {
        mockSql.mockResolvedValueOnce([])
      }

      // 4. Return 10 already used prompts that match first 100 chars of PHOTOSET_PROMPTS
      // PHOTOSET_PROMPTS mock is: ["Prompt 1", "Prompt 2", ..., "Prompt 23"]
      // Used prompts must start with the same text to be filtered out
      mockSql.mockResolvedValueOnce([
        { prompt: 'Prompt 1' },  // Matches "Prompt 1"
        { prompt: 'Prompt 2' },
        { prompt: 'Prompt 3' },
        { prompt: 'Prompt 4' },
        { prompt: 'Prompt 5' },
        { prompt: 'Prompt 6' },
        { prompt: 'Prompt 7' },
        { prompt: 'Prompt 8' },
        { prompt: 'Prompt 9' },
        { prompt: 'Prompt 10' },
      ])

      // 5. Create generation job with remaining 13 prompts
      mockSql.mockResolvedValueOnce([{
        id: 1,
        avatar_id: 1,
        style_id: 'pinglass',
        status: 'pending',
        total_photos: 13,
      }])

      mockPublishGenerationJob.mockResolvedValueOnce({ messageId: 'qstash-msg-123' })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      // 23 total prompts - 10 used = 13 available
      expect(data.totalPhotos).toBe(13)
    })

    test('GEN-PROMPT-002: should fail if all prompts already used', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      // 1. Check successful payment
      mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])

      // 2. Check existing avatar
      mockSql.mockResolvedValueOnce([{ id: 1 }])

      // 3. Insert reference images (5 images)
      for (let i = 0; i < 5; i++) {
        mockSql.mockResolvedValueOnce([])
      }

      // 4. All 23 prompts already used (must match exactly)
      mockSql.mockResolvedValueOnce(
        Array.from({ length: 23 }, (_, i) => ({ prompt: `Prompt ${i + 1}` }))
      )

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe('NO_PROMPTS_AVAILABLE')
    })
  })

  // --------------------------------------------------------------------------
  // AVATAR CREATION TESTS
  // --------------------------------------------------------------------------

  describe('Avatar Creation', () => {
    test('GEN-AVA-001: should create new avatar if frontend ID is timestamp', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      // 1. Check successful payment
      mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])

      // 2. For timestamp overflow (> 2147483647), isValidDbId = false
      //    so no SELECT is called, goes straight to INSERT

      // 3. Create new avatar directly
      mockSql.mockResolvedValueOnce([{ id: 1 }])

      // 4. Insert reference images (5 images)
      for (let i = 0; i < 5; i++) {
        mockSql.mockResolvedValueOnce([])
      }

      // 5. Get used prompts
      mockSql.mockResolvedValueOnce([])

      // 6. Create generation job
      mockSql.mockResolvedValueOnce([{
        id: 1,
        avatar_id: 1,
        style_id: 'pinglass',
        status: 'pending',
        total_photos: 23,
      }])

      mockPublishGenerationJob.mockResolvedValueOnce({ messageId: 'qstash-msg-123' })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1703654321000', // Timestamp overflow > 2147483647
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.avatarId).toBe(1) // New DB avatar ID
    })

    test('GEN-AVA-002: should use existing avatar if valid DB ID', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      setupSuccessfulGenerationMocks(testUser, {
        existingAvatarId: 42,
        referenceImageCount: 5,
      })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '42',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.avatarId).toBe(42)
    })

    test('GEN-AVA-003: should create new avatar when valid DB ID not found', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      // 1. Check successful payment
      mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])

      // 2. Avatar not found with valid DB ID (within INTEGER range)
      mockSql.mockResolvedValueOnce([])

      // 3. Create new avatar
      mockSql.mockResolvedValueOnce([{ id: 999 }])

      // 4. Insert reference images (5 images)
      for (let i = 0; i < 5; i++) {
        mockSql.mockResolvedValueOnce([])
      }

      // 5. Get used prompts
      mockSql.mockResolvedValueOnce([])

      // 6. Create generation job
      mockSql.mockResolvedValueOnce([{
        id: 1,
        avatar_id: 999,
        style_id: 'pinglass',
        status: 'pending',
        total_photos: 23,
      }])

      mockPublishGenerationJob.mockResolvedValueOnce({ messageId: 'qstash-msg-999' })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '42', // Valid DB ID but doesn't exist for user
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.avatarId).toBe(999) // New avatar created
      expect(data.success).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // QSTASH NOT CONFIGURED TESTS
  // --------------------------------------------------------------------------

  describe('QStash Not Configured', () => {
    test('GEN-QS-003: should refund and fail when QStash unavailable', async () => {
      const originalHasQStash = jest.requireMock('@/lib/qstash').HAS_QSTASH
      jest.requireMock('@/lib/qstash').HAS_QSTASH = false

      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      for (let i = 0; i < 5; i++) {
        mockSql.mockResolvedValueOnce([])
      }
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([{ id: 1, status: 'pending', total_photos: 23 }])
      mockSql.mockResolvedValueOnce([])
      mockAutoRefundForFailedGeneration.mockResolvedValueOnce({
        success: true,
        refundedPaymentId: 'pay-refund-456',
      })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe('SERVICE_UNAVAILABLE')
      expect(data.refunded).toBe(true)
      expect(mockAutoRefundForFailedGeneration).toHaveBeenCalled()

      jest.requireMock('@/lib/qstash').HAS_QSTASH = originalHasQStash
    })
  })

  // --------------------------------------------------------------------------
  // REFERENCE IMAGE VALIDATION EDGE CASES
  // --------------------------------------------------------------------------

  describe('Reference Image Validation Edge Cases', () => {
    test('GEN-REF-004: should fail when all reference images rejected', async () => {
      const originalFilterAndSort = jest.requireMock('@/lib/image-utils').filterAndSortReferenceImages

      jest.requireMock('@/lib/image-utils').filterAndSortReferenceImages = () => ({
        selected: [],
        rejected: ['image1: too small', 'image2: invalid format'],
      })

      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])
      mockSql.mockResolvedValueOnce([{ id: 1 }])

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe('NO_REFERENCE_IMAGES')
      expect(data.rejectedImages).toBeDefined()

      jest.requireMock('@/lib/image-utils').filterAndSortReferenceImages = originalFilterAndSort
    })

    test('GEN-REF-005: should handle partial reference save failures', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([{ id: 1, amount: 99900, status: 'succeeded' }])
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockSql.mockRejectedValueOnce(new Error('DB constraint violation'))
      mockSql.mockRejectedValueOnce(new Error('DB timeout'))
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([{
        id: 1,
        avatar_id: 1,
        style_id: 'pinglass',
        status: 'pending',
        total_photos: 23,
      }])

      mockPublishGenerationJob.mockResolvedValueOnce({ messageId: 'qstash-msg-789' })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.jobId).toBeDefined()
    })
  })

  // --------------------------------------------------------------------------
  // STYLE AND COUNT VALIDATION TESTS
  // --------------------------------------------------------------------------

  describe('Style and Count Edge Cases', () => {
    test('GEN-STYLE-002: should reject empty style', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: '',
        referenceImages: createTestReferenceImages(5),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
    })

    test('GEN-COUNT-001: should handle photoCount=0 as max photos', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      setupSuccessfulGenerationMocks(testUser, {
        referenceImageCount: 5,
        totalPhotos: 23,
      })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
        photoCount: 0,
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.totalPhotos).toBe(23)
    })

    test('GEN-COUNT-002: should handle negative photoCount as max photos', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      setupSuccessfulGenerationMocks(testUser, {
        referenceImageCount: 5,
        totalPhotos: 23,
      })

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: createTestReferenceImages(5),
        photoCount: -5,
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.totalPhotos).toBe(23)
    })
  })

  // --------------------------------------------------------------------------
  // ARRAY AND TYPE VALIDATION TESTS
  // --------------------------------------------------------------------------

  describe('Array and Type Validation', () => {
    test('GEN-ARR-001: should reject non-array referenceImages', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: 'not-an-array' as any,
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe('NO_REFERENCE_IMAGES')
    })

    test('GEN-ARR-002: should reject empty referenceImages array', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      const request = createGenerateRequest({
        telegramUserId: testUser.telegram_user_id,
        avatarId: '1',
        styleId: 'pinglass',
        referenceImages: [],
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe('NO_REFERENCE_IMAGES')
    })

    test('GEN-TG-001: should handle telegramUserId as string number', async () => {
      const { POST } = await import('@/app/api/generate/route')
      const testUser = createProUser()

      setupSuccessfulGenerationMocks(testUser)

      const request = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-user-id': '123456789',
        },
        body: JSON.stringify({
          telegramUserId: '123456789',
          avatarId: '1',
          styleId: 'pinglass',
          referenceImages: createTestReferenceImages(5),
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })
})

// ============================================================================
// GET /api/generate TESTS
// ============================================================================

describe('GET /api/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetIdCounters()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // VALIDATION TESTS
  // --------------------------------------------------------------------------

  describe('Validation', () => {
    test('GEN-GET-001: should require job_id or avatar_id', async () => {
      const { GET } = await import('@/app/api/generate/route')

      const request = createStatusRequest({})

      const response = await GET(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    test('GEN-GET-002: should require authentication', async () => {
      const { GET } = await import('@/app/api/generate/route')

      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: null })

      const request = createStatusRequest({ jobId: '1' })

      const response = await GET(request)
      expect(response.status).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('UNAUTHORIZED')
    })

    test('GEN-GET-003: should reject invalid job_id format', async () => {
      const { GET } = await import('@/app/api/generate/route')

      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })

      const request = createStatusRequest({ jobId: 'invalid' })

      const response = await GET(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('VALIDATION_ERROR')
    })
  })

  // --------------------------------------------------------------------------
  // OWNERSHIP VERIFICATION TESTS
  // --------------------------------------------------------------------------

  describe('Ownership Verification', () => {
    test('GEN-OWN-001: should verify job ownership', async () => {
      const { GET } = await import('@/app/api/generate/route')

      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })

      mockVerifyResourceOwnershipWithIdentifier.mockResolvedValueOnce({
        resourceExists: true,
        authorized: true,
        userId: 1,
      })

      mockSql.mockResolvedValueOnce([{
        id: 1,
        avatar_id: 1,
        style_id: 'pinglass',
        status: 'processing',
        completed_photos: 5,
        total_photos: 23,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])

      // Get photos
      mockSql.mockResolvedValueOnce([])

      const request = createStatusRequest({ jobId: '1' })

      const response = await GET(request)
      expect(response.status).toBe(200)

      expect(mockVerifyResourceOwnershipWithIdentifier).toHaveBeenCalledWith(
        { telegramUserId: 123456789 },
        'job',
        1
      )
    })

    test('GEN-OWN-002: should deny access to non-existent job', async () => {
      const { GET } = await import('@/app/api/generate/route')

      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })

      mockVerifyResourceOwnershipWithIdentifier.mockResolvedValueOnce({
        resourceExists: false,
        authorized: false,
      })

      const request = createStatusRequest({ jobId: '999' })

      const response = await GET(request)
      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('NOT_FOUND')
    })

    test('GEN-OWN-003: should deny access to another user job (IDOR)', async () => {
      const { GET } = await import('@/app/api/generate/route')

      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })

      mockVerifyResourceOwnershipWithIdentifier.mockResolvedValueOnce({
        resourceExists: true,
        authorized: false,
      })

      const request = createStatusRequest({ jobId: '1' })

      const response = await GET(request)
      expect(response.status).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('FORBIDDEN')
    })

    test('GEN-OWN-004: should verify avatar ownership when using avatar_id', async () => {
      const { GET } = await import('@/app/api/generate/route')

      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })

      mockVerifyResourceOwnershipWithIdentifier.mockResolvedValueOnce({
        resourceExists: true,
        authorized: true,
        userId: 1,
      })

      // Get latest job for avatar
      mockSql.mockResolvedValueOnce([{
        id: 1,
        avatar_id: 1,
        style_id: 'pinglass',
        status: 'completed',
        completed_photos: 23,
        total_photos: 23,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])

      // Get photos
      mockSql.mockResolvedValueOnce([
        { image_url: 'https://cdn.pinglass.ru/photo1.jpg' },
        { image_url: 'https://cdn.pinglass.ru/photo2.jpg' },
      ])

      const request = createStatusRequest({ avatarId: '1' })

      const response = await GET(request)
      expect(response.status).toBe(200)

      expect(mockVerifyResourceOwnershipWithIdentifier).toHaveBeenCalledWith(
        { telegramUserId: 123456789 },
        'avatar',
        1
      )
    })
  })

  // --------------------------------------------------------------------------
  // STATUS RESPONSE TESTS
  // --------------------------------------------------------------------------

  describe('Status Response', () => {
    test('GEN-STATUS-001: should return job status with progress', async () => {
      const { GET } = await import('@/app/api/generate/route')

      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })

      mockVerifyResourceOwnershipWithIdentifier.mockResolvedValueOnce({
        resourceExists: true,
        authorized: true,
      })

      mockSql.mockResolvedValueOnce([{
        id: 1,
        avatar_id: 1,
        style_id: 'pinglass',
        status: 'processing',
        completed_photos: 10,
        total_photos: 23,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])

      mockSql.mockResolvedValueOnce([
        { image_url: 'https://cdn.pinglass.ru/photo1.jpg' },
      ])

      const request = createStatusRequest({ jobId: '1' })

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.status).toBe('processing')
      expect(data.progress.completed).toBe(10)
      expect(data.progress.total).toBe(23)
      expect(data.progress.percentage).toBe(43)
      expect(data.photos).toHaveLength(1)
    })

    test('GEN-STATUS-002: should return error message for failed job', async () => {
      const { GET } = await import('@/app/api/generate/route')

      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })

      mockVerifyResourceOwnershipWithIdentifier.mockResolvedValueOnce({
        resourceExists: true,
        authorized: true,
      })

      mockSql.mockResolvedValueOnce([{
        id: 1,
        avatar_id: 1,
        style_id: 'pinglass',
        status: 'failed',
        completed_photos: 5,
        total_photos: 23,
        error_message: '18/23 photos failed - payment refunded',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])

      mockSql.mockResolvedValueOnce([])

      const request = createStatusRequest({ jobId: '1' })

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.status).toBe('failed')
      expect(data.error).toContain('payment refunded')
    })

    test('GEN-STATUS-003: should return 404 if no job found for avatar', async () => {
      const { GET } = await import('@/app/api/generate/route')

      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })

      mockVerifyResourceOwnershipWithIdentifier.mockResolvedValueOnce({
        resourceExists: true,
        authorized: true,
      })

      // No job found
      mockSql.mockResolvedValueOnce([])

      const request = createStatusRequest({ avatarId: '1' })

      const response = await GET(request)
      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('NOT_FOUND')
    })
  })
})
