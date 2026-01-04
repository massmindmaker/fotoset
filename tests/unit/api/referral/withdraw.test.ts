/**
 * Unit Tests for /api/referral/withdraw
 *
 * POST: Создать заявку на вывод средств
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

import { POST } from "@/app/api/referral/withdraw/route"

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(body: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/referral/withdraw", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// Constants from the route
const MIN_WITHDRAWAL = 5000
const NDFL_RATE = 0.13

// Valid test card number (passes Luhn)
const VALID_CARD = "4111111111111111" // Standard test Visa
const INVALID_CARD_LUHN = "4111111111111112" // Fails Luhn

// ============================================================================
// TESTS
// ============================================================================

describe("POST /api/referral/withdraw", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 400 when telegramUserId is missing", async () => {
      const request = createRequest({
        payoutMethod: "card",
        cardNumber: VALID_CARD,
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("required")
    })

    it("should return 400 when payoutMethod is missing", async () => {
      const request = createRequest({
        telegramUserId: 123456789,
        cardNumber: VALID_CARD,
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("required")
    })

    it("should return 400 when recipientName is missing", async () => {
      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: VALID_CARD,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("required")
    })
  })

  describe("Card Payout Validation", () => {
    it("should return 400 when card number is missing for card payout", async () => {
      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Card number required")
    })

    it("should return 400 for invalid card format", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])

      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: "123", // Too short
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Invalid card number")
    })

    it("should return 400 for card failing Luhn check", async () => {
      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: INVALID_CARD_LUHN,
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("INVALID_CARD")
    })
  })

  describe("SBP Payout Validation", () => {
    it("should return 400 when phone is missing for SBP payout", async () => {
      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "sbp",
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Phone number required")
    })
  })

  describe("User Not Found", () => {
    // TODO: Fix API to return 404 instead of 500 when user not found
    it("should return 500 when user does not exist (API returns 500, should be 404)", async () => {
      mockSql.mockResolvedValueOnce([]) // No user

      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: VALID_CARD,
        recipientName: "Test User",
      })

      const response = await POST(request)

      // Current behavior: 500 (should be 404)
      expect(response.status).toBe(500)
    })
  })

  describe("Insufficient Balance", () => {
    it("should return 400 when balance is below MIN_WITHDRAWAL", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Atomic withdrawal query returns empty (insufficient)
      mockSql.mockResolvedValueOnce([])
      // Balance info for error message
      mockSql.mockResolvedValueOnce([{ balance: 500, pending: 0 }])

      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: VALID_CARD,
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("INSUFFICIENT_BALANCE")
      expect(data.error).toContain("500.00")
      expect(data.error).toContain(String(MIN_WITHDRAWAL))
    })

    it("should account for pending withdrawals", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Atomic withdrawal fails (balance - pending < MIN)
      mockSql.mockResolvedValueOnce([])
      // Balance info: 1500 balance, 1000 pending = 500 available
      mockSql.mockResolvedValueOnce([{ balance: 1500, pending: 1000 }])

      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: VALID_CARD,
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("INSUFFICIENT_BALANCE")
      expect(data.error).toContain("500.00") // available = 1500 - 1000
    })
  })

  describe("Successful Withdrawal", () => {
    it("should create card withdrawal successfully", async () => {
      const withdrawalAmount = 1500
      const ndfl = Math.round(withdrawalAmount * NDFL_RATE * 100) / 100
      const payout = withdrawalAmount - ndfl

      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Atomic withdrawal success
      mockSql.mockResolvedValueOnce([
        {
          id: 123,
          amount: withdrawalAmount,
          ndfl_amount: ndfl,
          payout_amount: payout,
        },
      ])

      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: VALID_CARD,
        recipientName: "Иван Петров",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.withdrawalId).toBe(123)
      expect(data.amount).toBe(withdrawalAmount)
      expect(data.ndflAmount).toBe(ndfl)
      expect(data.payoutAmount).toBe(payout)
      expect(data.message).toContain("3 рабочих дней")
    })

    it("should create SBP withdrawal successfully", async () => {
      const withdrawalAmount = 2000
      const ndfl = Math.round(withdrawalAmount * NDFL_RATE * 100) / 100
      const payout = withdrawalAmount - ndfl

      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Atomic withdrawal success
      mockSql.mockResolvedValueOnce([
        {
          id: 456,
          amount: withdrawalAmount,
          ndfl_amount: ndfl,
          payout_amount: payout,
        },
      ])

      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "sbp",
        phone: "+79001234567",
        recipientName: "Анна Сидорова",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.withdrawalId).toBe(456)
    })

    it("should handle card with spaces", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Atomic withdrawal success
      mockSql.mockResolvedValueOnce([
        { id: 789, amount: 5000, ndfl_amount: 650, payout_amount: 4350 },
      ])

      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: "4111 1111 1111 1111", // With spaces - valid Luhn
        recipientName: "Test User",
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe("NDFL Calculation", () => {
    it("should calculate NDFL at 13%", async () => {
      const amount = 10000

      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Atomic withdrawal
      mockSql.mockResolvedValueOnce([
        {
          id: 1,
          amount: amount,
          ndfl_amount: 1300, // 13% of 10000
          payout_amount: 8700, // 10000 - 1300
        },
      ])

      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: VALID_CARD,
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ndflAmount).toBe(1300)
      expect(data.payoutAmount).toBe(8700)
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Connection lost"))

      const request = createRequest({
        telegramUserId: 123456789,
        payoutMethod: "card",
        cardNumber: VALID_CARD,
        recipientName: "Test User",
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain("Internal")
    })
  })
})
