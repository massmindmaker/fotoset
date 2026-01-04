/**
 * Unit Tests for Admin Referrals API Routes
 *
 * Routes covered:
 * - GET /api/admin/referrals (stats)
 * - GET /api/admin/referrals/withdrawals (list)
 * - POST /api/admin/referrals/withdrawals/[id] (approve/reject)
 */

import { NextRequest } from "next/server"

// ============================================================================
// MOCKS
// ============================================================================

const mockSql = jest.fn()

// Mock neon
jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => mockSql),
}))

jest.mock("@/lib/admin/session", () => ({
  getCurrentSession: jest.fn(),
}))

jest.mock("@/lib/admin/audit", () => ({
  logAdminAction: jest.fn(),
}))

// ============================================================================
// IMPORTS
// ============================================================================

import { GET as getReferralStats } from "@/app/api/admin/referrals/route"
import { GET as getWithdrawals } from "@/app/api/admin/referrals/withdrawals/route"
import { POST as processWithdrawal } from "@/app/api/admin/referrals/withdrawals/[id]/route"
import { getCurrentSession } from "@/lib/admin/session"
import { logAdminAction } from "@/lib/admin/audit"

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`)
}

// ============================================================================
// TEST DATA
// ============================================================================

const mockStatsResult = {
  total_codes: 150,
  total_referrals: 230,
  total_earnings: 45000.0,
  pending_balance: 12500.0,
  total_withdrawn: 32500.0,
  pending_withdrawals: 5,
}

const mockFunnelResult = {
  registered: 230,
  paid: 89,
}

const mockTopReferrers = [
  {
    user_id: 1,
    telegram_user_id: 111111111,
    referrals_count: 25,
    balance: 5000.0,
    total_earned: 12000.0,
    total_withdrawn: 7000.0,
    referral_code: "REF123",
    conversions: 12,
  },
  {
    user_id: 2,
    telegram_user_id: 222222222,
    referrals_count: 18,
    balance: 3500.0,
    total_earned: 8500.0,
    total_withdrawn: 5000.0,
    referral_code: "REF456",
    conversions: 8,
  },
]

const mockRecentEarnings = [
  {
    id: 1,
    referrer_id: 1,
    referrer_telegram_id: 111111111,
    referred_id: 10,
    referred_telegram_id: 333333333,
    amount: 500.0,
    status: "confirmed",
    created_at: new Date("2025-12-30T10:00:00Z"),
    tbank_payment_id: "pay_123",
  },
  {
    id: 2,
    referrer_id: 2,
    referrer_telegram_id: 222222222,
    referred_id: 11,
    referred_telegram_id: 444444444,
    amount: 500.0,
    status: "pending",
    created_at: new Date("2025-12-30T09:00:00Z"),
    tbank_payment_id: "pay_456",
  },
]

const mockWithdrawals = [
  {
    id: 1,
    user_id: 1,
    telegram_user_id: 111111111,
    amount: 5000.0,
    ndfl_amount: 650.0,
    payout_amount: 4350.0,
    method: "card",
    card_number: "1234",
    phone: null,
    status: "pending",
    created_at: new Date("2025-12-30T10:00:00Z"),
    processed_at: null,
    current_balance: 5000.0,
    total_earned: 12000.0,
  },
  {
    id: 2,
    user_id: 2,
    telegram_user_id: 222222222,
    amount: 3000.0,
    ndfl_amount: 390.0,
    payout_amount: 2610.0,
    method: "sbp",
    card_number: null,
    phone: "+79001234567",
    status: "approved",
    created_at: new Date("2025-12-29T10:00:00Z"),
    processed_at: new Date("2025-12-29T15:00:00Z"),
    current_balance: 500.0,
    total_earned: 8500.0,
  },
]

const mockSession = {
  adminId: 1,
  username: "admin",
  permissions: ["referrals.view", "referrals.approve_withdrawal"],
}

// ============================================================================
// TEST SUITE: GET /api/admin/referrals (Stats)
// ============================================================================

describe("GET /api/admin/referrals (Stats)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = "postgresql://test"
    ;(getCurrentSession as jest.Mock).mockResolvedValue(mockSession)
  })

  describe("Success Cases", () => {
    it("should return complete referral stats", async () => {
      mockSql
        .mockResolvedValueOnce([mockStatsResult])
        .mockResolvedValueOnce([mockFunnelResult])
        .mockResolvedValueOnce(mockTopReferrers)
        .mockResolvedValueOnce(mockRecentEarnings)

      const response = await getReferralStats()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.stats).toBeDefined()
      expect(data.stats.total_codes).toBe(150)
      expect(data.stats.total_referrals).toBe(230)
      expect(data.stats.total_earnings).toBe(45000.0)
      expect(data.stats.pending_balance).toBe(12500.0)
      expect(data.stats.total_withdrawn).toBe(32500.0)
      expect(data.stats.pending_withdrawals).toBe(5)
    })

    it("should include funnel stats", async () => {
      mockSql
        .mockResolvedValueOnce([mockStatsResult])
        .mockResolvedValueOnce([mockFunnelResult])
        .mockResolvedValueOnce(mockTopReferrers)
        .mockResolvedValueOnce(mockRecentEarnings)

      const response = await getReferralStats()
      const data = await response.json()

      expect(data.stats.funnel).toBeDefined()
      expect(data.stats.funnel.registered).toBe(230)
      expect(data.stats.funnel.paid).toBe(89)
    })

    it("should include top referrers list", async () => {
      mockSql
        .mockResolvedValueOnce([mockStatsResult])
        .mockResolvedValueOnce([mockFunnelResult])
        .mockResolvedValueOnce(mockTopReferrers)
        .mockResolvedValueOnce(mockRecentEarnings)

      const response = await getReferralStats()
      const data = await response.json()

      expect(data.topReferrers).toHaveLength(2)
      expect(data.topReferrers[0].user_id).toBe(1)
      expect(data.topReferrers[0].telegram_user_id).toBe("111111111")
      expect(data.topReferrers[0].referrals_count).toBe(25)
      expect(data.topReferrers[0].balance).toBe(5000.0)
      expect(data.topReferrers[0].conversions).toBe(12)
    })

    it("should include recent earnings list", async () => {
      mockSql
        .mockResolvedValueOnce([mockStatsResult])
        .mockResolvedValueOnce([mockFunnelResult])
        .mockResolvedValueOnce(mockTopReferrers)
        .mockResolvedValueOnce(mockRecentEarnings)

      const response = await getReferralStats()
      const data = await response.json()

      expect(data.recentEarnings).toHaveLength(2)
      expect(data.recentEarnings[0].referrer_telegram_id).toBe("111111111")
      expect(data.recentEarnings[0].referred_telegram_id).toBe("333333333")
      expect(data.recentEarnings[0].amount).toBe(500.0)
      expect(data.recentEarnings[0].status).toBe("confirmed")
    })

    it("should handle zero stats gracefully", async () => {
      const emptyStats = {
        total_codes: 0,
        total_referrals: 0,
        total_earnings: 0,
        pending_balance: 0,
        total_withdrawn: 0,
        pending_withdrawals: 0,
      }

      mockSql
        .mockResolvedValueOnce([emptyStats])
        .mockResolvedValueOnce([{ registered: 0, paid: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const response = await getReferralStats()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.stats.total_codes).toBe(0)
      expect(data.topReferrers).toHaveLength(0)
      expect(data.recentEarnings).toHaveLength(0)
    })

    it("should parse numeric values correctly", async () => {
      mockSql
        .mockResolvedValueOnce([mockStatsResult])
        .mockResolvedValueOnce([mockFunnelResult])
        .mockResolvedValueOnce(mockTopReferrers)
        .mockResolvedValueOnce(mockRecentEarnings)

      const response = await getReferralStats()
      const data = await response.json()

      expect(typeof data.stats.total_codes).toBe("number")
      expect(typeof data.stats.total_earnings).toBe("number")
      expect(typeof data.topReferrers[0].balance).toBe("number")
    })
  })

  describe("Authentication", () => {
    it("should return 401 without session", async () => {
      ;(getCurrentSession as jest.Mock).mockResolvedValue(null)

      const response = await getReferralStats()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Database connection failed"))

      const response = await getReferralStats()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe("Failed to fetch referral stats")
    })
  })
})

// ============================================================================
// TEST SUITE: GET /api/admin/referrals/withdrawals (List)
// ============================================================================

describe("GET /api/admin/referrals/withdrawals (List)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = "postgresql://test"
    ;(getCurrentSession as jest.Mock).mockResolvedValue(mockSession)
  })

  describe("Success Cases", () => {
    it("should return withdrawals with pagination", async () => {
      mockSql
        .mockResolvedValueOnce([{ count: "50" }])
        .mockResolvedValueOnce(mockWithdrawals)

      const request = createRequest("/api/admin/referrals/withdrawals")
      const response = await getWithdrawals(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.withdrawals).toHaveLength(2)
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.total).toBe(50)
      expect(data.pagination.totalPages).toBe(3)
    })

    it("should filter by status", async () => {
      mockSql
        .mockResolvedValueOnce([{ count: "5" }])
        .mockResolvedValueOnce([mockWithdrawals[0]])

      const request = createRequest("/api/admin/referrals/withdrawals?status=pending")
      const response = await getWithdrawals(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.withdrawals).toHaveLength(1)
      expect(data.withdrawals[0].status).toBe("pending")
    })

    it("should respect custom pagination", async () => {
      mockSql
        .mockResolvedValueOnce([{ count: "100" }])
        .mockResolvedValueOnce([mockWithdrawals[0]])

      const request = createRequest(
        "/api/admin/referrals/withdrawals?page=3&limit=10"
      )
      const response = await getWithdrawals(request)
      const data = await response.json()

      expect(data.pagination.page).toBe(3)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.totalPages).toBe(10)
    })

    it("should include user telegram info", async () => {
      mockSql
        .mockResolvedValueOnce([{ count: "2" }])
        .mockResolvedValueOnce(mockWithdrawals)

      const request = createRequest("/api/admin/referrals/withdrawals")
      const response = await getWithdrawals(request)
      const data = await response.json()

      expect(data.withdrawals[0].telegram_user_id).toBe("111111111")
      expect(data.withdrawals[1].telegram_user_id).toBe("222222222")
    })

    it("should include withdrawal details", async () => {
      mockSql
        .mockResolvedValueOnce([{ count: "1" }])
        .mockResolvedValueOnce([mockWithdrawals[0]])

      const request = createRequest("/api/admin/referrals/withdrawals")
      const response = await getWithdrawals(request)
      const data = await response.json()

      const withdrawal = data.withdrawals[0]
      expect(withdrawal.amount).toBe(5000.0)
      expect(withdrawal.ndfl_amount).toBe(650.0)
      expect(withdrawal.payout_amount).toBe(4350.0)
      expect(withdrawal.method).toBe("card")
      expect(withdrawal.card_number).toBe("1234")
      expect(withdrawal.current_balance).toBe(5000.0)
    })

    it("should handle empty results", async () => {
      mockSql.mockResolvedValueOnce([{ count: "0" }]).mockResolvedValueOnce([])

      const request = createRequest("/api/admin/referrals/withdrawals?status=rejected")
      const response = await getWithdrawals(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.withdrawals).toHaveLength(0)
      expect(data.pagination.total).toBe(0)
    })
  })

  describe("Authentication", () => {
    it("should return 401 without session", async () => {
      ;(getCurrentSession as jest.Mock).mockResolvedValue(null)

      const request = createRequest("/api/admin/referrals/withdrawals")
      const response = await getWithdrawals(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Database error"))

      const request = createRequest("/api/admin/referrals/withdrawals")
      const response = await getWithdrawals(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe("Failed to fetch withdrawals")
    })
  })
})

// ============================================================================
// TEST SUITE: POST /api/admin/referrals/withdrawals/[id]
// ============================================================================

describe("POST /api/admin/referrals/withdrawals/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = "postgresql://test"
    ;(getCurrentSession as jest.Mock).mockResolvedValue(mockSession)
    ;(logAdminAction as jest.Mock).mockResolvedValue(undefined)
  })

  describe("Approve Withdrawal", () => {
    it("should approve withdrawal successfully", async () => {
      const withdrawal = {
        id: 1,
        user_id: 1,
        amount: 5000.0,
        payout_amount: 4350.0,
        status: "pending",
        balance: 5000.0,
      }

      mockSql
        .mockResolvedValueOnce([withdrawal])
        .mockResolvedValueOnce([
          { withdrawal_updated: 1, balance_updated: 1 },
        ])

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest.fn().mockResolvedValue({ action: "approve" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.action).toBe("approve")
      expect(data.withdrawalId).toBe(1)
    })

    it("should log admin action on approval", async () => {
      const withdrawal = {
        id: 1,
        user_id: 1,
        amount: 5000.0,
        payout_amount: 4350.0,
        status: "pending",
        balance: 5000.0,
      }

      mockSql
        .mockResolvedValueOnce([withdrawal])
        .mockResolvedValueOnce([
          { withdrawal_updated: 1, balance_updated: 1 },
        ])

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest.fn().mockResolvedValue({ action: "approve" })

      await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })

      expect(logAdminAction).toHaveBeenCalledWith({
        adminId: 1,
        action: "withdrawal_approved",
        targetType: "withdrawal",
        targetId: 1,
        metadata: {
          user_id: 1,
          amount: 5000.0,
          payout_amount: 4350.0,
        },
      })
    })

    it("should return 400 if insufficient balance", async () => {
      const withdrawal = {
        id: 1,
        user_id: 1,
        amount: 5000.0,
        payout_amount: 4350.0,
        status: "pending",
        balance: 3000.0,
      }

      mockSql.mockResolvedValueOnce([withdrawal])

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest.fn().mockResolvedValue({ action: "approve" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("Insufficient balance")
    })

    it("should return 409 if withdrawal already processed", async () => {
      const withdrawal = {
        id: 1,
        user_id: 1,
        amount: 5000.0,
        payout_amount: 4350.0,
        status: "pending",
        balance: 5000.0,
      }

      mockSql
        .mockResolvedValueOnce([withdrawal])
        .mockResolvedValueOnce([
          { withdrawal_updated: null, balance_updated: null },
        ])

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest.fn().mockResolvedValue({ action: "approve" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain("already processed")
    })
  })

  describe("Reject Withdrawal", () => {
    it("should reject withdrawal successfully", async () => {
      const withdrawal = {
        id: 1,
        user_id: 1,
        amount: 5000.0,
        status: "pending",
        balance: 5000.0,
      }

      mockSql.mockResolvedValueOnce([withdrawal]).mockResolvedValueOnce([])

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest
        .fn()
        .mockResolvedValue({ action: "reject", reason: "Invalid data" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.action).toBe("reject")
    })

    it("should include rejection reason in audit log", async () => {
      const withdrawal = {
        id: 1,
        user_id: 1,
        amount: 5000.0,
        status: "pending",
        balance: 5000.0,
      }

      mockSql.mockResolvedValueOnce([withdrawal]).mockResolvedValueOnce([])

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest
        .fn()
        .mockResolvedValue({ action: "reject", reason: "Suspicious activity" })

      await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })

      expect(logAdminAction).toHaveBeenCalledWith({
        adminId: 1,
        action: "withdrawal_rejected",
        targetType: "withdrawal",
        targetId: 1,
        metadata: {
          user_id: 1,
          amount: 5000.0,
          reason: "Suspicious activity",
        },
      })
    })

    it("should use default reason if not provided", async () => {
      const withdrawal = {
        id: 1,
        user_id: 1,
        amount: 5000.0,
        status: "pending",
        balance: 5000.0,
      }

      mockSql.mockResolvedValueOnce([withdrawal]).mockResolvedValueOnce([])

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest.fn().mockResolvedValue({ action: "reject" })

      await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })

      expect(logAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            reason: "No reason provided",
          }),
        })
      )
    })
  })

  describe("Validation", () => {
    beforeEach(() => {
      jest.clearAllMocks()
      mockSql.mockReset() // Full reset instead of just clear
      ;(getCurrentSession as jest.Mock).mockResolvedValue(mockSession)
      ;(logAdminAction as jest.Mock).mockResolvedValue(undefined)
    })

    it("should return 404 for non-existent withdrawal", async () => {
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/admin/referrals/withdrawals/999")
      request.json = jest.fn().mockResolvedValue({ action: "approve" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "999" }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe("Withdrawal not found")
    })

    it("should return 400 for invalid withdrawal ID", async () => {
      const request = createRequest("/api/admin/referrals/withdrawals/abc")
      request.json = jest.fn().mockResolvedValue({ action: "approve" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "abc" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("Invalid withdrawal ID")
    })

    it("should return 400 for invalid action", async () => {
      const withdrawal = {
        id: 1,
        user_id: 1,
        amount: 5000.0,
        status: "pending",
        balance: 5000.0,
      }

      mockSql.mockResolvedValueOnce([withdrawal])

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest.fn().mockResolvedValue({ action: "delete" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("Invalid action")
    })

    it("should return 400 for non-pending withdrawal", async () => {
      const withdrawal = {
        id: 1,
        user_id: 1,
        amount: 5000.0,
        payout_amount: 4350.0,
        status: "approved",
        balance: 5000.0,
      }

      mockSql.mockResolvedValueOnce([withdrawal])

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest.fn().mockResolvedValue({ action: "approve" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("Cannot approve withdrawal with status: approved")
    })
  })

  describe("Authentication", () => {
    it("should return 401 without session", async () => {
      ;(getCurrentSession as jest.Mock).mockResolvedValue(null)

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest.fn().mockResolvedValue({ action: "approve" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Database error"))

      const request = createRequest("/api/admin/referrals/withdrawals/1")
      request.json = jest.fn().mockResolvedValue({ action: "approve" })

      const response = await processWithdrawal(request, {
        params: Promise.resolve({ id: "1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe("Failed to process withdrawal")
    })
  })
})
