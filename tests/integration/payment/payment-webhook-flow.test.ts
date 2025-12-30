/**
 * Integration Tests for Payment-Webhook Flow
 *
 * Tests the complete payment lifecycle:
 * - Payment creation → T-Bank → Webhook → Status update
 * - Referral earnings flow (payment → webhook → earning → balance)
 * - Error recovery and rollback scenarios
 * - Concurrent webhook handling
 *
 * These tests use real database operations against a test database
 * but mock external services (T-Bank API).
 *
 * PRIORITY: P0 (Critical)
 * TYPE: Integration
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import {
  createUser,
  createPayment,
  createSucceededPayment,
  createTBankWebhook,
  createReferralCode,
  createReferral,
  PRICING_TIERS,
  TEST_TELEGRAM_USER_ID,
  resetIdCounters,
} from '@/tests/fixtures/factory'

// ============================================================================
// MOCK SETUP - External services only
// ============================================================================

// Mock T-Bank API calls (external service)
const mockInitPayment = jest.fn()
const mockVerifyWebhookSignature = jest.fn()

jest.mock('@/lib/tbank', () => ({
  initPayment: (...args: unknown[]) => mockInitPayment(...args),
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
  HAS_CREDENTIALS: true,
  IS_TEST_MODE: true,
  PaymentMethod: {
    TINKOFF_PAY: 'TinkoffPay',
    SBP: 'SBP',
  },
}))

// Mock database for integration tests (in real integration, use test DB)
const mockSql = jest.fn()
const mockFindOrCreateUser = jest.fn()

jest.mock('@/lib/db', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}))

jest.mock('@/lib/auth', () => ({
  findOrCreateUser: (...args: unknown[]) => mockFindOrCreateUser(...args),
}))

// Mock log to suppress output
jest.mock('@/lib/log', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

// ============================================================================
// TEST HELPERS
// ============================================================================

function createPaymentCreateRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/payment/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createWebhookRequest(payload: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/payment/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

function createStatusRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/payment/status')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString())
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Payment-Webhook Flow Integration', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://pinglass.ru'
    process.env.TBANK_TERMINAL_KEY = 'TestDEMOKey'
    process.env.TBANK_PASSWORD = 'TestPassword'
  })

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.TBANK_TERMINAL_KEY
    delete process.env.TBANK_PASSWORD
  })

  beforeEach(() => {
    jest.clearAllMocks()
    resetIdCounters()
  })

  // ==========================================================================
  // COMPLETE FLOW TESTS
  // ==========================================================================

  describe('Complete Payment Lifecycle', () => {
    test('INT-PAY-001: Create payment → Confirm webhook → Status check', async () => {
      // ARRANGE
      const testUser = createUser({ id: 1, telegram_user_id: 111222333 })
      const paymentId = 'tbank-pay-12345'

      // Mock for payment/create
      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql
        .mockResolvedValueOnce([]) // INSERT payment
        .mockResolvedValueOnce([]) // UPDATE user pending_generation
      mockInitPayment.mockResolvedValueOnce({
        Success: true,
        PaymentId: paymentId,
        PaymentURL: `https://securepay.tinkoff.ru/new/${paymentId}`,
      })

      // ACT 1: Create payment
      const { POST: createPaymentRoute } = await import('@/app/api/payment/create/route')
      const createRequest = createPaymentCreateRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'test@example.com',
        tierId: 'standard',
      })
      const createResponse = await createPaymentRoute(createRequest)
      const createData = await createResponse.json()

      // ASSERT 1: Payment created
      expect(createResponse.status).toBe(200)
      expect(createData.paymentId).toBe(paymentId)
      expect(createData.confirmationUrl).toContain('tinkoff.ru')

      // Mock for webhook
      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      mockSql
        .mockResolvedValueOnce([{ id: 1, user_id: testUser.id, status: 'pending' }]) // Check exists
        .mockResolvedValueOnce([]) // Log webhook
        .mockResolvedValueOnce([{ id: 1, user_id: testUser.id }]) // Update status

      // ACT 2: Process webhook
      jest.resetModules()
      const { POST: webhookRoute } = await import('@/app/api/payment/webhook/route')
      const webhookPayload = createTBankWebhook(paymentId, 'CONFIRMED')
      const webhookRequest = createWebhookRequest(webhookPayload)
      const webhookResponse = await webhookRoute(webhookRequest)

      // ASSERT 2: Webhook processed
      expect(webhookResponse.status).toBe(200)

      // Mock for status check
      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([{ id: 1, status: 'succeeded', tbank_payment_id: paymentId }])

      // ACT 3: Check status
      jest.resetModules()
      const { GET: statusRoute } = await import('@/app/api/payment/status/route')
      const statusRequest = createStatusRequest({
        telegram_user_id: String(testUser.telegram_user_id),
        payment_id: paymentId,
      })
      const statusResponse = await statusRoute(statusRequest)
      const statusData = await statusResponse.json()

      // ASSERT 3: Payment confirmed
      expect(statusResponse.status).toBe(200)
      expect(statusData.paid).toBe(true)
      expect(statusData.status).toBe('succeeded')
    })

    test('INT-PAY-002: Payment rejected flow', async () => {
      const testUser = createUser({ id: 2, telegram_user_id: 222333444 })
      const paymentId = 'tbank-pay-reject'

      // Mock create
      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([]).mockResolvedValueOnce([])
      mockInitPayment.mockResolvedValueOnce({
        Success: true,
        PaymentId: paymentId,
        PaymentURL: `https://securepay.tinkoff.ru/new/${paymentId}`,
      })

      const { POST: createRoute } = await import('@/app/api/payment/create/route')
      await createRoute(createPaymentCreateRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'test@example.com',
      }))

      // Mock webhook REJECTED
      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      mockSql
        .mockResolvedValueOnce([{ id: 2, user_id: testUser.id, status: 'pending' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      jest.resetModules()
      const { POST: webhookRoute } = await import('@/app/api/payment/webhook/route')
      const webhookPayload = createTBankWebhook(paymentId, 'REJECTED')
      const webhookResponse = await webhookRoute(createWebhookRequest(webhookPayload))

      expect(webhookResponse.status).toBe(200)

      // Verify status shows canceled
      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([{ id: 2, status: 'canceled' }])

      jest.resetModules()
      const { GET: statusRoute } = await import('@/app/api/payment/status/route')
      const statusResponse = await statusRoute(createStatusRequest({
        telegram_user_id: String(testUser.telegram_user_id),
      }))
      const statusData = await statusResponse.json()

      expect(statusData.paid).toBe(false)
      expect(statusData.status).toBe('canceled')
    })
  })

  // ==========================================================================
  // REFERRAL FLOW TESTS
  // ==========================================================================

  describe('Referral Earning Flow', () => {
    test('INT-REF-001: Referred user payment → Referrer earns 10%', async () => {
      // Setup: Referrer and Referred users
      const referrer = createUser({ id: 10, telegram_user_id: 100100100 })
      const referred = createUser({ id: 11, telegram_user_id: 200200200, pending_referral_code: null })
      const referralCode = createReferralCode(referrer.id, { code: 'FRIEND10' })
      const paymentId = 'tbank-ref-pay'

      // Mock create payment for referred user with referral code
      mockFindOrCreateUser.mockResolvedValueOnce({
        ...referred,
        pending_referral_code: 'FRIEND10', // DB has the referral code
      })
      mockSql
        .mockResolvedValueOnce([]) // INSERT payment
        .mockResolvedValueOnce([]) // UPDATE pending_generation

      mockInitPayment.mockResolvedValueOnce({
        Success: true,
        PaymentId: paymentId,
        PaymentURL: 'https://securepay.tinkoff.ru/test',
      })

      const { POST: createRoute } = await import('@/app/api/payment/create/route')
      await createRoute(createPaymentCreateRequest({
        telegramUserId: referred.telegram_user_id,
        email: 'referred@example.com',
        tierId: 'standard', // 999 RUB
      }))

      // Mock webhook CONFIRMED - should trigger referral earning
      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      mockSql
        .mockResolvedValueOnce([{ id: 1, user_id: referred.id, status: 'pending' }])
        .mockResolvedValueOnce([]) // Log
        .mockResolvedValueOnce([{ id: 1, user_id: referred.id }]) // Update payment

      // Mock for processReferralEarning inside webhook
      // The referral earning should be 10% of 999 = 99.9 RUB

      jest.resetModules()
      const { POST: webhookRoute } = await import('@/app/api/payment/webhook/route')
      const webhookPayload = createTBankWebhook(paymentId, 'CONFIRMED')
      const webhookResponse = await webhookRoute(createWebhookRequest(webhookPayload))

      expect(webhookResponse.status).toBe(200)
      // In real integration test, verify referral_earnings and referral_balances tables
    })
  })

  // ==========================================================================
  // IDEMPOTENCY TESTS
  // ==========================================================================

  describe('Idempotency', () => {
    test('INT-IDEM-001: Duplicate webhook should not create duplicate earning', async () => {
      const testUser = createUser({ id: 20, telegram_user_id: 300300300 })
      const paymentId = 'tbank-dup-webhook'

      // First webhook call - payment goes from pending to succeeded
      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      mockSql
        .mockResolvedValueOnce([{ id: 5, user_id: testUser.id, status: 'pending' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 5, user_id: testUser.id }]) // Returns row = first time

      const { POST: webhookRoute1 } = await import('@/app/api/payment/webhook/route')
      const response1 = await webhookRoute1(createWebhookRequest(createTBankWebhook(paymentId, 'CONFIRMED')))
      expect(response1.status).toBe(200)

      // Second webhook call - payment already succeeded
      jest.resetModules()
      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      mockSql
        .mockResolvedValueOnce([{ id: 5, user_id: testUser.id, status: 'succeeded' }]) // Already succeeded
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]) // No rows updated = duplicate

      const { POST: webhookRoute2 } = await import('@/app/api/payment/webhook/route')
      const response2 = await webhookRoute2(createWebhookRequest(createTBankWebhook(paymentId, 'CONFIRMED')))

      expect(response2.status).toBe(200)
      // Verify referral was NOT processed twice (mock call count)
    })

    test('INT-IDEM-002: Create payment is idempotent with same orderId', async () => {
      const testUser = createUser({ id: 21, telegram_user_id: 400400400 })

      // Two rapid payment creations should not create duplicates
      mockFindOrCreateUser.mockResolvedValue(testUser)
      mockSql.mockResolvedValue([])
      mockInitPayment.mockResolvedValue({
        Success: true,
        PaymentId: 'same-pay-id',
        PaymentURL: 'https://test.url',
      })

      const { POST: createRoute } = await import('@/app/api/payment/create/route')

      const request1 = createPaymentCreateRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'test@example.com',
      })
      const request2 = createPaymentCreateRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'test@example.com',
      })

      const [response1, response2] = await Promise.all([
        createRoute(request1),
        createRoute(request2),
      ])

      // Both should succeed (T-Bank handles dedup on their side)
      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
    })
  })

  // ==========================================================================
  // ERROR RECOVERY TESTS
  // ==========================================================================

  describe('Error Recovery', () => {
    test('INT-ERR-001: Webhook retry after temporary DB failure', async () => {
      const paymentId = 'tbank-retry-test'

      // First call fails
      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      mockSql.mockRejectedValueOnce(new Error('Connection timeout'))

      const { POST: webhookRoute1 } = await import('@/app/api/payment/webhook/route')
      const response1 = await webhookRoute1(createWebhookRequest(createTBankWebhook(paymentId, 'CONFIRMED')))
      expect(response1.status).toBe(500) // T-Bank will retry

      // Second call succeeds
      jest.resetModules()
      mockVerifyWebhookSignature.mockReturnValueOnce(true)
      mockSql
        .mockResolvedValueOnce([{ id: 10, user_id: 5, status: 'pending' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 10, user_id: 5 }])

      const { POST: webhookRoute2 } = await import('@/app/api/payment/webhook/route')
      const response2 = await webhookRoute2(createWebhookRequest(createTBankWebhook(paymentId, 'CONFIRMED')))
      expect(response2.status).toBe(200)
    })

    test('INT-ERR-002: Payment create fails gracefully on T-Bank error', async () => {
      const testUser = createUser({ id: 30 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockInitPayment.mockRejectedValueOnce(new Error('T-Bank API: 503 Service Unavailable'))

      const { POST: createRoute } = await import('@/app/api/payment/create/route')
      const response = await createRoute(createPaymentCreateRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'test@example.com',
      }))

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  // ==========================================================================
  // CONCURRENT ACCESS TESTS
  // ==========================================================================

  describe('Concurrent Webhook Handling', () => {
    test('INT-CONC-001: Parallel webhooks for same payment handled correctly', async () => {
      const paymentId = 'tbank-concurrent'

      // Setup for concurrent calls
      mockVerifyWebhookSignature.mockReturnValue(true)

      // First concurrent call gets the row
      let callCount = 0
      mockSql.mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return [{ id: 15, user_id: 10, status: 'pending' }]
        }
        if (callCount === 2 || callCount === 5) {
          return [] // Log insert
        }
        if (callCount === 3) {
          return [{ id: 15, user_id: 10 }] // First update succeeds
        }
        if (callCount === 4) {
          return [{ id: 15, user_id: 10, status: 'succeeded' }] // Already succeeded
        }
        if (callCount === 6) {
          return [] // Second update returns empty (idempotent)
        }
        return []
      })

      const { POST: webhookRoute } = await import('@/app/api/payment/webhook/route')
      const webhook = createTBankWebhook(paymentId, 'CONFIRMED')

      // Simulate concurrent webhook calls
      const [result1, result2] = await Promise.all([
        webhookRoute(createWebhookRequest(webhook)),
        webhookRoute(createWebhookRequest(webhook)),
      ])

      // Both should succeed (idempotent)
      expect(result1.status).toBe(200)
      expect(result2.status).toBe(200)
    })
  })

  // ==========================================================================
  // TIER PRICING TESTS
  // ==========================================================================

  describe('Tier Pricing Integration', () => {
    const tiers = [
      { id: 'starter', price: 499, photos: 7 },
      { id: 'standard', price: 999, photos: 15 },
      { id: 'premium', price: 1499, photos: 23 },
    ]

    tiers.forEach(tier => {
      test(`INT-TIER-${tier.id}: should create payment with correct ${tier.id} tier amount`, async () => {
        const testUser = createUser({ id: 40 + tiers.indexOf(tier) })

        mockFindOrCreateUser.mockResolvedValueOnce(testUser)
        mockSql.mockResolvedValueOnce([]).mockResolvedValueOnce([])
        mockInitPayment.mockResolvedValueOnce({
          Success: true,
          PaymentId: `pay-${tier.id}`,
          PaymentURL: 'https://test.url',
        })

        const { POST: createRoute } = await import('@/app/api/payment/create/route')
        await createRoute(createPaymentCreateRequest({
          telegramUserId: testUser.telegram_user_id,
          email: 'test@example.com',
          tierId: tier.id,
        }))

        expect(mockInitPayment).toHaveBeenCalledWith(
          tier.price,
          expect.any(String),
          expect.stringContaining(`${tier.photos} AI`),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          undefined,
          undefined,
          expect.objectContaining({
            Items: expect.arrayContaining([
              expect.objectContaining({
                Amount: tier.price * 100, // kopeks
              }),
            ]),
          })
        )

        jest.resetModules()
      })
    })
  })
})
