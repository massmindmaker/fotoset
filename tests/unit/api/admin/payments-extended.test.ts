/**
 * Unit Tests for Admin Payment Extended Routes
 *
 * POST /api/admin/payments/refund: Process payment refund
 * GET /api/admin/payments/[paymentId]: Get single payment details
 */

import { NextRequest } from "next/server"

// ============================================================================
// MOCKS
// ============================================================================

const mockSql = jest.fn()
const mockNeonSql = jest.fn()
const mockGetCurrentSession = jest.fn()
const mockCancelPayment = jest.fn()
const mockLogAdminAction = jest.fn()

jest.mock("@/lib/db", () => ({
  sql: Object.assign((...args: any[]) => mockSql(...args), {
    unsafe: (str: string) => str,
  }),
}))

jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => mockNeonSql),
}))

jest.mock("@/lib/admin/session", () => ({
  getCurrentSession: mockGetCurrentSession,
}))

jest.mock("@/lib/tbank", () => ({
  cancelPayment: mockCancelPayment,
}))

jest.mock("@/lib/admin/audit", () => ({
  logAdminAction: mockLogAdminAction,
}))

// ============================================================================
// IMPORTS
// ============================================================================

import { POST as RefundPOST } from "@/app/api/admin/payments/refund/route"
import { GET as PaymentDetailGET } from "@/app/api/admin/payments/[paymentId]/route"

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string, body?: any): NextRequest {
  const request = new NextRequest(`http://localhost:3000${url}`, {
    method: body ? "POST" : "GET",
    ...(body && { body: JSON.stringify(body) }),
  })
  return request
}

function createMockContext(paymentId: string) {
  return {
    params: Promise.resolve({ paymentId }),
  }
}

// ============================================================================
// TEST DATA
// ============================================================================

const mockSession = {
  adminId: 1,
  telegramUserId: 123456789,
  username: "admin_test",
  role: "admin",
}

const mockPayment = {
  id: 1,
  tbank_payment_id: "pay_123456",
  user_id: 1,
  telegram_user_id: 111111111,
  amount: 1000,
  currency: "RUB",
  status: "succeeded",
  tier_id: "standard",
  photo_count: 15,
  refund_amount: 0,
  refund_status: null,
  refund_reason: null,
  refund_at: null,
  created_at: new Date("2025-12-20T10:00:00Z"),
  updated_at: new Date("2025-12-20T10:00:00Z"),
}

const mockTBankSuccessResponse = {
  Success: true,
  ErrorCode: "0",
  TerminalKey: "test_terminal",
  Status: "REFUNDED",
  PaymentId: "pay_123456",
  OrderId: "order_1",
  OriginalAmount: 100000,
  NewAmount: 0,
}

// ============================================================================
// TESTS: POST /api/admin/payments/refund
// ============================================================================

describe("POST /api/admin/payments/refund", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentSession.mockResolvedValue(mockSession)
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test"
  })

  describe("Successful Refunds", () => {
    it("should process full refund successfully", async () => {
      const updatedPayment = {
        ...mockPayment,
        refund_amount: 1000,
        refund_status: "full",
        refund_reason: "Customer request",
        status: "refunded",
      }

      // Mock 4 SQL calls (GET, sql`NOW()`, UPDATE, GET)
      mockSql
        .mockResolvedValueOnce([mockPayment]) // 1. GET payment
        .mockReturnValueOnce("NOW()") // 2. sql`NOW()` for refund_at
        .mockResolvedValueOnce([]) // 3. UPDATE payment
        .mockResolvedValueOnce([updatedPayment]) // 4. GET updated payment
      mockCancelPayment.mockResolvedValueOnce(mockTBankSuccessResponse)
      mockLogAdminAction.mockResolvedValueOnce(undefined)

      const request = createRequest("/api/admin/payments/refund", {
        paymentId: 1,
        reason: "Customer request",
      })

      const response = await RefundPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.payment.refund_amount).toBe(1000)
      expect(data.data.payment.status).toBe("refunded")
      expect(mockSql).toHaveBeenCalledTimes(4)
    })

    it("should process partial refund successfully", async () => {
      // Partial refund uses sql`NOW()` for refund_at
      mockSql
        .mockResolvedValueOnce([mockPayment])
        .mockReturnValueOnce("NOW()")
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            ...mockPayment,
            refund_amount: 500,
            refund_status: "partial",
            refund_reason: "Partial issue",
          },
        ])
      mockCancelPayment.mockResolvedValueOnce(mockTBankSuccessResponse)
      mockLogAdminAction.mockResolvedValueOnce(undefined)

      const request = createRequest("/api/admin/payments/refund", {
        paymentId: 1,
        amount: 500,
        reason: "Partial issue",
      })

      const response = await RefundPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.payment.refund_amount).toBe(500)
      expect(data.data.payment.refund_status).toBe("partial")
    })

    it("should log audit action on success", async () => {
      mockSql.mockResolvedValueOnce([mockPayment])
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([{ ...mockPayment, refund_amount: 1000 }])
      mockCancelPayment.mockResolvedValueOnce(mockTBankSuccessResponse)
      mockLogAdminAction.mockResolvedValueOnce(undefined)

      const request = createRequest("/api/admin/payments/refund", {
        paymentId: 1,
        reason: "Test audit",
      })

      await RefundPOST(request)

      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 0,
          action: "REFUND_CREATED",
          targetType: "payment",
          targetId: 1,
          metadata: expect.objectContaining({
            amount: 1000,
            reason: "Test audit",
            isPartial: false,
            tbankStatus: "REFUNDED",
          }),
        })
      )
    })
  })

  describe("Validation Errors", () => {
    it("should return 400 when paymentId missing", async () => {
      const request = createRequest("/api/admin/payments/refund", {
        reason: "Test",
      })

      const response = await RefundPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INVALID_INPUT")
    })

    it("should return 400 when reason missing", async () => {
      const request = createRequest("/api/admin/payments/refund", {
        paymentId: 1,
      })

      const response = await RefundPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INVALID_INPUT")
    })

    it("should return 404 when payment not found", async () => {
      mockSql.mockResolvedValueOnce([])

      const request = createRequest("/api/admin/payments/refund", {
        paymentId: 999,
        reason: "Test",
      })

      const response = await RefundPOST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("NOT_FOUND")
    })

    it("should return 400 when payment not succeeded", async () => {
      mockSql.mockResolvedValueOnce([{ ...mockPayment, status: "pending" }])

      const request = createRequest("/api/admin/payments/refund", {
        paymentId: 1,
        reason: "Test",
      })

      const response = await RefundPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INVALID_STATUS")
    })
  })

  describe("T-Bank API Errors", () => {
    it("should handle T-Bank API error", async () => {
      mockSql.mockResolvedValueOnce([mockPayment])
      mockCancelPayment.mockRejectedValueOnce(new Error("T-Bank connection failed"))

      const request = createRequest("/api/admin/payments/refund", {
        paymentId: 1,
        reason: "Test",
      })

      const response = await RefundPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("REFUND_ERROR")
    })
  })

  describe("Database Errors", () => {
    it("should handle database error when fetching payment", async () => {
      mockSql.mockRejectedValueOnce(new Error("Database connection lost"))

      const request = createRequest("/api/admin/payments/refund", {
        paymentId: 1,
        reason: "Test",
      })

      const response = await RefundPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("REFUND_ERROR")
    })
  })
})

// ============================================================================
// TESTS: GET /api/admin/payments/[paymentId]
// ============================================================================

describe("GET /api/admin/payments/[paymentId]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentSession.mockResolvedValue(mockSession)
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test"
  })

  describe("Successful Retrieval", () => {
    it("should return full payment details", async () => {
      const mockDetailedPayment = {
        id: 1,
        tbank_payment_id: "pay_123456",
        user_id: 1,
        telegram_user_id: BigInt(111111111),
        amount: 1000,
        tier_id: "standard",
        photo_count: 15,
        status: "succeeded",
        email: "test@example.com",
        error_code: null,
        error_message: null,
        refund_id: null,
        refund_reason: null,
        created_at: new Date(),
        updated_at: new Date(),
        user_is_pro: true,
        avatar_id: 1,
        avatar_name: "Test Avatar",
        avatar_status: "ready",
        photos_generated: 15,
      }

      mockNeonSql.mockResolvedValueOnce([mockDetailedPayment])

      const request = createRequest("/api/admin/payments/1")
      const context = createMockContext("1")

      const response = await PaymentDetailGET(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.payment).toBeDefined()
      expect(data.payment.id).toBe(1)
      expect(data.payment.telegram_user_id).toBe("111111111")
    })

    it("should include refund info if present", async () => {
      const mockRefundedPayment = {
        id: 1,
        tbank_payment_id: "pay_123456",
        user_id: 1,
        telegram_user_id: BigInt(111111111),
        amount: 1000,
        tier_id: "standard",
        photo_count: 15,
        status: "refunded",
        email: "test@example.com",
        error_code: null,
        error_message: null,
        refund_id: "refund_789",
        refund_reason: "Customer request",
        created_at: new Date(),
        updated_at: new Date(),
        user_is_pro: true,
        avatar_id: 1,
        avatar_name: "Test Avatar",
        avatar_status: "ready",
        photos_generated: 15,
      }

      mockNeonSql.mockResolvedValueOnce([mockRefundedPayment])

      const request = createRequest("/api/admin/payments/1")
      const context = createMockContext("1")

      const response = await PaymentDetailGET(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.payment.refund_id).toBe("refund_789")
      expect(data.payment.refund_reason).toBe("Customer request")
    })
  })

  describe("Validation Errors", () => {
    it("should return 400 for invalid payment ID", async () => {
      const request = createRequest("/api/admin/payments/invalid")
      const context = createMockContext("invalid")

      const response = await PaymentDetailGET(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("Invalid payment ID")
    })

    it("should return 404 for non-existent payment", async () => {
      mockNeonSql.mockResolvedValueOnce([])

      const request = createRequest("/api/admin/payments/999")
      const context = createMockContext("999")

      const response = await PaymentDetailGET(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe("Payment not found")
    })
  })

  describe("Authentication & Authorization", () => {
    it("should return 401 without session", async () => {
      mockGetCurrentSession.mockResolvedValueOnce(null)

      const request = createRequest("/api/admin/payments/1")
      const context = createMockContext("1")

      const response = await PaymentDetailGET(request, context)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })
  })

  describe("Database Errors", () => {
    it("should handle database error gracefully", async () => {
      mockNeonSql.mockRejectedValueOnce(new Error("Database connection lost"))

      const request = createRequest("/api/admin/payments/1")
      const context = createMockContext("1")

      const response = await PaymentDetailGET(request, context)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe("Failed to fetch payment details")
    })
  })
})
