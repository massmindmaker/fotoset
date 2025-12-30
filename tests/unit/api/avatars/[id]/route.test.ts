/**
 * Unit Tests for /api/avatars/[id] Route
 *
 * Tests cover:
 * - GET: Get single avatar with photos and generation job
 * - PATCH: Update avatar (name, status, thumbnailUrl)
 * - DELETE: Delete avatar with cascade
 * - IDOR Protection: Authorization checks for all methods
 */

import { NextRequest } from "next/server"

// ============================================================================
// MOCKS (before imports)
// ============================================================================

// Mock db
const mockSql = jest.fn()
jest.mock("@/lib/db", () => ({
  sql: (...args: any[]) => mockSql(...args),
}))

// Mock auth-utils
const mockGetUserIdentifier = jest.fn()
jest.mock("@/lib/auth-utils", () => ({
  getUserIdentifier: (req: any, body?: any) => mockGetUserIdentifier(req, body),
}))

// Mock api-utils
jest.mock("@/lib/api-utils", () => ({
  success: (data: any) => ({
    status: 200,
    json: async () => ({ success: true, data }),
  }),
  error: (code: string, message: string) => {
    const statusMap: Record<string, number> = {
      UNAUTHORIZED: 401,
      VALIDATION_ERROR: 400,
      AVATAR_NOT_FOUND: 404,
      FORBIDDEN: 403,
      DATABASE_ERROR: 500,
    }
    return {
      status: statusMap[code] || 400,
      json: async () => ({ success: false, error: { code, message } }),
    }
  },
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}))

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { GET, PATCH, DELETE } from "@/app/api/avatars/[id]/route"
import { createUser, createAvatar } from "@/tests/fixtures/factory"

// ============================================================================
// TYPES
// ============================================================================

type RouteParams = { params: Promise<{ id: string }> }

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(
  url: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
  } = {}
): NextRequest {
  const { method = "GET", body, headers = {} } = options
  const fullUrl = `http://localhost:3000${url}`

  const requestInit: RequestInit = {
    method,
    headers: new Headers(headers),
  }

  if (body) {
    requestInit.body = JSON.stringify(body)
  }

  return new NextRequest(fullUrl, requestInit)
}

function createParams(id: string | number): RouteParams {
  return { params: Promise.resolve({ id: String(id) }) }
}

// Setup mock for successful ownership verification
function setupOwnershipMock(
  avatar: ReturnType<typeof createAvatar>,
  ownerTelegramId: number,
  requestingTelegramId: number
) {
  // Mock getUserIdentifier
  mockGetUserIdentifier.mockReturnValueOnce({
    telegramUserId: requestingTelegramId,
  })

  // Mock verifyAvatarOwnershipWithData - avatar found with owner
  mockSql.mockResolvedValueOnce([{
    id: avatar.id,
    name: avatar.name,
    status: avatar.status,
    thumbnail_url: avatar.thumbnailUrl,
    created_at: avatar.createdAt,
    updated_at: avatar.updatedAt,
    owner_telegram_id: ownerTelegramId,
    user_id: 1,
  }])
}

// ============================================================================
// GET /api/avatars/[id] Tests
// ============================================================================

describe("GET /api/avatars/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 400 for invalid avatar ID (NaN)", async () => {
      const request = createRequest("/api/avatars/invalid?telegram_user_id=123")
      const params = createParams("invalid")

      const response = await GET(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })

    it("should return 400 for negative avatar ID", async () => {
      const request = createRequest("/api/avatars/-1?telegram_user_id=123")
      const params = createParams(-1)

      const response = await GET(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })

    it("should return 401 when telegram_user_id is missing", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: undefined })

      const request = createRequest("/api/avatars/1")
      const params = createParams(1)

      const response = await GET(request, params)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("IDOR Protection", () => {
    it("should return 404 when avatar not found", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })
      // No avatar found
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/avatars/999?telegram_user_id=123456789")
      const params = createParams(999)

      const response = await GET(request, params)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe("AVATAR_NOT_FOUND")
    })

    it("should return 403 when accessing another user's avatar", async () => {
      const avatar = createAvatar({ userId: 1 })
      const ownerTelegramId = 111111111
      const attackerTelegramId = 222222222

      setupOwnershipMock(avatar, ownerTelegramId, attackerTelegramId)

      const request = createRequest(`/api/avatars/${avatar.id}?telegram_user_id=${attackerTelegramId}`)
      const params = createParams(avatar.id)

      const response = await GET(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe("FORBIDDEN")
    })
  })

  describe("Success", () => {
    it("should return avatar with photos and generation job", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      // Photos query
      mockSql.mockResolvedValueOnce([
        {
          id: 1,
          style_id: "professional",
          prompt: "Business portrait",
          image_url: "https://example.com/photo1.jpg",
          created_at: new Date(),
        },
        {
          id: 2,
          style_id: "lifestyle",
          prompt: "Casual outdoor",
          image_url: "https://example.com/photo2.jpg",
          created_at: new Date(),
        },
      ])

      // Latest generation job
      mockSql.mockResolvedValueOnce([{
        id: 1,
        status: "completed",
        completed_photos: 23,
        total_photos: 23,
        error_message: null,
      }])

      const request = createRequest(`/api/avatars/${avatar.id}?telegram_user_id=${telegramUserId}`)
      const params = createParams(avatar.id)

      const response = await GET(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.id).toBe(avatar.id)
      expect(data.data.photos).toHaveLength(2)
      expect(data.data.generationJob).toBeDefined()
      expect(data.data.generationJob.status).toBe("completed")
    })

    it("should return avatar without generation job if none exists", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      // No photos
      mockSql.mockResolvedValueOnce([])
      // No generation job
      mockSql.mockResolvedValueOnce([])

      const request = createRequest(`/api/avatars/${avatar.id}?telegram_user_id=${telegramUserId}`)
      const params = createParams(avatar.id)

      const response = await GET(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.id).toBe(avatar.id)
      expect(data.data.photos).toEqual([])
      expect(data.data.generationJob).toBeUndefined()
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })
      mockSql.mockRejectedValueOnce(new Error("Connection lost"))

      const request = createRequest("/api/avatars/1?telegram_user_id=123456789")
      const params = createParams(1)

      const response = await GET(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe("DATABASE_ERROR")
    })
  })
})

// ============================================================================
// PATCH /api/avatars/[id] Tests
// ============================================================================

describe("PATCH /api/avatars/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 400 for invalid avatar ID", async () => {
      const request = createRequest("/api/avatars/invalid", {
        method: "PATCH",
        body: { name: "Updated" },
      })
      const params = createParams("invalid")

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })

    it("should return 401 when telegram_user_id is missing", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: undefined })

      const request = createRequest("/api/avatars/1", {
        method: "PATCH",
        body: { name: "Updated" },
      })
      const params = createParams(1)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe("UNAUTHORIZED")
    })

    it("should return 400 when no fields to update", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      const request = createRequest(`/api/avatars/${avatar.id}`, {
        method: "PATCH",
        body: { telegramUserId },
      })
      const params = createParams(avatar.id)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe("VALIDATION_ERROR")
      expect(data.error.message).toContain("No fields to update")
    })

    it("should return 400 for invalid status value", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      const request = createRequest(`/api/avatars/${avatar.id}`, {
        method: "PATCH",
        body: { telegramUserId, status: "invalid_status" },
      })
      const params = createParams(avatar.id)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })
  })

  describe("IDOR Protection", () => {
    it("should return 404 when avatar not found", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/avatars/999", {
        method: "PATCH",
        body: { telegramUserId: 123456789, name: "Updated" },
      })
      const params = createParams(999)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe("AVATAR_NOT_FOUND")
    })

    it("should return 403 when updating another user's avatar", async () => {
      const avatar = createAvatar({ userId: 1 })
      const ownerTelegramId = 111111111
      const attackerTelegramId = 222222222

      setupOwnershipMock(avatar, ownerTelegramId, attackerTelegramId)

      const request = createRequest(`/api/avatars/${avatar.id}`, {
        method: "PATCH",
        body: { telegramUserId: attackerTelegramId, name: "Hacked!" },
      })
      const params = createParams(avatar.id)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe("FORBIDDEN")
    })
  })

  describe("Update Operations", () => {
    it("should update name only", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      // Update result
      mockSql.mockResolvedValueOnce([{
        id: avatar.id,
        name: "New Name",
        status: avatar.status,
        thumbnail_url: avatar.thumbnailUrl,
        created_at: avatar.createdAt,
        updated_at: new Date(),
      }])

      const request = createRequest(`/api/avatars/${avatar.id}`, {
        method: "PATCH",
        body: { telegramUserId, name: "New Name" },
      })
      const params = createParams(avatar.id)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.name).toBe("New Name")
    })

    it("should update status only", async () => {
      const avatar = createAvatar({ userId: 1, status: "draft" })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      mockSql.mockResolvedValueOnce([{
        id: avatar.id,
        name: avatar.name,
        status: "ready",
        thumbnail_url: avatar.thumbnailUrl,
        created_at: avatar.createdAt,
        updated_at: new Date(),
      }])

      const request = createRequest(`/api/avatars/${avatar.id}`, {
        method: "PATCH",
        body: { telegramUserId, status: "ready" },
      })
      const params = createParams(avatar.id)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.status).toBe("ready")
    })

    it("should update thumbnailUrl only", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      mockSql.mockResolvedValueOnce([{
        id: avatar.id,
        name: avatar.name,
        status: avatar.status,
        thumbnail_url: "https://example.com/new-thumb.jpg",
        created_at: avatar.createdAt,
        updated_at: new Date(),
      }])

      const request = createRequest(`/api/avatars/${avatar.id}`, {
        method: "PATCH",
        body: { telegramUserId, thumbnailUrl: "https://example.com/new-thumb.jpg" },
      })
      const params = createParams(avatar.id)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.thumbnailUrl).toBe("https://example.com/new-thumb.jpg")
    })

    it("should update all fields together", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      mockSql.mockResolvedValueOnce([{
        id: avatar.id,
        name: "Complete Update",
        status: "processing",
        thumbnail_url: "https://example.com/full-update.jpg",
        created_at: avatar.createdAt,
        updated_at: new Date(),
      }])

      const request = createRequest(`/api/avatars/${avatar.id}`, {
        method: "PATCH",
        body: {
          telegramUserId,
          name: "Complete Update",
          status: "processing",
          thumbnailUrl: "https://example.com/full-update.jpg",
        },
      })
      const params = createParams(avatar.id)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.name).toBe("Complete Update")
      expect(data.data.status).toBe("processing")
      expect(data.data.thumbnailUrl).toBe("https://example.com/full-update.jpg")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error during update", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)
      mockSql.mockRejectedValueOnce(new Error("Update failed"))

      const request = createRequest(`/api/avatars/${avatar.id}`, {
        method: "PATCH",
        body: { telegramUserId, name: "New Name" },
      })
      const params = createParams(avatar.id)

      const response = await PATCH(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe("DATABASE_ERROR")
    })
  })
})

// ============================================================================
// DELETE /api/avatars/[id] Tests
// ============================================================================

describe("DELETE /api/avatars/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 400 for invalid avatar ID", async () => {
      const request = createRequest("/api/avatars/invalid", {
        method: "DELETE",
      })
      const params = createParams("invalid")

      const response = await DELETE(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })

    it("should return 401 when telegram_user_id is missing", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: undefined })

      const request = createRequest("/api/avatars/1?telegram_user_id=", {
        method: "DELETE",
      })
      const params = createParams(1)

      const response = await DELETE(request, params)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("IDOR Protection", () => {
    it("should return 404 when avatar not found", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({ telegramUserId: 123456789 })
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/avatars/999?telegram_user_id=123456789", {
        method: "DELETE",
      })
      const params = createParams(999)

      const response = await DELETE(request, params)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe("AVATAR_NOT_FOUND")
    })

    it("should return 403 when deleting another user's avatar", async () => {
      const avatar = createAvatar({ userId: 1 })
      const ownerTelegramId = 111111111
      const attackerTelegramId = 222222222

      setupOwnershipMock(avatar, ownerTelegramId, attackerTelegramId)

      const request = createRequest(`/api/avatars/${avatar.id}?telegram_user_id=${attackerTelegramId}`, {
        method: "DELETE",
      })
      const params = createParams(avatar.id)

      const response = await DELETE(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe("FORBIDDEN")
    })
  })

  describe("Cascade Delete", () => {
    it("should delete avatar and all related data", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      // Delete reference photos
      mockSql.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])
      // Delete generated photos
      mockSql.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      // Delete generation jobs
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Delete avatar
      mockSql.mockResolvedValueOnce([])

      const request = createRequest(`/api/avatars/${avatar.id}?telegram_user_id=${telegramUserId}`, {
        method: "DELETE",
      })
      const params = createParams(avatar.id)

      const response = await DELETE(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.deleted).toBe(true)
      expect(data.data.avatarId).toBe(avatar.id)
      expect(data.data.deletedCounts.referencePhotos).toBe(3)
      expect(data.data.deletedCounts.photos).toBe(2)
      expect(data.data.deletedCounts.generationJobs).toBe(1)
    })

    it("should handle avatar with no related data", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)

      // Empty deletes
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])

      const request = createRequest(`/api/avatars/${avatar.id}?telegram_user_id=${telegramUserId}`, {
        method: "DELETE",
      })
      const params = createParams(avatar.id)

      const response = await DELETE(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.deleted).toBe(true)
      expect(data.data.deletedCounts.referencePhotos).toBe(0)
      expect(data.data.deletedCounts.photos).toBe(0)
      expect(data.data.deletedCounts.generationJobs).toBe(0)
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      const avatar = createAvatar({ userId: 1 })
      const telegramUserId = 123456789

      setupOwnershipMock(avatar, telegramUserId, telegramUserId)
      mockSql.mockRejectedValueOnce(new Error("Delete failed"))

      const request = createRequest(`/api/avatars/${avatar.id}?telegram_user_id=${telegramUserId}`, {
        method: "DELETE",
      })
      const params = createParams(avatar.id)

      const response = await DELETE(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe("DATABASE_ERROR")
    })
  })
})
