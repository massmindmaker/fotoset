/**
 * IDOR (Insecure Direct Object Reference) Security Tests
 *
 * These tests verify that users cannot access, modify, or delete
 * resources belonging to other users.
 *
 * Test Matrix:
 * - Avatars: GET, PATCH, DELETE another user's avatar
 * - List Isolation: Users only see their own resources
 * - Enumeration Prevention: Consistent error responses
 * - Parameter Pollution: Header/query/body consistency
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

// Mock auth-utils
const mockGetUserIdentifier = jest.fn()
jest.mock("@/lib/auth-utils", () => ({
  getUserIdentifier: (req: any, body?: any) => mockGetUserIdentifier(req, body),
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
      AVATAR_NOT_FOUND: 404,
      FORBIDDEN: 403,
      DATABASE_ERROR: 500,
      PAYMENT_REQUIRED: 402,
      NOT_FOUND: 404,
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

import {
  GET as getAvatar,
  PATCH as patchAvatar,
  DELETE as deleteAvatar,
} from "@/app/api/avatars/[id]/route"
import { GET as listAvatars } from "@/app/api/avatars/route"

// ============================================================================
// TEST SETUP
// ============================================================================

// Test users
const VICTIM_USER = {
  id: 1,
  telegramUserId: 111111111,
}

const ATTACKER_USER = {
  id: 2,
  telegramUserId: 222222222,
}

// Test data
const VICTIM_AVATAR = {
  id: 100,
  name: "Victim's Avatar",
  status: "ready",
  thumbnail_url: "https://example.com/victim-thumb.jpg",
  created_at: new Date(),
  updated_at: new Date(),
  user_id: VICTIM_USER.id,
  owner_telegram_id: VICTIM_USER.telegramUserId,
}

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

type RouteParams = { params: Promise<{ id: string }> }

function createParams(id: string | number): RouteParams {
  return { params: Promise.resolve({ id: String(id) }) }
}

// ============================================================================
// AVATAR IDOR TESTS
// ============================================================================

describe("Avatar IDOR Protection", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("GET /api/avatars/[id]", () => {
    it("AVA-SEC-001: should deny attacker access to victim's avatar", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({
        telegramUserId: ATTACKER_USER.telegramUserId,
      })

      // Return victim's avatar (owner is different from requester)
      mockSql.mockResolvedValueOnce([VICTIM_AVATAR])

      const request = createRequest(
        `/api/avatars/${VICTIM_AVATAR.id}?telegram_user_id=${ATTACKER_USER.telegramUserId}`
      )
      const params = createParams(VICTIM_AVATAR.id)

      const response = await getAvatar(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe("FORBIDDEN")
    })

    it("AVA-SEC-001a: should allow owner to access their own avatar", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({
        telegramUserId: VICTIM_USER.telegramUserId,
      })

      mockSql.mockResolvedValueOnce([VICTIM_AVATAR])
      mockSql.mockResolvedValueOnce([]) // Photos
      mockSql.mockResolvedValueOnce([]) // Generation job

      const request = createRequest(
        `/api/avatars/${VICTIM_AVATAR.id}?telegram_user_id=${VICTIM_USER.telegramUserId}`
      )
      const params = createParams(VICTIM_AVATAR.id)

      const response = await getAvatar(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.id).toBe(VICTIM_AVATAR.id)
    })
  })

  describe("PATCH /api/avatars/[id]", () => {
    it("AVA-SEC-002: should deny attacker from modifying victim's avatar", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({
        telegramUserId: ATTACKER_USER.telegramUserId,
      })

      mockSql.mockResolvedValueOnce([VICTIM_AVATAR])

      const request = createRequest(`/api/avatars/${VICTIM_AVATAR.id}`, {
        method: "PATCH",
        body: {
          telegramUserId: ATTACKER_USER.telegramUserId,
          name: "HACKED BY ATTACKER",
        },
      })
      const params = createParams(VICTIM_AVATAR.id)

      const response = await patchAvatar(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe("FORBIDDEN")
    })

    it("AVA-SEC-002a: should deny impersonation via body telegramUserId", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({
        telegramUserId: ATTACKER_USER.telegramUserId,
      })

      mockSql.mockResolvedValueOnce([VICTIM_AVATAR])

      const request = createRequest(`/api/avatars/${VICTIM_AVATAR.id}`, {
        method: "PATCH",
        headers: {
          "x-telegram-user-id": String(ATTACKER_USER.telegramUserId),
        },
        body: {
          telegramUserId: VICTIM_USER.telegramUserId, // Trying to impersonate
          name: "HACKED",
        },
      })
      const params = createParams(VICTIM_AVATAR.id)

      const response = await patchAvatar(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
    })
  })

  describe("DELETE /api/avatars/[id]", () => {
    it("AVA-SEC-003: should deny attacker from deleting victim's avatar", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({
        telegramUserId: ATTACKER_USER.telegramUserId,
      })

      mockSql.mockResolvedValueOnce([VICTIM_AVATAR])

      const request = createRequest(
        `/api/avatars/${VICTIM_AVATAR.id}?telegram_user_id=${ATTACKER_USER.telegramUserId}`,
        { method: "DELETE" }
      )
      const params = createParams(VICTIM_AVATAR.id)

      const response = await deleteAvatar(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe("FORBIDDEN")
    })

    it("AVA-SEC-003a: should allow owner to delete their own avatar", async () => {
      mockGetUserIdentifier.mockReturnValueOnce({
        telegramUserId: VICTIM_USER.telegramUserId,
      })

      mockSql.mockResolvedValueOnce([VICTIM_AVATAR])
      mockSql.mockResolvedValueOnce([]) // Delete reference photos
      mockSql.mockResolvedValueOnce([]) // Delete generated photos
      mockSql.mockResolvedValueOnce([]) // Delete generation jobs
      mockSql.mockResolvedValueOnce([]) // Delete avatar

      const request = createRequest(
        `/api/avatars/${VICTIM_AVATAR.id}?telegram_user_id=${VICTIM_USER.telegramUserId}`,
        { method: "DELETE" }
      )
      const params = createParams(VICTIM_AVATAR.id)

      const response = await deleteAvatar(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.deleted).toBe(true)
    })
  })
})

// ============================================================================
// LIST ISOLATION TESTS
// ============================================================================

describe("List Isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("GET /api/avatars", () => {
    it("LIST-SEC-001: should only return user's own avatars", async () => {
      const attackerAvatar = {
        id: 200,
        name: "Attacker Avatar",
        status: "draft",
        thumbnail_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        photo_count: 0,
        reference_count: 0,
      }

      // User lookup returns attacker
      mockSql.mockResolvedValueOnce([{ id: ATTACKER_USER.id }])
      // Count
      mockSql.mockResolvedValueOnce([{ count: 1 }])
      // Only attacker's avatars returned
      mockSql.mockResolvedValueOnce([attackerAvatar])
      // Photos
      mockSql.mockResolvedValueOnce([])

      const request = createRequest(
        `/api/avatars?telegram_user_id=${ATTACKER_USER.telegramUserId}`
      )

      const response = await listAvatars(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.avatars).toHaveLength(1)
      expect(data.data.avatars[0].id).toBe(attackerAvatar.id)
      // Victim's avatar should NOT be in the response
      expect(data.data.avatars.find((a: any) => a.id === VICTIM_AVATAR.id)).toBeUndefined()
    })

    it("LIST-SEC-002: should return empty for user with no avatars", async () => {
      mockSql.mockResolvedValueOnce([{ id: ATTACKER_USER.id }])
      mockSql.mockResolvedValueOnce([{ count: 0 }])
      mockSql.mockResolvedValueOnce([])

      const request = createRequest(
        `/api/avatars?telegram_user_id=${ATTACKER_USER.telegramUserId}`
      )

      const response = await listAvatars(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.avatars).toHaveLength(0)
    })
  })
})

// ============================================================================
// ENUMERATION ATTACK PREVENTION
// ============================================================================

describe("Enumeration Attack Prevention", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("ENUM-SEC-001: should return 403 for unauthorized access (not 404)", async () => {
    // This is important: returning 404 would leak info about existing resources
    mockGetUserIdentifier.mockReturnValueOnce({
      telegramUserId: ATTACKER_USER.telegramUserId,
    })

    mockSql.mockResolvedValueOnce([VICTIM_AVATAR])

    const request = createRequest(
      `/api/avatars/${VICTIM_AVATAR.id}?telegram_user_id=${ATTACKER_USER.telegramUserId}`
    )
    const params = createParams(VICTIM_AVATAR.id)

    const response = await getAvatar(request, params)
    const data = await response.json()

    // Must return 403 FORBIDDEN, not 404
    expect(response.status).toBe(403)
    expect(data.error.code).toBe("FORBIDDEN")
  })

  it("ENUM-SEC-002: should return 404 for truly non-existent resources", async () => {
    mockGetUserIdentifier.mockReturnValueOnce({
      telegramUserId: ATTACKER_USER.telegramUserId,
    })

    mockSql.mockResolvedValueOnce([])

    const request = createRequest(
      `/api/avatars/999999?telegram_user_id=${ATTACKER_USER.telegramUserId}`
    )
    const params = createParams(999999)

    const response = await getAvatar(request, params)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe("AVATAR_NOT_FOUND")
  })
})

// ============================================================================
// PARAMETER POLLUTION PREVENTION
// ============================================================================

describe("Parameter Pollution Prevention", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("PARAM-SEC-001: should use consistent identifier source", async () => {
    // Attacker provides victim's ID in query but their own in header
    mockGetUserIdentifier.mockReturnValueOnce({
      telegramUserId: ATTACKER_USER.telegramUserId, // From header (takes precedence)
    })

    mockSql.mockResolvedValueOnce([VICTIM_AVATAR])

    const request = createRequest(
      `/api/avatars/${VICTIM_AVATAR.id}?telegram_user_id=${VICTIM_USER.telegramUserId}`,
      {
        headers: {
          "x-telegram-user-id": String(ATTACKER_USER.telegramUserId),
        },
      }
    )
    const params = createParams(VICTIM_AVATAR.id)

    const response = await getAvatar(request, params)
    const data = await response.json()

    // Header takes precedence, attacker's ID is used -> 403
    expect(response.status).toBe(403)
  })
})

// ============================================================================
// ID OVERFLOW/EDGE CASE PROTECTION
// ============================================================================

describe("ID Edge Case Protection", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("ID-SEC-001: should handle very large telegram_user_id", async () => {
    const largeTelegramId = 9007199254740991 // Max safe integer

    mockGetUserIdentifier.mockReturnValueOnce({
      telegramUserId: largeTelegramId,
    })

    mockSql.mockResolvedValueOnce([])

    const request = createRequest(
      `/api/avatars/1?telegram_user_id=${largeTelegramId}`
    )
    const params = createParams(1)

    const response = await getAvatar(request, params)

    // Should handle without crashing
    expect(response.status).toBe(404)
  })

  it("ID-SEC-002: should reject negative avatar IDs", async () => {
    const request = createRequest(`/api/avatars/-1?telegram_user_id=123456789`)
    const params = createParams(-1)

    const response = await getAvatar(request, params)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })

  it("ID-SEC-003: should reject zero avatar ID", async () => {
    const request = createRequest(`/api/avatars/0?telegram_user_id=123456789`)
    const params = createParams(0)

    const response = await getAvatar(request, params)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })

  it("ID-SEC-004: should reject non-numeric avatar ID", async () => {
    const request = createRequest(`/api/avatars/abc?telegram_user_id=123456789`)
    const params = createParams("abc")

    const response = await getAvatar(request, params)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })
})

// ============================================================================
// AUTHENTICATION BYPASS PREVENTION
// ============================================================================

describe("Authentication Bypass Prevention", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("AUTH-SEC-001: should reject missing telegram_user_id", async () => {
    mockGetUserIdentifier.mockReturnValueOnce({
      telegramUserId: undefined,
    })

    const request = createRequest(`/api/avatars/1`)
    const params = createParams(1)

    const response = await getAvatar(request, params)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe("UNAUTHORIZED")
  })

  it("AUTH-SEC-002: should reject NaN telegram_user_id in query", async () => {
    const request = createRequest(`/api/avatars?telegram_user_id=invalid`)

    const response = await listAvatars(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })
})
