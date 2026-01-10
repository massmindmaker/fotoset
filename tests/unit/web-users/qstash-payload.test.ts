/**
 * Unit tests for QStash payload with web user support
 * Tests GenerationJobPayload structure and validation
 */

import type { GenerationJobPayload } from '@/lib/qstash'

describe('GenerationJobPayload', () => {
  describe('Type structure', () => {
    it('should allow payload with telegramUserId only', () => {
      const payload: GenerationJobPayload = {
        jobId: 1,
        avatarId: 100,
        telegramUserId: 12345,
        styleId: 'professional',
        photoCount: 23,
        referenceImages: ['base64image1', 'base64image2'],
        startIndex: 0,
        chunkSize: 5,
      }

      expect(payload.telegramUserId).toBe(12345)
      expect(payload.neonUserId).toBeUndefined()
    })

    it('should allow payload with neonUserId only', () => {
      const payload: GenerationJobPayload = {
        jobId: 2,
        avatarId: 101,
        neonUserId: 'neon_user_abc123',
        styleId: 'lifestyle',
        photoCount: 23,
        referenceImages: ['base64image1'],
        startIndex: 0,
        chunkSize: 5,
      }

      expect(payload.neonUserId).toBe('neon_user_abc123')
      expect(payload.telegramUserId).toBeUndefined()
    })

    it('should allow payload with both IDs', () => {
      const payload: GenerationJobPayload = {
        jobId: 3,
        avatarId: 102,
        telegramUserId: 12345,
        neonUserId: 'neon_user_abc123',
        styleId: 'creative',
        photoCount: 23,
        referenceImages: [],
        startIndex: 0,
        chunkSize: 5,
      }

      expect(payload.telegramUserId).toBe(12345)
      expect(payload.neonUserId).toBe('neon_user_abc123')
    })

    it('should allow payload with neither ID (edge case)', () => {
      const payload: GenerationJobPayload = {
        jobId: 4,
        avatarId: 103,
        styleId: 'professional',
        photoCount: 23,
        referenceImages: [],
        startIndex: 0,
        chunkSize: 5,
      }

      expect(payload.telegramUserId).toBeUndefined()
      expect(payload.neonUserId).toBeUndefined()
    })

    it('should include optional prompts array', () => {
      const payload: GenerationJobPayload = {
        jobId: 5,
        avatarId: 104,
        telegramUserId: 12345,
        styleId: 'professional',
        photoCount: 23,
        referenceImages: [],
        startIndex: 0,
        chunkSize: 5,
        prompts: ['prompt1', 'prompt2', 'prompt3'],
      }

      expect(payload.prompts).toHaveLength(3)
    })
  })

  describe('Payload serialization', () => {
    it('should serialize to JSON correctly', () => {
      const payload: GenerationJobPayload = {
        jobId: 10,
        avatarId: 200,
        telegramUserId: 99999,
        styleId: 'lifestyle',
        photoCount: 15,
        referenceImages: ['img1', 'img2'],
        startIndex: 5,
        chunkSize: 5,
      }

      const json = JSON.stringify(payload)
      const parsed = JSON.parse(json)

      expect(parsed.jobId).toBe(10)
      expect(parsed.avatarId).toBe(200)
      expect(parsed.telegramUserId).toBe(99999)
      expect(parsed.styleId).toBe('lifestyle')
    })

    it('should omit undefined optional fields in JSON', () => {
      const payload: GenerationJobPayload = {
        jobId: 11,
        avatarId: 201,
        neonUserId: 'web_user_1',
        styleId: 'creative',
        photoCount: 7,
        referenceImages: [],
        startIndex: 0,
        chunkSize: 5,
      }

      const json = JSON.stringify(payload)
      const parsed = JSON.parse(json)

      expect('telegramUserId' in parsed).toBe(false)
      expect(parsed.neonUserId).toBe('web_user_1')
    })
  })

  describe('Web user specific scenarios', () => {
    it('should support typical web user payload', () => {
      // Web users don't have telegramUserId
      const webUserPayload: GenerationJobPayload = {
        jobId: 100,
        avatarId: 500,
        neonUserId: 'neon_session_xyz789',
        styleId: 'professional',
        photoCount: 23,
        referenceImages: [
          'base64_photo_1',
          'base64_photo_2',
          'base64_photo_3',
          'base64_photo_4',
          'base64_photo_5',
        ],
        startIndex: 0,
        chunkSize: 5,
        prompts: [
          'Professional headshot with neutral background',
          'Business portrait in modern office',
          'LinkedIn profile photo with confidence',
        ],
      }

      expect(webUserPayload.telegramUserId).toBeUndefined()
      expect(webUserPayload.neonUserId).toBeDefined()
      expect(webUserPayload.referenceImages.length).toBeGreaterThanOrEqual(5)
    })

    it('should support Telegram user payload (backwards compatibility)', () => {
      // Telegram users should still work as before
      const telegramUserPayload: GenerationJobPayload = {
        jobId: 101,
        avatarId: 501,
        telegramUserId: 1234567890,
        styleId: 'lifestyle',
        photoCount: 23,
        referenceImages: ['base64_1', 'base64_2'],
        startIndex: 0,
        chunkSize: 5,
      }

      expect(telegramUserPayload.telegramUserId).toBe(1234567890)
      expect(telegramUserPayload.neonUserId).toBeUndefined()
    })
  })

  describe('Chunk processing', () => {
    it('should calculate correct chunk boundaries', () => {
      const totalPhotos = 23
      const chunkSize = 5

      // First chunk: 0-4 (5 photos)
      const chunk1: GenerationJobPayload = {
        jobId: 1,
        avatarId: 1,
        styleId: 'pro',
        photoCount: totalPhotos,
        referenceImages: [],
        startIndex: 0,
        chunkSize,
      }
      expect(chunk1.startIndex + chunk1.chunkSize).toBe(5)

      // Second chunk: 5-9 (5 photos)
      const chunk2: GenerationJobPayload = {
        ...chunk1,
        startIndex: 5,
      }
      expect(chunk2.startIndex).toBe(5)

      // Last chunk: 20-22 (3 photos)
      const lastChunk: GenerationJobPayload = {
        ...chunk1,
        startIndex: 20,
      }
      const remaining = totalPhotos - lastChunk.startIndex
      expect(remaining).toBe(3)
    })
  })
})

describe('User identification priority', () => {
  it('should document expected priority when both IDs present', () => {
    // When both telegramUserId and neonUserId are present,
    // telegramUserId should take priority (documented behavior)
    const payload: GenerationJobPayload = {
      jobId: 1,
      avatarId: 1,
      telegramUserId: 12345,
      neonUserId: 'web_user',
      styleId: 'pro',
      photoCount: 23,
      referenceImages: [],
      startIndex: 0,
      chunkSize: 5,
    }

    // This tests the expected behavior, not runtime implementation
    // The actual priority is enforced in the API route
    expect(payload.telegramUserId).toBeDefined()
    expect(payload.neonUserId).toBeDefined()
  })
})
