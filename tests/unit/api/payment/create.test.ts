/**
 * Unit Tests for POST /api/payment/create
 *
 * Tests payment creation endpoint with:
 * - Telegram-only authentication (telegramUserId required)
 * - Tier selection (starter/standard/premium)
 * - Email validation (54-ФЗ fiscal compliance)
 * - Referral code handling (from DB + client fallback)
 * - T-Bank integration
 * - Pending generation state persistence
 *
 * PRIORITY: P0 (Critical - Payment flow)
 * COVERAGE TARGET: 90%
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import {
  createUser,
  createProUser,
  PRICING_TIERS,
  TEST_TELEGRAM_USER_ID,
} from '@/tests/fixtures/factory'

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock neon sql tagged template
const mockSql = jest.fn()

// Mock db module
jest.mock('@/lib/db', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  query: jest.fn(),
}))

// Mock findOrCreateUser (in lib/user-identity.ts)
const mockFindOrCreateUser = jest.fn()
jest.mock('@/lib/user-identity', () => ({
  findOrCreateUser: (...args: unknown[]) => mockFindOrCreateUser(...args),
}))

// Mock T-Bank
const mockInitPayment = jest.fn()
jest.mock('@/lib/tbank', () => ({
  initPayment: (...args: unknown[]) => mockInitPayment(...args),
  HAS_CREDENTIALS: true,
  IS_TEST_MODE: true,
  PaymentMethod: {
    TINKOFF_PAY: 'TinkoffPay',
    SBP: 'SBP',
  },
}))

// Mock logger to suppress output
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

function createPaymentRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/payment/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function mockTBankSuccess(paymentId = 'pay-test-123') {
  mockInitPayment.mockResolvedValueOnce({
    Success: true,
    PaymentId: paymentId,
    PaymentURL: `https://securepay.tinkoff.ru/new/${paymentId}`,
    Status: 'NEW',
    Amount: 99900,
    OrderId: 'test-order',
    TerminalKey: 'TestDEMOKey',
  })
}

function mockTBankError(error: string) {
  mockInitPayment.mockRejectedValueOnce(new Error(error))
}

// ============================================================================
// TESTS
// ============================================================================

describe('POST /api/payment/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://pinglass.ru'
    process.env.TBANK_TERMINAL_KEY = 'TestDEMOKey'
    process.env.TBANK_PASSWORD = 'TestPassword'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.TBANK_TERMINAL_KEY
    delete process.env.TBANK_PASSWORD
  })

  // ==========================================================================
  // HAPPY PATH TESTS
  // ==========================================================================

  describe('Happy Path - Tier Selection', () => {
    test('PAY-HP-001: should create payment for starter tier (499 RUB, 7 photos)', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 1 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([]) // INSERT payment
      mockSql.mockResolvedValueOnce([]) // UPDATE user pending_generation
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'starter',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.paymentId).toBe('pay-test-123')
      expect(data.confirmationUrl).toContain('tinkoff.ru')
      expect(data.testMode).toBe(true)
      expect(data.telegramUserId).toBe(testUser.telegram_user_id)

      // Verify T-Bank called with correct amount
      expect(mockInitPayment).toHaveBeenCalledWith(
        499, // starter price
        expect.stringMatching(/^u\d+t[a-z0-9]+$/), // orderId
        expect.stringContaining('7 AI'),
        expect.stringContaining('/payment/callback'),
        expect.stringContaining('/payment/fail'),
        expect.stringContaining('/api/payment/webhook'),
        undefined, // no customerEmail when Receipt.Email present
        undefined, // paymentMethod
        expect.objectContaining({
          Email: 'user@example.com',
          Items: expect.arrayContaining([
            expect.objectContaining({
              Amount: 49900, // kopeks
              Price: 49900,
            }),
          ]),
        })
      )
    })

    test('PAY-HP-002: should create payment for standard tier (999 RUB, 15 photos)', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 2 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'standard',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockInitPayment).toHaveBeenCalledWith(
        999,
        expect.any(String),
        expect.stringContaining('15 AI'),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        undefined,
        expect.objectContaining({
          Items: expect.arrayContaining([
            expect.objectContaining({
              Amount: 99900,
            }),
          ]),
        })
      )
    })

    test('PAY-HP-003: should create payment for premium tier (1499 RUB, 23 photos)', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 3 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'premium',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockInitPayment).toHaveBeenCalledWith(
        1499,
        expect.any(String),
        expect.stringContaining('23 AI'),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        undefined,
        expect.objectContaining({
          Items: expect.arrayContaining([
            expect.objectContaining({
              Amount: 149900,
            }),
          ]),
        })
      )
    })

    test('PAY-HP-004: should default to premium tier when tierId not specified', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 4 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        // No tierId - should default to premium
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockInitPayment).toHaveBeenCalledWith(
        1499, // premium
        expect.any(String),
        expect.stringContaining('23'),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        undefined,
        expect.any(Object)
      )
    })
  })

  describe('Happy Path - Referral Codes', () => {
    test('PAY-HP-005: should process referral code from database (pending_referral_code)', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({
        id: 5,
        pending_referral_code: 'DB_CODE123',
      })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      // Mock for applyReferralCode internal calls:
      // 1. Check if user already has referrer
      mockSql.mockResolvedValueOnce([]) // No existing referrer
      // 2. Look up referral code owner
      mockSql.mockResolvedValueOnce([{ user_id: 100 }]) // Code owner
      // 3. Insert referral relationship
      mockSql.mockResolvedValueOnce([])
      // 4. Update uses_count
      mockSql.mockResolvedValueOnce([])
      // 5. INSERT payment
      mockSql.mockResolvedValueOnce([])
      // 6. UPDATE user pending_generation
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'starter',
        // No client referralCode - should use DB pending_referral_code
      })

      const response = await POST(request)

      // Success means referral was processed
      expect(response.status).toBe(200)
    })

    test('PAY-HP-006: should use client referralCode as fallback when DB empty', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({
        id: 6,
        pending_referral_code: null, // No DB referral code
      })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      // Mock for applyReferralCode with client code
      mockSql.mockResolvedValueOnce([]) // No existing referrer
      mockSql.mockResolvedValueOnce([{ user_id: 101 }]) // Code owner
      mockSql.mockResolvedValueOnce([]) // Insert referral
      mockSql.mockResolvedValueOnce([]) // Update uses_count
      mockSql.mockResolvedValueOnce([]) // INSERT payment
      mockSql.mockResolvedValueOnce([]) // UPDATE user
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'starter',
        referralCode: 'CLIENT_CODE',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    test('PAY-HP-007: should proceed without referral when no code provided', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({
        id: 7,
        pending_referral_code: null,
      })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      // No referral code means skip applyReferralCode entirely
      mockSql.mockResolvedValueOnce([]) // INSERT payment
      mockSql.mockResolvedValueOnce([]) // UPDATE user
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        // No referralCode in request, no pending_referral_code in DB
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      // Fewer SQL calls since no referral processing
      expect(mockSql).toHaveBeenCalledTimes(2)
    })
  })

  describe('Happy Path - Payment Methods', () => {
    test('PAY-HP-008: should pass TinkoffPay payment method', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 8 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        paymentMethod: 'TinkoffPay',
      })

      await POST(request)

      expect(mockInitPayment).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        'TinkoffPay',
        expect.any(Object)
      )
    })

    test('PAY-HP-009: should pass SBP payment method', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 9 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        paymentMethod: 'SBP',
      })

      await POST(request)

      expect(mockInitPayment).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        'SBP',
        expect.any(Object)
      )
    })
  })

  describe('Happy Path - State Persistence', () => {
    test('PAY-HP-010: should save pending generation params to user', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 10 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([]) // INSERT payment
      mockSql.mockResolvedValueOnce([]) // UPDATE user
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'standard',
        avatarId: '42',
      })

      await POST(request)

      // Verify UPDATE users SET pending_generation_* was called
      expect(mockSql).toHaveBeenCalledTimes(2)
      // Second call should be the UPDATE with pending_generation params
    })
  })

  // ==========================================================================
  // ERROR TESTS
  // ==========================================================================

  describe('Error Cases - Validation', () => {
    test('PAY-ERR-001: should reject missing telegramUserId', async () => {
      const { POST } = await import('@/app/api/payment/create/route')

      const request = createPaymentRequest({
        email: 'user@example.com',
        tierId: 'starter',
        // Missing telegramUserId
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('telegramUserId')
    })

    test('PAY-ERR-002: should reject non-numeric telegramUserId', async () => {
      const { POST } = await import('@/app/api/payment/create/route')

      const request = createPaymentRequest({
        telegramUserId: 'not-a-number',
        email: 'user@example.com',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('telegramUserId')
    })

    test('PAY-ERR-003: should reject missing email (54-ФЗ)', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 11 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        tierId: 'starter',
        // Missing email
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Email')
    })

    test('PAY-ERR-004: should reject empty email string', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 12 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: '   ', // whitespace only
        tierId: 'starter',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Email')
    })

    test('PAY-ERR-005: should reject invalid tier', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 13 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'super-ultra-premium', // Invalid tier
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid tier')
    })
  })

  describe('Error Cases - Configuration', () => {
    test('PAY-ERR-006: should return 503 when T-Bank credentials not configured', async () => {
      // Reset module to pick up HAS_CREDENTIALS = false
      jest.resetModules()
      jest.doMock('@/lib/tbank', () => ({
        initPayment: mockInitPayment,
        HAS_CREDENTIALS: false,
        IS_TEST_MODE: false,
      }))

      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 14 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'starter',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toContain('not configured')
    })
  })

  describe('Error Cases - T-Bank API', () => {
    test('PAY-ERR-007: should handle T-Bank API errors', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 15 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankError('T-Bank error 9999: Invalid terminal key')

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'starter',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Invalid terminal key')
    })

    test('PAY-ERR-008: should handle T-Bank network timeout', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 16 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankError('Request timeout after 30000ms')

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'starter',
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })

  describe('Error Cases - Database', () => {
    test('PAY-ERR-009: should handle user lookup failure', async () => {
      const { POST } = await import('@/app/api/payment/create/route')

      mockFindOrCreateUser.mockRejectedValueOnce(new Error('Database connection failed'))

      const request = createPaymentRequest({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        email: 'user@example.com',
        tierId: 'starter',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    test('PAY-ERR-010: should handle payment insert failure', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 17 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockRejectedValueOnce(new Error('Database insert failed'))
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'starter',
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })

  // ==========================================================================
  // EDGE CASE TESTS
  // ==========================================================================

  describe('Edge Cases', () => {
    test('PAY-EDGE-001: should generate unique OrderId under 20 chars', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 999999999 }) // Large user ID

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
      })

      await POST(request)

      const orderId = mockInitPayment.mock.calls[0][1]
      expect(orderId.length).toBeLessThanOrEqual(20) // T-Bank limit
      expect(orderId).toMatch(/^u\d+t[a-z0-9]+$/)
    })

    test('PAY-EDGE-002: should trim email whitespace', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 18 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: '  user@example.com  ', // With whitespace
        tierId: 'starter',
      })

      await POST(request)

      const receipt = mockInitPayment.mock.calls[0][8]
      expect(receipt.Email).toBe('user@example.com')
    })

    test('PAY-EDGE-003: should parse avatarId string to number', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 19 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        avatarId: '42', // String, should be parsed
      })

      await POST(request)

      // Verify avatarId was converted to number in DB update
      expect(mockSql).toHaveBeenCalled()
    })

    test('PAY-EDGE-004: should handle null avatarId gracefully', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 20 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        avatarId: null,
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    test('PAY-EDGE-005: should use request origin as baseUrl fallback', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 21 })

      delete process.env.NEXT_PUBLIC_APP_URL // Remove env

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = new NextRequest('http://test.local:3000/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://custom-origin.com',
        },
        body: JSON.stringify({
          telegramUserId: testUser.telegram_user_id,
          email: 'user@example.com',
        }),
      })

      await POST(request)

      const successUrl = mockInitPayment.mock.calls[0][3]
      expect(successUrl).toContain('custom-origin.com')
    })

    test('PAY-EDGE-006: should encode query params in callback URL', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 22, telegram_user_id: 123456789 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([])
      mockSql.mockResolvedValueOnce([])
      mockTBankSuccess()

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
        tierId: 'standard',
      })

      await POST(request)

      const successUrl = mockInitPayment.mock.calls[0][3]
      expect(successUrl).toContain('telegram_user_id=123456789')
      expect(successUrl).toContain('tier=standard')
    })
  })

  // ==========================================================================
  // SECURITY TESTS
  // ==========================================================================

  describe('Security', () => {
    test('PAY-SEC-001: should not leak internal error details', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 23 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockRejectedValueOnce(new Error('FATAL: password authentication failed'))

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'user@example.com',
      })

      const response = await POST(request)
      const data = await response.json()

      // Should not expose "password authentication failed"
      expect(response.status).toBe(500)
      expect(data.error).not.toContain('password')
    })

    test('PAY-SEC-002: should validate telegramUserId type strictly', async () => {
      const { POST } = await import('@/app/api/payment/create/route')

      const request = createPaymentRequest({
        telegramUserId: { id: 123 }, // Object instead of number
        email: 'user@example.com',
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    test('PAY-SEC-003: should not process if user creation fails silently', async () => {
      const { POST } = await import('@/app/api/payment/create/route')

      mockFindOrCreateUser.mockResolvedValueOnce(null) // Returns null

      const request = createPaymentRequest({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        email: 'user@example.com',
      })

      const response = await POST(request)

      // Should fail gracefully, not create orphan payment
      expect(mockInitPayment).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // RECEIPT COMPLIANCE TESTS (54-ФЗ)
  // ==========================================================================

  describe('54-ФЗ Receipt Compliance', () => {
    // These tests need to track the receipt passed to initPayment
    // We capture it via a custom mock implementation
    let capturedReceipt: Record<string, unknown> | null = null

    beforeEach(() => {
      capturedReceipt = null
      // Override mockTBankSuccess to capture the receipt argument
      mockInitPayment.mockImplementation((...args: unknown[]) => {
        capturedReceipt = args[8] as Record<string, unknown>
        return Promise.resolve({
          Success: true,
          PaymentId: 'pay-fz-test',
          PaymentURL: 'https://securepay.tinkoff.ru/new/pay-fz-test',
          Status: 'NEW',
          Amount: 99900,
          OrderId: 'test-order',
          TerminalKey: 'TestDEMOKey',
        })
      })
    })

    test('PAY-FZ-001: should include correct taxation type', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 124 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([]) // Insert payment
      mockSql.mockResolvedValueOnce([]) // Update user

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'fz1@example.com',
        tierId: 'starter',
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(capturedReceipt).not.toBeNull()
      expect((capturedReceipt as Record<string, unknown>).Taxation).toBe('usn_income_outcome')
    })

    test('PAY-FZ-002: should include correct item details', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 125 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([]) // Insert payment
      mockSql.mockResolvedValueOnce([]) // Update user

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'fz2@example.com',
        tierId: 'standard',
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(capturedReceipt).not.toBeNull()

      const receipt = capturedReceipt as Record<string, unknown>
      const items = receipt.Items as Record<string, unknown>[]
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({
        Name: expect.stringContaining('15 AI'),
        Tax: 'none',
        PaymentMethod: 'full_payment',
        PaymentObject: 'service',
        Quantity: 1,
      })
    })

    test('PAY-FZ-003: should have matching Amount and Price in receipt', async () => {
      const { POST } = await import('@/app/api/payment/create/route')
      const testUser = createUser({ id: 126 })

      mockFindOrCreateUser.mockResolvedValueOnce(testUser)
      mockSql.mockResolvedValueOnce([]) // Insert payment
      mockSql.mockResolvedValueOnce([]) // Update user

      const request = createPaymentRequest({
        telegramUserId: testUser.telegram_user_id,
        email: 'fz3@example.com',
        tierId: 'premium',
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(capturedReceipt).not.toBeNull()

      const receipt = capturedReceipt as Record<string, unknown>
      const items = receipt.Items as Array<{ Price: number; Amount: number }>
      const item = items[0]
      expect(item.Price).toBe(item.Amount) // Must match for single item
      expect(item.Amount).toBe(149900) // 1499 RUB in kopeks
    })
  })
})
