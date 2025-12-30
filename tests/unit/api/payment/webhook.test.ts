/**
 * Unit Tests for POST /api/payment/webhook
 *
 * Tests T-Bank webhook processing:
 * - Signature verification (SHA256)
 * - Status transitions (CONFIRMED, AUTHORIZED, REJECTED, REFUNDED, CANCELED)
 * - Referral earnings processing
 * - Idempotency (duplicate webhook handling)
 * - Security (payment validation, unknown payments)
 *
 * PRIORITY: P0 (Critical - Payment confirmation)
 * COVERAGE TARGET: 90%
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import {
  createTBankWebhook,
  createInvalidTBankWebhook,
} from '@/tests/fixtures/factory'

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockSql = jest.fn()
const mockQuery = jest.fn()
const mockVerifyWebhookSignature = jest.fn()

// Mock db module
jest.mock('@/lib/db', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  query: (...args: unknown[]) => mockQuery(...args),
}))

// Mock T-Bank signature verification
jest.mock('@/lib/tbank', () => ({
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
  HAS_CREDENTIALS: true,
}))

// Mock logger to suppress console output
jest.mock('@/lib/logger', () => ({
  paymentLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createWebhookRequest(payload: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/payment/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

/**
 * Setup mocks for a successful CONFIRMED webhook with referral processing
 *
 * Call order in webhook route:
 * 1. sql`INSERT INTO webhook_logs...` (non-blocking, returns Promise)
 * 2. sql`SELECT ... FROM payments WHERE tbank_payment_id = ?` (await)
 * 3. sql`UPDATE payments SET status = 'succeeded'...` (await, for CONFIRMED/AUTHORIZED)
 */
function setupConfirmedWebhookMocks(userId: number, hasReferrer = false) {
  // Configure sql mock to return a chainable Promise
  // 1. Webhook log insert (non-blocking) - returns Promise with .catch()
  const logPromise = Promise.resolve([])
  Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
  mockSql.mockReturnValueOnce(logPromise)

  // 2. Check payment exists (await)
  mockSql.mockResolvedValueOnce([{ id: 1, user_id: userId, status: 'pending' }])

  // 3. Update payment to succeeded (await)
  mockSql.mockResolvedValueOnce([{ id: 1, user_id: userId }])

  // processReferralEarning uses query():
  if (hasReferrer) {
    // Check referrer
    mockQuery.mockResolvedValueOnce({ rows: [{ referrer_id: 100 }] })
    // Total referrals count (diagnostic)
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] })
    // Get payment amount
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, amount: 999 }] })
    // Insert earning
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    // Update balance
    mockQuery.mockResolvedValueOnce({ rows: [] })
  } else {
    // No referrer
    mockQuery.mockResolvedValueOnce({ rows: [] })
    // Total referrals count (diagnostic)
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] })
  }
}

/**
 * Setup mocks for REJECTED/CANCELED webhook
 */
function setupRejectedWebhookMocks(userId: number) {
  // 1. Webhook log insert (non-blocking)
  const logPromise = Promise.resolve([])
  Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
  mockSql.mockReturnValueOnce(logPromise)

  // 2. Check payment exists (await)
  mockSql.mockResolvedValueOnce([{ id: 1, user_id: userId, status: 'pending' }])

  // 3. Update payment to canceled (await)
  mockSql.mockResolvedValueOnce([])
}

/**
 * Setup mocks for REFUNDED webhook
 */
function setupRefundedWebhookMocks(userId: number) {
  // 1. Webhook log insert (non-blocking)
  const logPromise = Promise.resolve([])
  Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
  mockSql.mockReturnValueOnce(logPromise)

  // 2. Check payment exists (await)
  mockSql.mockResolvedValueOnce([{ id: 1, user_id: userId, status: 'succeeded' }])

  // 3. Update payment to refunded (await)
  mockSql.mockResolvedValueOnce([])
}

// ============================================================================
// TESTS
// ============================================================================

describe('POST /api/payment/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TBANK_TERMINAL_KEY = 'TestDEMOKey'
    process.env.TBANK_PASSWORD = 'TestPassword'
  })

  afterEach(() => {
    delete process.env.TBANK_TERMINAL_KEY
    delete process.env.TBANK_PASSWORD
  })

  // ==========================================================================
  // HAPPY PATH TESTS
  // ==========================================================================

  describe('Happy Path - Status Processing', () => {
    test('WH-HP-001: should process CONFIRMED status and update payment to succeeded', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-123', 'CONFIRMED')

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupConfirmedWebhookMocks(5, false)

      const request = createWebhookRequest(webhook)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('WH-HP-002: should process AUTHORIZED status as success', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-456', 'AUTHORIZED')

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupConfirmedWebhookMocks(6, false)

      const request = createWebhookRequest(webhook)
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    test('WH-HP-003: should process REJECTED status and update to canceled', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-789', 'REJECTED')

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupRejectedWebhookMocks(7)

      const request = createWebhookRequest(webhook)
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    test('WH-HP-004: should process REFUNDED status', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-refund', 'REFUNDED')

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupRefundedWebhookMocks(8)

      const request = createWebhookRequest(webhook)
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    test('WH-HP-005: should process CANCELED status', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-cancel', 'CANCELED')

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupRejectedWebhookMocks(10)

      const request = createWebhookRequest(webhook)
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Happy Path - Referral Processing', () => {
    test('WH-HP-006: should trigger referral earning on CONFIRMED payment', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-ref-123', 'CONFIRMED')

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupConfirmedWebhookMocks(20, true) // User has referrer

      const request = createWebhookRequest(webhook)
      const response = await POST(request)

      expect(response.status).toBe(200)
      // Verify referral query was made
      expect(mockQuery).toHaveBeenCalled()
    })

    test('WH-HP-007: should NOT trigger referral on REJECTED payment', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-rej-456', 'REJECTED')

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupRejectedWebhookMocks(21)

      const request = createWebhookRequest(webhook)
      await POST(request)

      // No query calls for referral on rejected payment
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // SECURITY TESTS
  // ==========================================================================

  describe('Security - Signature Verification', () => {
    test('WH-SEC-001: should reject invalid signature with 403', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createInvalidTBankWebhook('pay-invalid-sig', 'CONFIRMED')

      // Webhook log insert (non-blocking)
      const logPromise = Promise.resolve([])
      Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
      mockSql.mockReturnValueOnce(logPromise)

      mockVerifyWebhookSignature.mockReturnValueOnce(false)

      const request = createWebhookRequest(webhook)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Invalid signature')
    })

    test('WH-SEC-002: should reject unknown PaymentId with 404', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-unknown-12345', 'CONFIRMED')

      // Webhook log insert (non-blocking)
      const logPromise = Promise.resolve([])
      Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
      mockSql.mockReturnValueOnce(logPromise)

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      // Check payment - not found
      mockSql.mockResolvedValueOnce([])

      const request = createWebhookRequest(webhook)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    test('WH-SEC-003: should not expose internal errors in response', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-db-error', 'CONFIRMED')

      // Webhook log insert (non-blocking)
      const logPromise = Promise.resolve([])
      Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
      mockSql.mockReturnValueOnce(logPromise)

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      // Database error on payment check
      mockSql.mockRejectedValueOnce(new Error('FATAL: connection timeout'))

      const request = createWebhookRequest(webhook)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).not.toContain('FATAL')
      expect(data.error).not.toContain('connection')
    })
  })

  // ==========================================================================
  // IDEMPOTENCY TESTS
  // ==========================================================================

  describe('Idempotency - Duplicate Webhooks', () => {
    test('WH-IDEM-001: should handle duplicate CONFIRMED webhook gracefully', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-duplicate', 'CONFIRMED')

      // Webhook log insert (non-blocking)
      const logPromise = Promise.resolve([])
      Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
      mockSql.mockReturnValueOnce(logPromise)

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      // Check payment exists
      mockSql.mockResolvedValueOnce([{ id: 20, user_id: 30, status: 'pending' }])
      // UPDATE with WHERE status='pending' returns empty (already processed by previous webhook)
      mockSql.mockResolvedValueOnce([])

      const request = createWebhookRequest(webhook)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('WH-IDEM-002: should not create duplicate referral earnings', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-ref-dup', 'CONFIRMED')

      // First call - use helper
      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupConfirmedWebhookMocks(31, true)

      const request1 = createWebhookRequest(webhook)
      await POST(request1)

      // Second call (duplicate)
      jest.clearAllMocks()

      // Webhook log insert (non-blocking)
      const logPromise = Promise.resolve([])
      Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
      mockSql.mockReturnValueOnce(logPromise)

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      // Check payment exists (already succeeded)
      mockSql.mockResolvedValueOnce([{ id: 21, user_id: 31, status: 'succeeded' }])
      // UPDATE returns empty because WHERE status='pending' doesn't match
      mockSql.mockResolvedValueOnce([])

      const request2 = createWebhookRequest(webhook)
      const response = await POST(request2)

      expect(response.status).toBe(200)
      // No query calls on duplicate (referral already processed)
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('Error Handling', () => {
    test('WH-ERR-001: should return 500 on database error', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-db-fail', 'CONFIRMED')

      // Webhook log insert (non-blocking)
      const logPromise = Promise.resolve([])
      Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
      mockSql.mockReturnValueOnce(logPromise)

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      // Database error on payment check
      mockSql.mockRejectedValueOnce(new Error('Database unavailable'))

      const request = createWebhookRequest(webhook)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    test('WH-ERR-002: should handle malformed JSON body', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')

      const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json{{{',
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })

    test('WH-ERR-003: should continue if referral processing fails', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-ref-fail', 'CONFIRMED')

      // Webhook log insert (non-blocking)
      const logPromise = Promise.resolve([])
      Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
      mockSql.mockReturnValueOnce(logPromise)

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      // Check payment exists
      mockSql.mockResolvedValueOnce([{ id: 31, user_id: 41, status: 'pending' }])
      // Update payment to succeeded
      mockSql.mockResolvedValueOnce([{ id: 31, user_id: 41 }])
      // Referral query fails
      mockQuery.mockRejectedValueOnce(new Error('Referral DB error'))

      const request = createWebhookRequest(webhook)
      const response = await POST(request)

      // Payment should still be marked as succeeded
      expect(response.status).toBe(200)
    })
  })

  // ==========================================================================
  // EDGE CASE TESTS
  // ==========================================================================

  describe('Edge Cases', () => {
    test('WH-EDGE-001: should handle unrecognized status codes', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = {
        ...createTBankWebhook('pay-unknown-status', 'CONFIRMED'),
        Status: 'UNKNOWN_STATUS_123',
      }

      // Webhook log insert (non-blocking)
      const logPromise = Promise.resolve([])
      Object.assign(logPromise, { catch: jest.fn().mockReturnThis() })
      mockSql.mockReturnValueOnce(logPromise)

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      // Check payment exists
      mockSql.mockResolvedValueOnce([{ id: 32, user_id: 42, status: 'pending' }])

      const request = createWebhookRequest(webhook)
      const response = await POST(request)

      // Should return 200 OK (T-Bank expects this)
      expect(response.status).toBe(200)
    })

    test('WH-EDGE-002: should accept webhook with extra unknown fields', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = {
        ...createTBankWebhook('pay-extra-fields', 'CONFIRMED'),
        ExtraField1: 'value1',
        ExtraField2: 123,
        NestedExtra: { a: 1, b: 2 },
      }

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupConfirmedWebhookMocks(44, false)

      const request = createWebhookRequest(webhook)
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  // ==========================================================================
  // T-BANK RESPONSE FORMAT TESTS
  // ==========================================================================

  describe('T-Bank Response Format', () => {
    test('WH-RESP-001: should return { success: true } on successful processing', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-resp-test', 'CONFIRMED')

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupConfirmedWebhookMocks(45, false)

      const request = createWebhookRequest(webhook)
      const response = await POST(request)
      const data = await response.json()

      expect(data).toEqual({ success: true })
    })

    test('WH-RESP-002: should return 200 status for T-Bank acknowledgment', async () => {
      const { POST } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook('pay-ack-test', 'CONFIRMED')

      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      setupConfirmedWebhookMocks(46, false)

      const request = createWebhookRequest(webhook)
      const response = await POST(request)

      // T-Bank requires 200 OK to stop retrying
      expect(response.status).toBe(200)
    })
  })
})
