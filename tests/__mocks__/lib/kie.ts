/**
 * Kie.ai Mock for Testing
 *
 * Provides mock implementations of Kie.ai AI generation service.
 * Use these mocks in unit and integration tests to avoid real API calls.
 */

import { jest } from "@jest/globals"

// ============================================================================
// INTERFACES (mirrored from lib/kie.ts)
// ============================================================================

export interface KieGenerationOptions {
  prompt: string
  referenceImages?: string[]
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9"
  resolution?: "1K" | "2K" | "4K"
  outputFormat?: "png" | "jpg"
  seed?: number
}

export interface KieGenerationResult {
  url: string
  success: boolean
  error?: string
  latencyMs: number
  taskId?: string
}

export interface KieTaskCreationResult {
  success: boolean
  taskId?: string
  error?: string
}

export interface KieTaskStatusResult {
  status: "pending" | "processing" | "completed" | "failed"
  url?: string
  error?: string
}

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

export const mockIsKieConfigured = jest.fn<() => boolean>()
export const mockGenerateWithKie = jest.fn<(options: KieGenerationOptions) => Promise<KieGenerationResult>>()
export const mockCreateKieTask = jest.fn<(options: KieGenerationOptions) => Promise<KieTaskCreationResult>>()
export const mockCheckKieTaskStatus = jest.fn<(taskId: string) => Promise<KieTaskStatusResult>>()
export const mockTestKieConnection = jest.fn<() => Promise<boolean>>()

// ============================================================================
// DEFAULT MOCK RESPONSES
// ============================================================================

const DEFAULT_IMAGE_URL = "https://kie.ai/mock-generated-image.jpg"
const DEFAULT_TASK_ID = "mock-task-123456"

/**
 * Reset all mocks to default successful behavior
 */
export function resetKieMocks() {
  mockIsKieConfigured.mockReturnValue(true)

  mockGenerateWithKie.mockResolvedValue({
    url: DEFAULT_IMAGE_URL,
    success: true,
    latencyMs: 1500,
    taskId: DEFAULT_TASK_ID,
  })

  mockCreateKieTask.mockResolvedValue({
    success: true,
    taskId: DEFAULT_TASK_ID,
  })

  mockCheckKieTaskStatus.mockResolvedValue({
    status: "completed",
    url: DEFAULT_IMAGE_URL,
  })

  mockTestKieConnection.mockResolvedValue(true)
}

// Initialize with defaults
resetKieMocks()

// ============================================================================
// EXPORTED MOCK FUNCTIONS (matching lib/kie.ts exports)
// ============================================================================

export const isKieConfigured = mockIsKieConfigured
export const generateWithKie = mockGenerateWithKie
export const createKieTask = mockCreateKieTask
export const checkKieTaskStatus = mockCheckKieTaskStatus
export const testKieConnection = mockTestKieConnection

// ============================================================================
// MOCK HELPERS FOR TESTS
// ============================================================================

/**
 * Configure mock to simulate Kie.ai not configured
 */
export function mockKieNotConfigured() {
  mockIsKieConfigured.mockReturnValue(false)
  mockGenerateWithKie.mockRejectedValue(new Error("Kie.ai API key not configured"))
  mockCreateKieTask.mockRejectedValue(new Error("Kie.ai API key not configured"))
}

/**
 * Configure mock to simulate task creation failure
 */
export function mockKieTaskCreationFailed(error = "Task creation failed") {
  mockCreateKieTask.mockResolvedValue({
    success: false,
    error,
  })
}

/**
 * Configure mock to simulate generation failure
 */
export function mockKieGenerationFailed(error = "Image generation failed") {
  mockGenerateWithKie.mockResolvedValue({
    url: "",
    success: false,
    error,
    latencyMs: 500,
  })
}

/**
 * Configure mock to simulate task processing (not yet complete)
 */
export function mockKieTaskProcessing() {
  mockCheckKieTaskStatus.mockResolvedValue({
    status: "processing",
  })
}

/**
 * Configure mock to simulate task pending
 */
export function mockKieTaskPending() {
  mockCheckKieTaskStatus.mockResolvedValue({
    status: "pending",
  })
}

/**
 * Configure mock to simulate task failure
 */
export function mockKieTaskFailed(error = "Task failed") {
  mockCheckKieTaskStatus.mockResolvedValue({
    status: "failed",
    error,
  })
}

/**
 * Configure mock to simulate successful generation with custom URL
 */
export function mockKieSuccess(imageUrl: string = DEFAULT_IMAGE_URL) {
  mockGenerateWithKie.mockResolvedValue({
    url: imageUrl,
    success: true,
    latencyMs: 1500,
    taskId: DEFAULT_TASK_ID,
  })

  mockCheckKieTaskStatus.mockResolvedValue({
    status: "completed",
    url: imageUrl,
  })
}

/**
 * Configure mock to simulate network error
 */
export function mockKieNetworkError() {
  const networkError = new Error("Network error: fetch failed")
  mockGenerateWithKie.mockRejectedValue(networkError)
  mockCreateKieTask.mockRejectedValue(networkError)
  mockCheckKieTaskStatus.mockRejectedValue(networkError)
}

/**
 * Configure mock to simulate timeout
 */
export function mockKieTimeout() {
  const timeoutError = new Error("Request timeout after 30s")
  mockGenerateWithKie.mockRejectedValue(timeoutError)
  mockCreateKieTask.mockRejectedValue(timeoutError)
  mockCheckKieTaskStatus.mockRejectedValue(timeoutError)
}

/**
 * Configure mock to return multiple images (batch generation)
 */
export function mockKieBatchGeneration(count: number) {
  const results: KieGenerationResult[] = []
  for (let i = 0; i < count; i++) {
    results.push({
      url: `https://kie.ai/mock-image-${i + 1}.jpg`,
      success: true,
      latencyMs: 1500 + i * 100,
      taskId: `mock-task-${i + 1}`,
    })
  }

  // Each call returns next result
  let callIndex = 0
  mockGenerateWithKie.mockImplementation(async () => {
    const result = results[callIndex] || results[results.length - 1]
    callIndex++
    return result
  })
}

/**
 * Configure mock to simulate rate limiting
 */
export function mockKieRateLimited() {
  mockGenerateWithKie.mockRejectedValue(new Error("Rate limit exceeded. Retry after 60s"))
  mockCreateKieTask.mockRejectedValue(new Error("Rate limit exceeded. Retry after 60s"))
}

/**
 * Configure mock to simulate partial batch failure (some images fail)
 */
export function mockKiePartialBatchFailure(totalCount: number, failCount: number) {
  let callIndex = 0
  mockGenerateWithKie.mockImplementation(async () => {
    callIndex++
    if (callIndex <= failCount) {
      return {
        url: "",
        success: false,
        error: `Failed at index ${callIndex}`,
        latencyMs: 500,
      }
    }
    return {
      url: `https://kie.ai/mock-image-${callIndex}.jpg`,
      success: true,
      latencyMs: 1500,
      taskId: `mock-task-${callIndex}`,
    }
  })
}

// ============================================================================
// CONSTANTS (matching lib/kie.ts)
// ============================================================================

export const KIE_API_URL = "https://api.kie.ai/v1/generate"
export const KIE_STATUS_URL = "https://api.kie.ai/v1/task"
