/**
 * Unit Tests for /api/avatars Route
 *
 * Tests cover:
 * - GET: List avatars with pagination and optional photos
 * - POST: Create new avatar with limit check
 * - Validation, auth, error handling
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

// Mock user-identity
const mockFindOrCreateUser = jest.fn()
jest.mock("@/lib/user-identity", () => ({
  findOrCreateUser: (params: any) => mockFindOrCreateUser(params),
}))

// Mock api-utils
jest.mock("@/lib/api-utils", () => ({
  success: (data: any, meta?: any) => ({
    status: 200,
    json: async () => ({ success: true, data, meta }),
  }),
  created: (data: any) => ({
    status: 201,
    json: async () => ({ success: true, data }),
  }),
  error: (code: string, message: string) => {
    const statusMap: Record<string, number> = {
      UNAUTHORIZED: 401,
      VALIDATION_ERROR: 400,
      LIMIT_REACHED: 429,
      DATABASE_ERROR: 500,
    }
    return {
      status: statusMap[code] || 400,
      json: async () => ({ success: false, error: { code, message } }),
    }
  },
  parsePagination: (_params: URLSearchParams, defaults: any) => ({
    page: 1,
    limit: defaults?.limit || 50,
    offset: 0,
  }),
  createPaginationMeta: (pagination: any, total: number) => ({
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  }),
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

import { GET, POST } from "@/app/api/avatars/route"
import { createUser, createProUser, createAvatar } from "@/tests/fixtures/factory"

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

// ============================================================================
// GET /api/avatars Tests
// ============================================================================

describe("GET /api/avatars", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 401 when telegram_user_id is missing", async () => {
      const request = createRequest("/api/avatars")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe("UNAUTHORIZED")
    })

    it("should return 400 when telegram_user_id is invalid (NaN)", async () => {
      const request = createRequest("/api/avatars?telegram_user_id=invalid")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })
  })

  describe("Empty Results", () => {
    it("should return empty array when user not found", async () => {
      // User not found in DB
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/avatars?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.avatars).toEqual([])
    })

    it("should return empty array when user has no avatars", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Count = 0
      mockSql.mockResolvedValueOnce([{ count: 0 }])
      // No avatars
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/avatars?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.avatars).toEqual([])
      expect(data.meta).toBeDefined()
      expect(data.meta.total).toBe(0)
    })
  })

  describe("Success with Photos", () => {
    it("should return avatars with photos (default include_photos=true)", async () => {
      const user = createUser()
      const avatar = createAvatar({ userId: user.id })

      // User found
      mockSql.mockResolvedValueOnce([{ id: user.id }])
      // Count
      mockSql.mockResolvedValueOnce([{ count: 1 }])
      // Avatars with counts
      mockSql.mockResolvedValueOnce([{
        id: avatar.id,
        name: avatar.name,
        status: avatar.status,
        thumbnail_url: avatar.thumbnailUrl,
        created_at: avatar.createdAt,
        updated_at: avatar.updatedAt,
        photo_count: 5,
        reference_count: 8,
      }])
      // Photos for avatars
      mockSql.mockResolvedValueOnce([
        {
          id: 1,
          avatar_id: avatar.id,
          style_id: "professional",
          prompt: "Business portrait",
          image_url: "https://example.com/photo1.jpg",
          created_at: new Date(),
          is_favorite: false,
        },
      ])

      const request = createRequest("/api/avatars?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.avatars).toHaveLength(1)
      expect(data.data.avatars[0].id).toBe(avatar.id)
      expect(data.data.avatars[0].photoCount).toBe(5)
      expect(data.data.avatars[0].referenceCount).toBe(8)
      expect(data.data.avatars[0].generatedPhotos).toHaveLength(1)
    })

    it("should return avatars without photos when include_photos=false", async () => {
      const user = createUser()
      const avatar = createAvatar({ userId: user.id })

      // User found
      mockSql.mockResolvedValueOnce([{ id: user.id }])
      // Count
      mockSql.mockResolvedValueOnce([{ count: 1 }])
      // Avatars
      mockSql.mockResolvedValueOnce([{
        id: avatar.id,
        name: avatar.name,
        status: avatar.status,
        thumbnail_url: avatar.thumbnailUrl,
        created_at: avatar.createdAt,
        updated_at: avatar.updatedAt,
        photo_count: 5,
        reference_count: 8,
      }])

      const request = createRequest("/api/avatars?telegram_user_id=123456789&include_photos=false")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.avatars).toHaveLength(1)
      expect(data.data.avatars[0].generatedPhotos).toEqual([])
      // Photos query should NOT be called
      expect(mockSql).toHaveBeenCalledTimes(3) // user, count, avatars
    })
  })

  describe("Pagination", () => {
    it("should return pagination metadata", async () => {
      const user = createUser()

      // User found
      mockSql.mockResolvedValueOnce([{ id: user.id }])
      // Count = 5
      mockSql.mockResolvedValueOnce([{ count: 5 }])
      // 3 avatars (simulating limit)
      mockSql.mockResolvedValueOnce([
        { id: 1, name: "Avatar 1", status: "draft", thumbnail_url: null, created_at: new Date(), updated_at: new Date(), photo_count: 0, reference_count: 0 },
        { id: 2, name: "Avatar 2", status: "draft", thumbnail_url: null, created_at: new Date(), updated_at: new Date(), photo_count: 0, reference_count: 0 },
        { id: 3, name: "Avatar 3", status: "ready", thumbnail_url: null, created_at: new Date(), updated_at: new Date(), photo_count: 10, reference_count: 5 },
      ])
      // Photos
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/avatars?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.avatars).toHaveLength(3)
      expect(data.meta.total).toBe(5)
      expect(data.meta.page).toBe(1)
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      // User query throws
      mockSql.mockRejectedValueOnce(new Error("Connection failed"))

      const request = createRequest("/api/avatars?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe("DATABASE_ERROR")
    })
  })
})

// ============================================================================
// POST /api/avatars Tests
// ============================================================================

describe("POST /api/avatars", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 401 when telegramUserId is missing", async () => {
      const request = createRequest("/api/avatars", {
        method: "POST",
        body: { name: "My Avatar" },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe("UNAUTHORIZED")
    })

    it("should return 400 when telegramUserId is invalid (NaN)", async () => {
      const request = createRequest("/api/avatars", {
        method: "POST",
        body: { telegramUserId: "invalid", name: "My Avatar" },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })
  })

  describe("Avatar Limit", () => {
    it("should return 429 when avatar limit (3) is reached", async () => {
      const user = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(user)
      // Avatar count = 3 (limit reached)
      mockSql.mockResolvedValueOnce([{ count: 3 }])

      const request = createRequest("/api/avatars", {
        method: "POST",
        body: { telegramUserId: 123456789, name: "New Avatar" },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error.code).toBe("LIMIT_REACHED")
    })
  })

  describe("Success", () => {
    it("should create avatar with default name", async () => {
      const user = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(user)
      // Avatar count = 0
      mockSql.mockResolvedValueOnce([{ count: 0 }])
      // Create avatar
      mockSql.mockResolvedValueOnce([{
        id: 1,
        name: "My Avatar",
        status: "draft",
        thumbnail_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      }])

      const request = createRequest("/api/avatars", {
        method: "POST",
        body: { telegramUserId: 123456789 },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.id).toBe(1)
      expect(data.data.name).toBe("My Avatar")
      expect(data.data.status).toBe("draft")
      expect(data.data.photoCount).toBe(0)
      expect(data.data.referenceCount).toBe(0)
    })

    it("should create avatar with custom name", async () => {
      const user = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(user)
      // Avatar count = 1
      mockSql.mockResolvedValueOnce([{ count: 1 }])
      // Create avatar
      mockSql.mockResolvedValueOnce([{
        id: 2,
        name: "Business Photos",
        status: "draft",
        thumbnail_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      }])

      const request = createRequest("/api/avatars", {
        method: "POST",
        body: { telegramUserId: 123456789, name: "Business Photos" },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.name).toBe("Business Photos")
    })

    it("should accept telegramUserId as number", async () => {
      const user = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(user)
      mockSql.mockResolvedValueOnce([{ count: 0 }])
      mockSql.mockResolvedValueOnce([{
        id: 1,
        name: "My Avatar",
        status: "draft",
        thumbnail_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      }])

      const request = createRequest("/api/avatars", {
        method: "POST",
        body: { telegramUserId: 123456789, name: "My Avatar" },
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockFindOrCreateUser).toHaveBeenCalledWith({ telegramUserId: 123456789 })
    })

    it("should accept telegramUserId as string", async () => {
      const user = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(user)
      mockSql.mockResolvedValueOnce([{ count: 0 }])
      mockSql.mockResolvedValueOnce([{
        id: 1,
        name: "My Avatar",
        status: "draft",
        thumbnail_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      }])

      const request = createRequest("/api/avatars", {
        method: "POST",
        body: { telegramUserId: "987654321", name: "My Avatar" },
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockFindOrCreateUser).toHaveBeenCalledWith({ telegramUserId: 987654321 })
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error during count check", async () => {
      const user = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(user)
      mockSql.mockRejectedValueOnce(new Error("Database connection lost"))

      const request = createRequest("/api/avatars", {
        method: "POST",
        body: { telegramUserId: 123456789, name: "My Avatar" },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe("DATABASE_ERROR")
    })

    it("should return 500 on database error during creation", async () => {
      const user = createUser()

      mockFindOrCreateUser.mockResolvedValueOnce(user)
      mockSql.mockResolvedValueOnce([{ count: 0 }])
      mockSql.mockRejectedValueOnce(new Error("Insert failed"))

      const request = createRequest("/api/avatars", {
        method: "POST",
        body: { telegramUserId: 123456789, name: "My Avatar" },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe("DATABASE_ERROR")
    })
  })
})
