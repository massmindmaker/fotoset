/**
 * Unit Tests for /api/referral/earnings
 *
 * GET: Получить историю начислений реферальной программы
 */

import { NextRequest } from "next/server"

// ============================================================================
// MOCKS
// ============================================================================

const mockSql = jest.fn()
jest.mock("@/lib/db", () => ({
  sql: (...args: any[]) => mockSql(...args),
}))

// ============================================================================
// IMPORTS
// ============================================================================

import { GET } from "@/app/api/referral/earnings/route"

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`)
}

// ============================================================================
// TESTS
// ============================================================================

describe("GET /api/referral/earnings", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 400 when both telegram_user_id and neon_auth_id are missing", async () => {
      const request = createRequest("/api/referral/earnings")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("telegram_user_id or neon_auth_id required")
    })

    it("should return 400 when telegram_user_id is NaN", async () => {
      const request = createRequest("/api/referral/earnings?telegram_user_id=invalid")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Invalid")
    })
  })

  describe("User Not Found", () => {
    it("should return 404 when user does not exist", async () => {
      mockSql.mockResolvedValueOnce([]) // No user

      const request = createRequest("/api/referral/earnings?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain("not found")
    })
  })

  describe("Empty Earnings", () => {
    it("should return empty array for user with no earnings", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // No earnings
      mockSql.mockResolvedValueOnce([])
      // Count = 0
      mockSql.mockResolvedValueOnce([{ count: 0 }])

      const request = createRequest("/api/referral/earnings?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.earnings).toEqual([])
      expect(data.total).toBe(0)
    })
  })

  describe("Earnings List", () => {
    it("should return earnings with default pagination", async () => {
      const now = new Date()
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Earnings
      mockSql.mockResolvedValueOnce([
        { id: 1, amount: 50, original_amount: 499, created_at: now },
        { id: 2, amount: 100, original_amount: 999, created_at: now },
      ])
      // Count
      mockSql.mockResolvedValueOnce([{ count: 2 }])

      const request = createRequest("/api/referral/earnings?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.earnings).toHaveLength(2)
      expect(data.earnings[0].amount).toBe(50)
      expect(data.earnings[0].originalAmount).toBe(499)
      expect(data.total).toBe(2)
      expect(data.limit).toBe(20)
      expect(data.offset).toBe(0)
    })

    it("should respect custom limit and offset", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Earnings (limited)
      mockSql.mockResolvedValueOnce([
        { id: 3, amount: 150, original_amount: 1499, created_at: new Date() },
      ])
      // Total count
      mockSql.mockResolvedValueOnce([{ count: 10 }])

      const request = createRequest(
        "/api/referral/earnings?telegram_user_id=123456789&limit=1&offset=2"
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.limit).toBe(1)
      expect(data.offset).toBe(2)
      expect(data.total).toBe(10)
      expect(data.earnings).toHaveLength(1)
    })
  })

  describe("Data Transformation", () => {
    it("should transform DB fields to camelCase", async () => {
      const now = new Date()
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Earnings with DB field names
      mockSql.mockResolvedValueOnce([
        {
          id: 1,
          amount: "50.00", // String from DB
          original_amount: "499.00",
          created_at: now,
        },
      ])
      // Count
      mockSql.mockResolvedValueOnce([{ count: 1 }])

      const request = createRequest("/api/referral/earnings?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.earnings[0]).toEqual({
        id: 1,
        amount: 50,
        originalAmount: 499,
        date: now.toISOString(),
      })
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Connection lost"))

      const request = createRequest("/api/referral/earnings?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain("Internal")
    })
  })
})
