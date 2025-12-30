/**
 * Unit Tests for /api/admin/payments
 *
 * GET: Получить список платежей с фильтрами и пагинацией
 */

import { NextRequest } from "next/server"

// ============================================================================
// MOCKS
// ============================================================================

const mockSql = jest.fn()
// Mock sql.unsafe for dynamic WHERE clause
mockSql.unsafe = (str: string) => str

jest.mock("@/lib/db", () => ({
  sql: Object.assign((...args: any[]) => mockSql(...args), {
    unsafe: (str: string) => str,
  }),
}))

// ============================================================================
// IMPORTS
// ============================================================================

import { GET } from "@/app/api/admin/payments/route"

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`)
}

// ============================================================================
// TEST DATA
// ============================================================================

const mockPayments = [
  {
    id: 1,
    tbank_payment_id: "pay_123",
    user_id: 1,
    telegram_user_id: 111111111,
    amount: 999,
    currency: "RUB",
    status: "succeeded",
    tier_id: "standard",
    photo_count: 15,
    refund_amount: null,
    refund_status: null,
    refund_reason: null,
    refund_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 2,
    tbank_payment_id: "pay_456",
    user_id: 2,
    telegram_user_id: 222222222,
    amount: 499,
    currency: "RUB",
    status: "pending",
    tier_id: "starter",
    photo_count: 7,
    refund_amount: null,
    refund_status: null,
    refund_reason: null,
    refund_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  },
]

// ============================================================================
// TESTS
// ============================================================================

describe("GET /api/admin/payments", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Basic Listing", () => {
    it("should return payments with default pagination", async () => {
      mockSql.mockResolvedValueOnce([{ total: "2" }])
      mockSql.mockResolvedValueOnce(mockPayments)

      const request = createRequest("/api/admin/payments")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.payments).toHaveLength(2)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.limit).toBe(20)
    })

    it("should respect custom pagination", async () => {
      mockSql.mockResolvedValueOnce([{ total: "100" }])
      mockSql.mockResolvedValueOnce([mockPayments[0]])

      const request = createRequest("/api/admin/payments?page=5&limit=10")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination.page).toBe(5)
      expect(data.data.pagination.limit).toBe(10)
      expect(data.data.pagination.totalPages).toBe(10)
    })

    it("should limit pagination to max 100", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1000" }])
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/admin/payments?limit=500")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination.limit).toBe(100)
    })
  })

  describe("Filtering", () => {
    it("should filter by status", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockPayments[0]])

      const request = createRequest("/api/admin/payments?status=succeeded")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.payments).toHaveLength(1)
    })

    it("should filter by telegram user id", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockPayments[0]])

      const request = createRequest("/api/admin/payments?telegramUserId=111111111")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.payments).toHaveLength(1)
    })

    it("should filter by amount range", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockPayments[0]])

      const request = createRequest("/api/admin/payments?amountMin=500&amountMax=1000")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })

    it("should filter by tier", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockPayments[1]])

      const request = createRequest("/api/admin/payments?tierId=starter")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })

    it("should filter by date range", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockPayments[0]])

      const request = createRequest(
        "/api/admin/payments?dateFrom=2025-01-01&dateTo=2025-12-31"
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })
  })

  describe("Payment Data", () => {
    it("should include all required payment fields", async () => {
      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([mockPayments[0]])

      const request = createRequest("/api/admin/payments")

      const response = await GET(request)
      const data = await response.json()

      const payment = data.data.payments[0]
      expect(payment.id).toBeDefined()
      expect(payment.tbank_payment_id).toBeDefined()
      expect(payment.telegram_user_id).toBeDefined()
      expect(payment.amount).toBeDefined()
      expect(payment.status).toBeDefined()
      expect(payment.tier_id).toBeDefined()
      expect(payment.photo_count).toBeDefined()
    })

    it("should include refund info when present", async () => {
      const refundedPayment = {
        ...mockPayments[0],
        refund_amount: 999,
        refund_status: "succeeded",
        refund_reason: "Generation failed",
        refund_at: new Date(),
      }

      mockSql.mockResolvedValueOnce([{ total: "1" }])
      mockSql.mockResolvedValueOnce([refundedPayment])

      const request = createRequest("/api/admin/payments")

      const response = await GET(request)
      const data = await response.json()

      const payment = data.data.payments[0]
      expect(payment.refund_amount).toBe(999)
      expect(payment.refund_status).toBe("succeeded")
      expect(payment.refund_reason).toBe("Generation failed")
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      mockSql.mockRejectedValueOnce(new Error("Connection lost"))

      const request = createRequest("/api/admin/payments")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("FETCH_ERROR")
    })
  })
})
