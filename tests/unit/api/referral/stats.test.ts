/**
 * Unit Tests for /api/referral/stats
 *
 * GET: Получить статистику реферальной программы
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

import { GET } from "@/app/api/referral/stats/route"

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`)
}

// Constants from the route
const MIN_WITHDRAWAL = 5000
const NDFL_RATE = 0.13

// ============================================================================
// TESTS
// ============================================================================

describe("GET /api/referral/stats", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Validation", () => {
    it("should return 400 when both telegram_user_id and neon_auth_id are missing", async () => {
      const request = createRequest("/api/referral/stats")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("telegram_user_id or neon_auth_id required")
    })

    it("should return 400 when telegram_user_id is NaN", async () => {
      const request = createRequest("/api/referral/stats?telegram_user_id=invalid")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Invalid")
    })
  })

  describe("User Not Found", () => {
    it("should return 404 when user does not exist", async () => {
      mockSql.mockResolvedValueOnce([]) // No user

      const request = createRequest("/api/referral/stats?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain("not found")
    })
  })

  describe("New User Stats", () => {
    it("should create code and balance for new user", async () => {
      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // No existing code
      mockSql.mockResolvedValueOnce([])
      // No duplicate code
      mockSql.mockResolvedValueOnce([])
      // Insert code
      mockSql.mockResolvedValueOnce([])
      // No balance
      mockSql.mockResolvedValueOnce([])
      // Insert balance
      mockSql.mockResolvedValueOnce([])
      // Referrals list
      mockSql.mockResolvedValueOnce([])
      // Pending withdrawals
      mockSql.mockResolvedValueOnce([{ total: 0 }])

      const request = createRequest("/api/referral/stats?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.code).toBeDefined()
      expect(data.balance).toBe(0)
      expect(data.canWithdraw).toBe(false)
    })
  })

  describe("Existing User Stats", () => {
    it("should return full stats for existing user", async () => {
      const balance = 1500
      const totalEarned = 2000
      const totalWithdrawn = 500
      const referralsCount = 5
      const pendingWithdrawal = 200

      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Existing code
      mockSql.mockResolvedValueOnce([{ code: "ABC123" }])
      // Existing balance
      mockSql.mockResolvedValueOnce([{
        balance,
        total_earned: totalEarned,
        total_withdrawn: totalWithdrawn,
        referrals_count: referralsCount,
      }])
      // Recent referrals
      mockSql.mockResolvedValueOnce([
        { id: 1, created_at: new Date(), total_earned: 100 },
        { id: 2, created_at: new Date(), total_earned: 200 },
      ])
      // Pending withdrawals
      mockSql.mockResolvedValueOnce([{ total: pendingWithdrawal }])

      const request = createRequest("/api/referral/stats?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.code).toBe("ABC123")
      expect(data.balance).toBe(balance)
      expect(data.totalEarned).toBe(totalEarned)
      expect(data.totalWithdrawn).toBe(totalWithdrawn)
      expect(data.referralsCount).toBe(referralsCount)
      expect(data.pendingWithdrawal).toBe(pendingWithdrawal)
      expect(data.availableBalance).toBe(balance - pendingWithdrawal)
      expect(data.recentReferrals).toHaveLength(2)
    })
  })

  describe("Withdrawal Eligibility", () => {
    it("should allow withdrawal when balance >= MIN_WITHDRAWAL", async () => {
      const balance = MIN_WITHDRAWAL + 1000 // 6000

      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Code
      mockSql.mockResolvedValueOnce([{ code: "ABC123" }])
      // Balance
      mockSql.mockResolvedValueOnce([{
        balance,
        total_earned: balance,
        total_withdrawn: 0,
        referrals_count: 3,
      }])
      // Referrals
      mockSql.mockResolvedValueOnce([])
      // No pending
      mockSql.mockResolvedValueOnce([{ total: 0 }])

      const request = createRequest("/api/referral/stats?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.canWithdraw).toBe(true)
      expect(data.payoutPreview).not.toBeNull()
      expect(data.payoutPreview.amount).toBe(balance)
      expect(data.payoutPreview.ndfl).toBe(Math.round(balance * NDFL_RATE * 100) / 100)
      expect(data.payoutPreview.payout).toBe(balance - data.payoutPreview.ndfl)
    })

    it("should deny withdrawal when balance < MIN_WITHDRAWAL", async () => {
      const balance = MIN_WITHDRAWAL - 1 // 4999

      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Code
      mockSql.mockResolvedValueOnce([{ code: "ABC123" }])
      // Balance
      mockSql.mockResolvedValueOnce([{
        balance,
        total_earned: balance,
        total_withdrawn: 0,
        referrals_count: 2,
      }])
      // Referrals
      mockSql.mockResolvedValueOnce([])
      // No pending
      mockSql.mockResolvedValueOnce([{ total: 0 }])

      const request = createRequest("/api/referral/stats?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.canWithdraw).toBe(false)
      expect(data.payoutPreview).toBeNull()
      expect(data.minWithdrawal).toBe(MIN_WITHDRAWAL)
    })

    it("should account for pending withdrawals in availability", async () => {
      const balance = 8000
      const pending = 5000 // Available = 3000, below MIN (5000)

      // User found
      mockSql.mockResolvedValueOnce([{ id: 1 }])
      // Code
      mockSql.mockResolvedValueOnce([{ code: "ABC123" }])
      // Balance
      mockSql.mockResolvedValueOnce([{
        balance,
        total_earned: 10000,
        total_withdrawn: 2000,
        referrals_count: 5,
      }])
      // Referrals
      mockSql.mockResolvedValueOnce([])
      // Pending withdrawals
      mockSql.mockResolvedValueOnce([{ total: pending }])

      const request = createRequest("/api/referral/stats?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.balance).toBe(balance)
      expect(data.pendingWithdrawal).toBe(pending)
      expect(data.availableBalance).toBe(balance - pending) // 3000
      expect(data.canWithdraw).toBe(false) // 3000 < 5000
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Connection lost"))

      const request = createRequest("/api/referral/stats?telegram_user_id=123456789")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain("Internal")
    })
  })
})
