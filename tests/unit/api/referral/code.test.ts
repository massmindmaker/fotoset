/**
 * Unit Tests for /api/referral/code
 *
 * GET: Получить или создать реферальный код пользователя
 *
 * Updated to match current dual-code API (telegram + web)
 */

import { NextRequest } from "next/server"

// ============================================================================
// MOCKS
// ============================================================================

const mockSql = jest.fn()
jest.mock("@/lib/db", () => ({
  sql: (...args: any[]) => mockSql(...args),
}))

const mockFindUserByIdentifier = jest.fn()
const mockExtractIdentifierFromRequest = jest.fn()

jest.mock("@/lib/user-identity", () => ({
  extractIdentifierFromRequest: (...args: any[]) => mockExtractIdentifierFromRequest(...args),
  findUserByIdentifier: (...args: any[]) => mockFindUserByIdentifier(...args),
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

    // Default mock implementations
    mockExtractIdentifierFromRequest.mockImplementation((data) => ({
      telegramUserId: data.telegram_user_id ? parseInt(data.telegram_user_id) : undefined,
      neonUserId: data.neon_user_id,
    }))

    // Default: user not found
    mockFindUserByIdentifier.mockResolvedValue(null)
  })

  describe("Validation", () => {
    it("should return 400 when telegram_user_id is missing", async () => {
      const request = createRequest("/api/referral/code")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("telegram_user_id")
    })

    it("should return 400 when only invalid params provided", async () => {
      const request = createRequest("/api/referral/code?invalid=123")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("required")
    })
  })

  describe("User Not Found", () => {
    it("should return 404 when user does not exist", async () => {
      mockFindUserByIdentifier.mockResolvedValue(null)

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain("not found")
    })
  })

  describe("Existing Codes", () => {
    it("should return existing referral codes", async () => {
      // User found
      mockFindUserByIdentifier.mockResolvedValue({ id: 1, telegram_user_id: 123456789 })

      // Existing codes in referral_balances
      mockSql.mockResolvedValueOnce([{
        referral_code: "TG1234",
        referral_code_telegram: "TG1234",
        referral_code_web: "WEB567"
      }])

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.referralCodeTelegram).toBe("TG1234")
      expect(data.referralCodeWeb).toBe("WEB567")
      expect(data.code).toBe("TG1234") // Legacy field
      expect(data.isActive).toBe(true)
      expect(data.telegramLink).toContain("t.me/")
      expect(data.webLink).toContain("ref=")
    })
  })

  describe("New Code Generation", () => {
    it("should generate new codes when none exist", async () => {
      // User found
      mockFindUserByIdentifier.mockResolvedValue({ id: 1, telegram_user_id: 123456789 })

      // No existing balance
      mockSql.mockResolvedValueOnce([])

      // Check for telegram code duplicate - no duplicate
      mockSql.mockResolvedValueOnce([])
      // Check for web code duplicate - no duplicate
      mockSql.mockResolvedValueOnce([])

      // Insert/upsert success
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.referralCodeTelegram).toBeDefined()
      expect(data.referralCodeTelegram).toHaveLength(6)
      expect(data.referralCodeWeb).toBeDefined()
      expect(data.referralCodeWeb).toHaveLength(6)
      expect(data.isActive).toBe(true)
    })

    it("should retry on duplicate telegram code", async () => {
      mockFindUserByIdentifier.mockResolvedValue({ id: 1 })

      // No existing balance
      mockSql.mockResolvedValueOnce([])

      // First telegram code is duplicate
      mockSql.mockResolvedValueOnce([{ id: 99 }])
      // Second telegram code is unique
      mockSql.mockResolvedValueOnce([])
      // Web code is unique
      mockSql.mockResolvedValueOnce([])
      // Insert success
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.referralCodeTelegram).toBeDefined()
    })

    it("should fail after max attempts for unique code", async () => {
      mockFindUserByIdentifier.mockResolvedValue({ id: 1 })

      // No existing balance
      mockSql.mockResolvedValueOnce([])

      // All telegram codes are duplicates (10 attempts max)
      for (let i = 0; i < 10; i++) {
        mockSql.mockResolvedValueOnce([{ id: i + 1 }])
      }

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe("Internal server error")
    })
  })

  describe("Web User Support", () => {
    it("should accept neon_user_id for web users", async () => {
      mockExtractIdentifierFromRequest.mockReturnValue({
        telegramUserId: undefined,
        neonUserId: "neon-123-abc"
      })
      mockFindUserByIdentifier.mockResolvedValue({ id: 2, neon_auth_id: "neon-123-abc" })

      // Existing codes
      mockSql.mockResolvedValueOnce([{
        referral_code_telegram: "TG9999",
        referral_code_web: "WEB999"
      }])

      const request = createRequest("/api/referral/code?neon_user_id=neon-123-abc")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.referralCodeWeb).toBe("WEB999")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockFindUserByIdentifier.mockRejectedValue(new Error("Connection lost"))

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain("Internal")
    })

    it("should return 500 on SQL error during code generation", async () => {
      mockFindUserByIdentifier.mockResolvedValue({ id: 1 })
      mockSql.mockRejectedValueOnce(new Error("SQL Error"))

      const request = createRequest("/api/referral/code?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe("Internal server error")
    })
  })
})
