/**
 * Unit Tests for Admin Users Management API Routes
 *
 * Routes tested:
 * - GET /api/admin/users - List users with pagination and search
 * - GET /api/admin/users/[userId] - User details
 * - POST /api/admin/users/[userId]/ban - Ban/unban user
 */

import { NextRequest } from "next/server"

// ============================================================================
// MOCKS
// ============================================================================

const mockSql = jest.fn()

// Create the sql function that can be used both as a tag function and called directly
const createSqlMock = () => {
  const sqlFn = (...args: any[]) => {
    // Handle template literal calls: sql`...`
    if (Array.isArray(args[0])) {
      // For empty template strings, return empty fragment (used for no search condition)
      if (args[0].length === 1 && args[0][0] === "") {
        return ""
      }
      // For search condition sql fragments (AND ...), return a string synchronously
      const templateStr = args[0].join("")
      if (templateStr.includes("AND")) {
        return "AND (u.telegram_user_id::text LIKE '%search%')"
      }
      // For actual queries, call the mock (returns a promise)
      return mockSql(...args)
    }
    // Regular function calls
    return mockSql(...args)
  }

  sqlFn.unsafe = (str: string) => str

  return sqlFn
}

jest.mock("@/lib/db", () => ({
  sql: createSqlMock(),
}))

const mockGetCurrentSession = jest.fn()
jest.mock("@/lib/admin/session", () => ({
  getCurrentSession: () => mockGetCurrentSession(),
}))

const mockHasPermission = jest.fn()
jest.mock("@/lib/admin/permissions", () => ({
  hasPermission: (role: string, permission: string) => mockHasPermission(role, permission),
}))

const mockLogAdminAction = jest.fn()
jest.mock("@/lib/admin/audit", () => ({
  logAdminAction: (action: any) => mockLogAdminAction(action),
}))

// Mock Neon DB
jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => mockSql),
}))

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { GET as getUsersList } from "@/app/api/admin/users/route"
import { GET as getUserDetails } from "@/app/api/admin/users/[userId]/route"
import { POST as banUser } from "@/app/api/admin/users/[userId]/ban/route"

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`)
}

async function createRequestWithBody(url: string, body: any): Promise<NextRequest> {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

// ============================================================================
// TEST DATA
// ============================================================================

const mockUsers = [
  {
    id: 1,
    telegram_user_id: "111111111",
    created_at: new Date("2025-01-01"),
    updated_at: new Date("2025-01-01"),
    pending_referral_code: null,
    pending_generation_tier: null,
    avatars_count: "3",
    payments_count: "2",
    total_spent: "1998",
    ref_photos_total: "15",
    gen_photos_total: "69",
    tg_sent_count: "5",
    tg_pending_count: "0",
    tg_failed_count: "0",
  },
  {
    id: 2,
    telegram_user_id: "222222222",
    created_at: new Date("2025-01-15"),
    updated_at: new Date("2025-01-15"),
    pending_referral_code: "REF123",
    pending_generation_tier: "starter",
    avatars_count: "1",
    payments_count: "0",
    total_spent: "0",
    ref_photos_total: "5",
    gen_photos_total: "0",
    tg_sent_count: "0",
    tg_pending_count: "1",
    tg_failed_count: "0",
  },
]

const mockUserDetails = {
  id: 1,
  telegram_user_id: "111111111",
  referral_code: "USER1CODE",
  referred_by: null,
  pending_referral_code: null,
  created_at: new Date("2025-01-01"),
  updated_at: new Date("2025-01-01"),
}

const mockBanInfo = {
  is_banned: false,
  ban_reason: null,
  banned_at: null,
  total_earnings: 500,
}

const mockAvatars = [
  {
    id: 1,
    name: "Professional Avatar",
    status: "ready",
    thumbnail_url: "https://example.com/thumb1.jpg",
    created_at: new Date(),
    photo_count: "23",
  },
]

const mockPayments = [
  {
    id: 1,
    tbank_payment_id: "pay_123",
    amount: "999",
    tier_id: "standard",
    photo_count: 23,
    status: "succeeded",
    created_at: new Date(),
  },
]

const mockJobs = [
  {
    id: 1,
    avatar_id: 1,
    style_id: "professional",
    status: "completed",
    total_photos: 23,
    completed_photos: 23,
    error_message: null,
    created_at: new Date(),
    avatar_name: "Professional Avatar",
  },
]

const mockReferralStats = {
  referral_count: "5",
  paid_referral_count: "2",
  total_earned: "300",
}

const mockAdminSession = {
  adminId: 1,
  role: "super_admin",
  email: "admin@example.com",
}

// ============================================================================
// TESTS: GET /api/admin/users (List)
// ============================================================================

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = "postgresql://test"
  })

  describe("Basic Listing", () => {
    it("should return users with default pagination", async () => {
      mockSql.mockResolvedValueOnce([{ total: "2" }])
      mockSql.mockResolvedValueOnce(mockUsers)

      const request = createRequest("/api/admin/users")
      const response = await getUsersList(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.users).toHaveLength(2)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.limit).toBe(20)
      expect(data.data.pagination.total).toBe(2)
    })

    it("should return users with custom pagination", async () => {
      mockSql.mockResolvedValueOnce([{ total: "100" }])
      mockSql.mockResolvedValueOnce([mockUsers[0]])

      const request = createRequest("/api/admin/users?page=3&limit=10")
      const response = await getUsersList(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination.page).toBe(3)
      expect(data.data.pagination.limit).toBe(10)
      expect(data.data.pagination.total).toBe(100)
      expect(data.data.pagination.totalPages).toBe(10)
    })

    it("should search by telegram_user_id", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockUsers[0]])

      const request = createRequest("/api/admin/users?search=111111111")
      const response = await getUsersList(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.data.users).toBeDefined()
      expect(data.data.users).toHaveLength(1)
      expect(data.data.users[0].telegram_user_id).toBe("111111111")
    })

    it("should include aggregated counts", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockUsers[0]])

      const request = createRequest("/api/admin/users")
      const response = await getUsersList(request)
      const data = await response.json()

      const user = data.data.users[0]
      expect(user.avatars_count).toBe("3")
      expect(user.payments_count).toBe("2")
      expect(user.total_spent).toBe("1998")
    })

    it("should include photo counts", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockUsers[0]])

      const request = createRequest("/api/admin/users")
      const response = await getUsersList(request)
      const data = await response.json()

      const user = data.data.users[0]
      expect(user.ref_photos_total).toBe("15")
      expect(user.gen_photos_total).toBe("69")
    })

    it("should include telegram status counts", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockUsers[0]])

      const request = createRequest("/api/admin/users")
      const response = await getUsersList(request)
      const data = await response.json()

      const user = data.data.users[0]
      expect(user.tg_sent_count).toBe("5")
      expect(user.tg_pending_count).toBe("0")
      expect(user.tg_failed_count).toBe("0")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Database connection failed"))

      const request = createRequest("/api/admin/users")
      const response = await getUsersList(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("FETCH_ERROR")
      expect(data.error.userMessage).toBe("Ошибка загрузки пользователей")
    })
  })
})

// ============================================================================
// TESTS: GET /api/admin/users/[userId] (Details)
// ============================================================================

describe("GET /api/admin/users/[userId]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = "postgresql://test"
  })

  describe("Successful Retrieval", () => {
    it("should return full user details", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockSql
        .mockResolvedValueOnce([mockUserDetails])
        .mockResolvedValueOnce([mockBanInfo])
        .mockResolvedValueOnce(mockAvatars)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce(mockJobs)
        .mockResolvedValueOnce([mockReferralStats])

      const request = createRequest("/api/admin/users/1")
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user.id).toBe(1)
      expect(data.user.telegram_user_id).toBe("111111111")
    })

    it("should include avatars with photo counts", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockSql
        .mockResolvedValueOnce([mockUserDetails])
        .mockResolvedValueOnce([mockBanInfo])
        .mockResolvedValueOnce(mockAvatars)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce(mockJobs)
        .mockResolvedValueOnce([mockReferralStats])

      const request = createRequest("/api/admin/users/1")
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(data.avatars).toHaveLength(1)
      expect(data.avatars[0].photo_count).toBe("23")
    })

    it("should include payment history", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockSql
        .mockResolvedValueOnce([mockUserDetails])
        .mockResolvedValueOnce([mockBanInfo])
        .mockResolvedValueOnce(mockAvatars)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce(mockJobs)
        .mockResolvedValueOnce([mockReferralStats])

      const request = createRequest("/api/admin/users/1")
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(data.payments).toHaveLength(1)
      expect(data.payments[0].status).toBe("succeeded")
    })

    it("should include generation jobs", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockSql
        .mockResolvedValueOnce([mockUserDetails])
        .mockResolvedValueOnce([mockBanInfo])
        .mockResolvedValueOnce(mockAvatars)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce(mockJobs)
        .mockResolvedValueOnce([mockReferralStats])

      const request = createRequest("/api/admin/users/1")
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(data.jobs).toHaveLength(1)
      expect(data.jobs[0].status).toBe("completed")
    })

    it("should include referral stats", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockSql
        .mockResolvedValueOnce([mockUserDetails])
        .mockResolvedValueOnce([mockBanInfo])
        .mockResolvedValueOnce(mockAvatars)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce(mockJobs)
        .mockResolvedValueOnce([mockReferralStats])

      const request = createRequest("/api/admin/users/1")
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(data.referralStats.referral_count).toBe("5")
      expect(data.referralStats.paid_referral_count).toBe("2")
      expect(data.referralStats.total_earned).toBe("300")
    })

    it("should handle missing ban columns gracefully", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockSql
        .mockResolvedValueOnce([mockUserDetails])
        .mockRejectedValueOnce(new Error("column does not exist"))
        .mockResolvedValueOnce(mockAvatars)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce(mockJobs)
        .mockResolvedValueOnce([mockReferralStats])

      const request = createRequest("/api/admin/users/1")
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user.is_banned).toBe(false)
      expect(data.user.total_earnings).toBe(0)
    })
  })

  describe("Authorization", () => {
    it("should return 401 without session", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(null)

      const request = createRequest("/api/admin/users/1")
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })
  })

  describe("Validation", () => {
    it("should return 400 for invalid user ID", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)

      const request = createRequest("/api/admin/users/invalid")
      const context = { params: Promise.resolve({ userId: "invalid" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("Invalid user ID")
    })

    it("should return 404 for non-existent user", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/admin/users/999")
      const context = { params: Promise.resolve({ userId: "999" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe("User not found")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockSql.mockRejectedValueOnce(new Error("Connection lost"))

      const request = createRequest("/api/admin/users/1")
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await getUserDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe("Failed to fetch user details")
    })
  })
})

// ============================================================================
// TESTS: POST /api/admin/users/[userId]/ban
// ============================================================================

describe("POST /api/admin/users/[userId]/ban", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = "postgresql://test"
  })

  describe("Ban User", () => {
    it("should ban user successfully", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(true)
      mockSql.mockResolvedValueOnce([{ id: 1, is_banned: false, telegram_user_id: "111111111" }])
      mockSql.mockResolvedValueOnce([])
      mockLogAdminAction.mockResolvedValueOnce(undefined)

      const request = await createRequestWithBody("/api/admin/users/1/ban", {
        isBanned: true,
        reason: "Spam activity detected",
      })
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await banUser(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.isBanned).toBe(true)
      expect(data.message).toBe("User banned")
    })

    it("should include ban reason", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(true)
      mockSql.mockResolvedValueOnce([{ id: 1, is_banned: false, telegram_user_id: "111111111" }])
      mockSql.mockResolvedValueOnce([])
      mockLogAdminAction.mockResolvedValueOnce(undefined)

      const reason = "Violation of terms of service"
      const request = await createRequestWithBody("/api/admin/users/1/ban", {
        isBanned: true,
        reason,
      })
      const context = { params: Promise.resolve({ userId: "1" }) }
      await banUser(request, context)

      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            reason,
          }),
        })
      )
    })

    it("should log audit action for ban", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(true)
      mockSql.mockResolvedValueOnce([{ id: 1, is_banned: false, telegram_user_id: "111111111" }])
      mockSql.mockResolvedValueOnce([])
      mockLogAdminAction.mockResolvedValueOnce(undefined)

      const request = await createRequestWithBody("/api/admin/users/1/ban", {
        isBanned: true,
      })
      const context = { params: Promise.resolve({ userId: "1" }) }
      await banUser(request, context)

      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: 1,
        action: "user_banned",
        targetType: "user",
        targetId: 1,
        metadata: {
          previousStatus: false,
          newStatus: true,
          reason: null,
          telegramUserId: "111111111",
        },
      })
    })
  })

  describe("Unban User", () => {
    it("should unban user successfully", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(true)
      mockSql.mockResolvedValueOnce([{ id: 1, is_banned: true, telegram_user_id: "111111111" }])
      mockSql.mockResolvedValueOnce([])
      mockLogAdminAction.mockResolvedValueOnce(undefined)

      const request = await createRequestWithBody("/api/admin/users/1/ban", {
        isBanned: false,
      })
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await banUser(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.isBanned).toBe(false)
      expect(data.message).toBe("User unbanned")
    })

    it("should log audit action for unban", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(true)
      mockSql.mockResolvedValueOnce([{ id: 1, is_banned: true, telegram_user_id: "111111111" }])
      mockSql.mockResolvedValueOnce([])
      mockLogAdminAction.mockResolvedValueOnce(undefined)

      const request = await createRequestWithBody("/api/admin/users/1/ban", {
        isBanned: false,
      })
      const context = { params: Promise.resolve({ userId: "1" }) }
      await banUser(request, context)

      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user_unbanned",
        })
      )
    })
  })

  describe("Authorization", () => {
    it("should return 401 without session", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(null)

      const request = await createRequestWithBody("/api/admin/users/1/ban", {
        isBanned: true,
      })
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await banUser(request, context)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })

    it("should return 403 without users.ban permission", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(false)

      const request = await createRequestWithBody("/api/admin/users/1/ban", {
        isBanned: true,
      })
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await banUser(request, context)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe("Forbidden")
    })
  })

  describe("Validation", () => {
    it("should return 400 for invalid user ID", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(true)

      const request = await createRequestWithBody("/api/admin/users/invalid/ban", {
        isBanned: true,
      })
      const context = { params: Promise.resolve({ userId: "invalid" }) }
      const response = await banUser(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("Invalid user ID")
    })

    it("should return 400 for missing isBanned", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(true)

      const request = await createRequestWithBody("/api/admin/users/1/ban", {})
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await banUser(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("isBanned is required (boolean)")
    })

    it("should return 404 for non-existent user", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(true)
      mockSql.mockResolvedValueOnce([])

      const request = await createRequestWithBody("/api/admin/users/999/ban", {
        isBanned: true,
      })
      const context = { params: Promise.resolve({ userId: "999" }) }
      const response = await banUser(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe("User not found")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(mockAdminSession)
      mockHasPermission.mockReturnValueOnce(true)
      mockSql.mockRejectedValueOnce(new Error("Connection lost"))

      const request = await createRequestWithBody("/api/admin/users/1/ban", {
        isBanned: true,
      })
      const context = { params: Promise.resolve({ userId: "1" }) }
      const response = await banUser(request, context)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe("Failed to update ban status")
    })
  })
})
