/**
 * QStash Mock for Testing
 *
 * Provides mock implementations of Upstash QStash async job queue.
 * Use these mocks in unit and integration tests to avoid real API calls.
 */

import { jest } from "@jest/globals"

// ============================================================================
// INTERFACES (mirrored from lib/qstash.ts)
// ============================================================================

export interface GenerationJobPayload {
  jobId: number
  avatarId: number
  telegramUserId: number
  styleId: string
  photoCount: number
  referenceImages: string[] // base64 encoded
  startIndex: number // For chunked processing
  chunkSize: number
  prompts?: string[] // Explicit prompts to use (avoids duplicates)
}

export interface JobResult {
  success: boolean
  jobId: number
  photosGenerated: number
  errors: string[]
}

// ============================================================================
// CONSTANTS (mirrored from lib/qstash.ts)
// ============================================================================

export const GENERATION_CONFIG = {
  CHUNK_SIZE: 3,
  CHUNK_DELAY_MS: 500,
  MAX_CONCURRENT: 3,
  TASK_CREATION_DELAY_MS: 200,
}

// ============================================================================
// MOCK STATE
// ============================================================================

let mockQStashConfigured = true
let publishedJobs: GenerationJobPayload[] = []

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

export const mockPublishGenerationJob = jest.fn<
  (payload: GenerationJobPayload, baseUrl: string) => Promise<{ messageId: string } | null>
>()

export const mockVerifyQStashSignature = jest.fn<
  (signature: string | null, body: string) => Promise<{ valid: boolean; body?: unknown }>
>()

export const mockQstashClient = {
  publishJSON: jest.fn(),
}

export const mockQstashReceiver = {
  verify: jest.fn(),
}

// ============================================================================
// DEFAULT MOCK RESPONSES
// ============================================================================

/**
 * Reset all mocks to default successful behavior
 */
export function resetQStashMocks() {
  mockQStashConfigured = true
  publishedJobs = []

  mockPublishGenerationJob.mockImplementation(async (payload, _baseUrl) => {
    if (!mockQStashConfigured) {
      return null
    }
    publishedJobs.push(payload)
    return { messageId: `msg-${Date.now()}-${payload.jobId}` }
  })

  mockVerifyQStashSignature.mockResolvedValue({ valid: true, body: {} })

  mockQstashClient.publishJSON.mockResolvedValue({
    messageId: `msg-${Date.now()}`,
  })

  mockQstashReceiver.verify.mockResolvedValue(true)
}

// Initialize with defaults
resetQStashMocks()

// ============================================================================
// EXPORTED MOCK FUNCTIONS (matching lib/qstash.ts exports)
// ============================================================================

export const publishGenerationJob = mockPublishGenerationJob
export const verifyQStashSignature = mockVerifyQStashSignature
export const qstashClient = mockQstashClient
export const qstashReceiver = mockQstashReceiver

// Export HAS_QSTASH as getter for dynamic control
export const HAS_QSTASH = true

// ============================================================================
// MOCK HELPERS FOR TESTS
// ============================================================================

/**
 * Configure mock to simulate QStash not configured
 */
export function mockQStashNotConfigured() {
  mockQStashConfigured = false
  mockPublishGenerationJob.mockResolvedValue(null)
}

/**
 * Configure mock to simulate QStash configured
 */
export function mockQStashConfiguredSuccess() {
  mockQStashConfigured = true
  resetQStashMocks()
}

/**
 * Configure mock to simulate publish failure
 */
export function mockQStashPublishFailed(error = "Failed to publish job") {
  mockPublishGenerationJob.mockRejectedValue(new Error(error))
  mockQstashClient.publishJSON.mockRejectedValue(new Error(error))
}

/**
 * Configure mock to simulate invalid signature
 */
export function mockQStashInvalidSignature() {
  mockVerifyQStashSignature.mockResolvedValue({ valid: false })
  mockQstashReceiver.verify.mockRejectedValue(new Error("Invalid signature"))
}

/**
 * Configure mock to simulate valid signature with body
 */
export function mockQStashValidSignature(body: unknown) {
  mockVerifyQStashSignature.mockResolvedValue({ valid: true, body })
  mockQstashReceiver.verify.mockResolvedValue(true)
}

/**
 * Configure mock to simulate network error
 */
export function mockQStashNetworkError() {
  const networkError = new Error("Network error: QStash unreachable")
  mockPublishGenerationJob.mockRejectedValue(networkError)
  mockQstashClient.publishJSON.mockRejectedValue(networkError)
}

/**
 * Configure mock to simulate timeout
 */
export function mockQStashTimeout() {
  const timeoutError = new Error("Request timeout after 30s")
  mockPublishGenerationJob.mockRejectedValue(timeoutError)
  mockQstashClient.publishJSON.mockRejectedValue(timeoutError)
}

/**
 * Get all published jobs (for assertions)
 */
export function getPublishedJobs(): GenerationJobPayload[] {
  return [...publishedJobs]
}

/**
 * Get last published job (for assertions)
 */
export function getLastPublishedJob(): GenerationJobPayload | undefined {
  return publishedJobs[publishedJobs.length - 1]
}

/**
 * Clear published jobs history
 */
export function clearPublishedJobs() {
  publishedJobs = []
}

/**
 * Configure mock to simulate rate limiting
 */
export function mockQStashRateLimited() {
  mockPublishGenerationJob.mockRejectedValue(new Error("Rate limit exceeded"))
  mockQstashClient.publishJSON.mockRejectedValue(new Error("Rate limit exceeded"))
}

/**
 * Configure mock to simulate specific messageId
 */
export function mockQStashWithMessageId(messageId: string) {
  mockPublishGenerationJob.mockImplementation(async (payload) => {
    publishedJobs.push(payload)
    return { messageId }
  })
  mockQstashClient.publishJSON.mockResolvedValue({ messageId })
}

/**
 * Configure mock to simulate deduplication (same job returns same messageId)
 */
export function mockQStashDeduplication() {
  const messageIdMap = new Map<string, string>()

  mockPublishGenerationJob.mockImplementation(async (payload, _baseUrl) => {
    const dedupKey = `gen-${payload.jobId}-${payload.startIndex}`
    let messageId = messageIdMap.get(dedupKey)

    if (!messageId) {
      messageId = `msg-${Date.now()}-${payload.jobId}`
      messageIdMap.set(dedupKey, messageId)
      publishedJobs.push(payload)
    }

    return { messageId }
  })
}

/**
 * Configure mock to track retries
 */
export function mockQStashWithRetries(maxRetries = 3) {
  let retryCount = 0

  mockPublishGenerationJob.mockImplementation(async (payload) => {
    retryCount++
    if (retryCount < maxRetries) {
      throw new Error(`Temporary failure, retry ${retryCount}/${maxRetries}`)
    }
    publishedJobs.push(payload)
    return { messageId: `msg-${Date.now()}-${payload.jobId}` }
  })

  return () => retryCount // Return getter for assertions
}

/**
 * Simulate QStash callback (for integration tests)
 */
export function simulateQStashCallback(payload: GenerationJobPayload): JobResult {
  return {
    success: true,
    jobId: payload.jobId,
    photosGenerated: payload.photoCount,
    errors: [],
  }
}

/**
 * Simulate QStash failure callback
 */
export function simulateQStashFailureCallback(
  payload: GenerationJobPayload,
  error: string
): JobResult {
  return {
    success: false,
    jobId: payload.jobId,
    photosGenerated: 0,
    errors: [error],
  }
}
