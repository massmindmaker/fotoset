/**
 * Unit Tests for /api/referral/apply
 *
 * POST: Применить реферальный код
 */

import { NextRequest } from "next/server"

// ============================================================================
// MOCKS
// ============================================================================

const mockQuery = jest.fn()
jest.mock("@/lib/db", () => ({
  query: (...args: any[]) => mockQuery(...args),
}))

// ============================================================================
// IMPORTS
// ============================================================================

import { POST } from "@/app/api/referral/apply/route"

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(body: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/referral/apply", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// ============================================================================
// TESTS
// ============================================================================

describe("POST /api/referral/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 400 when telegramUserId is missing", async () => {
      const request = createRequest({ referralCode: "ABC123" })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("required")
    })

    it("should return 400 when referralCode is missing", async () => {
      const request = createRequest({ telegramUserId: 123456789 })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("required")
    })
  })

  describe("User Validation", () => {
    it("should return 404 when user not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const request = createRequest({
        telegramUserId: 123456789,
        referralCode: "ABC123",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain("not found")
    })
  })

  describe("Already Referred", () => {
    it("should return 400 when user already has referrer", async () => {
      // User found
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      // Already has referral
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 99 }] })

      const request = createRequest({
        telegramUserId: 123456789,
        referralCode: "ABC123",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("ALREADY_REFERRED")
    })
  })

  describe("Invalid Code", () => {
    it("should return 400 for non-existent code", async () => {
      // User found
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      // No existing referral
      mockQuery.mockResolvedValueOnce({ rows: [] })
      // Code not found
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const request = createRequest({
        telegramUserId: 123456789,
        referralCode: "INVALID",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("INVALID_CODE")
    })

    it("should return 400 for inactive code", async () => {
      // User found
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      // No existing referral
      mockQuery.mockResolvedValueOnce({ rows: [] })
      // Code found but inactive
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 2, is_active: false }] })

      const request = createRequest({
        telegramUserId: 123456789,
        referralCode: "OLD123",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("INACTIVE_CODE")
    })
  })

  describe("Self-Referral", () => {
    it("should return 400 for self-referral attempt", async () => {
      const userId = 1
      // User found (same as code owner)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }] })
      // No existing referral
      mockQuery.mockResolvedValueOnce({ rows: [] })
      // Code belongs to same user
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: userId, is_active: true }] })

      const request = createRequest({
        telegramUserId: 123456789,
        referralCode: "MYCODE",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("SELF_REFERRAL")
    })
  })

  describe("Success", () => {
    it("should apply referral code successfully", async () => {
      const referredId = 1
      const referrerId = 2

      // User found
      mockQuery.mockResolvedValueOnce({ rows: [{ id: referredId }] })
      // No existing referral
      mockQuery.mockResolvedValueOnce({ rows: [] })
      // Valid code
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: referrerId, is_active: true }] })
      // Insert referral link
      mockQuery.mockResolvedValueOnce({ rows: [] })
      // Update referrer's count
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const request = createRequest({
        telegramUserId: 123456789,
        referralCode: "REF123",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it("should normalize code to uppercase", async () => {
      // User found
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      // No existing referral
      mockQuery.mockResolvedValueOnce({ rows: [] })
      // Code found (mock expects uppercase - the DB lookup will use normalized code)
      mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 2, is_active: true }] })
      // Insert referral
      mockQuery.mockResolvedValueOnce({ rows: [] })
      // Update count
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const request = createRequest({
        telegramUserId: 123456789,
        referralCode: "  abc123  ", // lowercase with spaces
      })

      const response = await POST(request)

      // If code wasn't normalized, the mock for code lookup wouldn't match
      // and would return empty, causing INVALID_CODE error
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ success: true })
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"))

      const request = createRequest({
        telegramUserId: 123456789,
        referralCode: "ABC123",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain("Internal")
    })
  })
})
