/**
 * Unit Tests for /api/referral/code
 *
 * GET: Получить или создать реферальный код пользователя
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

import { GET } from "@/app/api/referral/code/route"

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`)
}

// ============================================================================
// TESTS
// ============================================================================

describe("GET /api/referral/code", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 400 when telegram_user_id is missing", async () => {
      const request = createRequest("/api/referral/code")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("telegram_user_id")
    })

    it("should return 400 when telegram_user_id is NaN", async () => {
      const request = createRequest("/api/referral/code?telegram_user_id=invalid")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Invalid")
    })
  })

  describe("User Not Found", () => {
    it("should return 404 when user does not exist", async () => {
      mockSql.mockResolvedValueOnce([]) // No user

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain("not found")
    })
  })

  describe("Existing Code", () => {
    it("should return existing referral code", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Existing code
      mockSql.mockResolvedValueOnce([{ code: "ABC123", is_active: true }])

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBe("ABC123")
      expect(data.isActive).toBe(true)
    })

    it("should return inactive code status", async () => {
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      mockSql.mockResolvedValueOnce([{ code: "OLD123", is_active: false }])

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBe("OLD123")
      expect(data.isActive).toBe(false)
    })
  })

  describe("New Code Generation", () => {
    it("should generate new code when none exists", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // No existing code
      mockSql.mockResolvedValueOnce([])
      // No duplicate on first try
      mockSql.mockResolvedValueOnce([])
      // Insert code success
      mockSql.mockResolvedValueOnce([])
      // Insert balance success
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBeDefined()
      expect(data.code).toHaveLength(6) // Default code length
      expect(data.isActive).toBe(true)
    })

    it("should retry on duplicate code", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // No existing code
      mockSql.mockResolvedValueOnce([])
      // First code is duplicate
      mockSql.mockResolvedValueOnce([{ id: 99 }])
      // Second code is unique
      mockSql.mockResolvedValueOnce([])
      // Insert success
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBeDefined()
    })

    it("should fail after max attempts for unique code", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // No existing code
      mockSql.mockResolvedValueOnce([])
      // All codes are duplicates (10 attempts)
      for (let i = 0; i < 10; i++) {
        mockSql.mockResolvedValueOnce([{ id: i + 1 }])
      }

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain("unique code")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Connection lost"))

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain("Internal")
    })
  })
})
