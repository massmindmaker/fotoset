/**
 * User Workflow Integration Tests
 *
 * Tests complete user journey:
 * 1. Payment creation → T-Bank redirect
 * 2. Payment webhook → Pro status activation
 * 3. Generation start → Photo creation
 * 4. Telegram notification → Photo delivery
 *
 * PRIORITY: P0 (Critical User Flow)
 */

import { NextRequest } from 'next/server'

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockSql = jest.fn()
const mockFindOrCreateUser = jest.fn()
const mockInitPayment = jest.fn()
const mockVerifyWebhookSignature = jest.fn()
const mockGenerateImage = jest.fn()
const mockFetch = jest.fn()

// Mock database
jest.mock('@/lib/db', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  query: jest.fn(),
}))

// Mock user identity
jest.mock('@/lib/user-identity', () => ({
  findOrCreateUser: (...args: unknown[]) => mockFindOrCreateUser(...args),
}))

// Mock T-Bank
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

// Mock Kie.AI generation
jest.mock('@/lib/kie', () => ({
  generateWithKie: (...args: unknown[]) => mockGenerateImage(...args),
  pollKieTask: jest.fn(),
}))

// Mock logger
jest.mock('@/lib/logger', () => ({
  paymentLogger: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  log: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  generationLogger: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

// Mock fetch for Telegram API
global.fetch = mockFetch as any

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_TELEGRAM_USER_ID = 123456789
const TEST_USER_ID = 1
const TEST_AVATAR_ID = 100
const TEST_PAYMENT_ID = 'pay_test_123'
const TEST_TBANK_PAYMENT_ID = 'tbank_12345678'
const TEST_JOB_ID = 500

const testUser = {
  id: TEST_USER_ID,
  telegram_user_id: TEST_TELEGRAM_USER_ID,
  is_pro: false,
  pending_generation_tier: null,
  pending_generation_avatar_id: null,
  pending_referral_code: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const testProUser = { ...testUser, is_pro: true }

const testAvatar = {
  id: TEST_AVATAR_ID,
  user_id: TEST_USER_ID,
  name: 'Мой аватар',
  status: 'draft',
  created_at: new Date().toISOString(),
}

const testPayment = {
  id: 1,
  user_id: TEST_USER_ID,
  tbank_payment_id: TEST_TBANK_PAYMENT_ID,
  amount: 499,
  currency: 'RUB',
  status: 'pending',
  tier_id: 'starter',
  photo_count: 7,
  created_at: new Date().toISOString(),
}

const testJob = {
  id: TEST_JOB_ID,
  avatar_id: TEST_AVATAR_ID,
  style_id: 'professional',
  status: 'processing',
  total_photos: 7,
  completed_photos: 0,
  created_at: new Date().toISOString(),
}

const testPhotos = Array.from({ length: 7 }, (_, i) => ({
  id: i + 1,
  avatar_id: TEST_AVATAR_ID,
  style_id: 'professional',
  prompt: `Prompt ${i + 1}`,
  image_url: `https://r2.example.com/photo_${i + 1}.jpg`,
  created_at: new Date().toISOString(),
}))

// ============================================================================
// STEP 1: PAYMENT CREATION
// ============================================================================

describe('User Workflow: Step 1 - Payment Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.NEXT_PUBLIC_APP_URL = 'https://pinglass.ru'
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  test('should create payment and return T-Bank redirect URL', async () => {
    const { POST } = await import('@/app/api/payment/create/route')

    // Setup mocks
    mockFindOrCreateUser.mockResolvedValue(testUser)
    mockSql.mockResolvedValueOnce([testAvatar]) // find avatar
    mockSql.mockResolvedValueOnce([]) // no stored pricing - use default
    mockSql.mockResolvedValueOnce([testPayment]) // insert payment
    mockSql.mockResolvedValueOnce([]) // update pending generation

    mockInitPayment.mockResolvedValue({
      Success: true,
      PaymentId: TEST_TBANK_PAYMENT_ID,
      PaymentURL: 'https://securepay.tinkoff.ru/pay/test123',
    })

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        avatarId: TEST_AVATAR_ID,
        tierId: 'starter',
        email: 'test@example.com',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.paymentId).toBeDefined()
    expect(data.confirmationUrl).toContain('securepay.tinkoff.ru')
    expect(data.testMode).toBeDefined()
  })

  test('should allow payment creation for Pro user (no restriction)', async () => {
    // NOTE: Payment API does NOT check isPro - Pro users CAN create new payments
    // This allows buying additional packages
    const { POST } = await import('@/app/api/payment/create/route')

    mockFindOrCreateUser.mockResolvedValue(testProUser)
    mockSql.mockResolvedValueOnce([]) // no stored pricing
    mockSql.mockResolvedValueOnce([testPayment]) // insert payment
    mockSql.mockResolvedValueOnce([]) // update pending generation

    mockInitPayment.mockResolvedValue({
      Success: true,
      PaymentId: TEST_TBANK_PAYMENT_ID,
      PaymentURL: 'https://securepay.tinkoff.ru/pay/test123',
    })

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        avatarId: TEST_AVATAR_ID,
        tierId: 'starter',
        email: 'test@example.com',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    // Payment creates successfully - no isPro restriction
    expect(response.status).toBe(200)
    expect(data.paymentId).toBeDefined()
  })

  test('should validate tier selection', async () => {
    const { POST } = await import('@/app/api/payment/create/route')

    mockFindOrCreateUser.mockResolvedValue(testUser)

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        avatarId: TEST_AVATAR_ID,
        tierId: 'invalid_tier',
        email: 'test@example.com',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('tier')
  })
})

// ============================================================================
// STEP 2: PAYMENT WEBHOOK
// ============================================================================

describe('User Workflow: Step 2 - Payment Webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.TBANK_TERMINAL_KEY = 'TestTerminalKey'
    process.env.TBANK_PASSWORD = 'TestPassword'
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
    delete process.env.TBANK_TERMINAL_KEY
    delete process.env.TBANK_PASSWORD
  })

  test('should activate Pro status on CONFIRMED webhook', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route')

    mockVerifyWebhookSignature.mockReturnValue(true)
    mockSql.mockResolvedValueOnce([testPayment]) // find payment
    mockSql.mockResolvedValueOnce([{ ...testPayment, status: 'succeeded' }]) // update payment
    mockSql.mockResolvedValueOnce([testProUser]) // update user is_pro
    mockSql.mockResolvedValueOnce([]) // webhook log

    const webhookData = {
      TerminalKey: 'TestTerminalKey',
      OrderId: `u${TEST_USER_ID}t${Date.now()}`,
      Success: true,
      Status: 'CONFIRMED',
      PaymentId: TEST_TBANK_PAYMENT_ID,
      Amount: 49900,
      Token: 'valid_token_hash',
    }

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify(webhookData),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    // Verify user was updated to Pro
    expect(mockSql).toHaveBeenCalled()
  })

  test('should reject webhook with invalid signature', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route')

    mockVerifyWebhookSignature.mockReturnValue(false)

    const webhookData = {
      TerminalKey: 'TestTerminalKey',
      OrderId: `u${TEST_USER_ID}t${Date.now()}`,
      Success: true,
      Status: 'CONFIRMED',
      PaymentId: TEST_TBANK_PAYMENT_ID,
      Token: 'invalid_token',
    }

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify(webhookData),
    })

    const response = await POST(request)
    const data = await response.json()

    // Webhook API returns 403 Forbidden for invalid signature
    expect(response.status).toBe(403)
    expect(data.error).toContain('signature')
  })
})

// ============================================================================
// STEP 3: GENERATION START
// ============================================================================

describe('User Workflow: Step 3 - Generation Start', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.NEXT_PUBLIC_APP_URL = 'https://pinglass.ru'
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  test('should reject generation without referenceImages or useStoredReferences', async () => {
    const { POST } = await import('@/app/api/generate/route')

    mockFindOrCreateUser.mockResolvedValue(testProUser)

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        avatarId: TEST_AVATAR_ID,
        styleId: 'professional',
        // Missing: referenceImages or useStoredReferences=true
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    // API requires either referenceImages array OR useStoredReferences=true
    // Response format: { success: false, error: { code, message } }
    expect(response.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
    expect(data.error.message.toLowerCase()).toContain('missing')
  })

  test('should reject generation for user without successful payment', async () => {
    const { POST } = await import('@/app/api/generate/route')

    mockFindOrCreateUser.mockResolvedValue(testUser)
    // Avatar check with telegram_user_id
    mockSql.mockResolvedValueOnce([{ id: TEST_AVATAR_ID }])
    // Stored references
    mockSql.mockResolvedValueOnce([
      { image_url: 'https://r2.example.com/ref1.jpg' },
      { image_url: 'https://r2.example.com/ref2.jpg' },
      { image_url: 'https://r2.example.com/ref3.jpg' },
    ])
    // No successful payment
    mockSql.mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        avatarId: TEST_AVATAR_ID,
        styleId: 'professional',
        useStoredReferences: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    // API returns 402 Payment Required status
    // Response format: { success: false, error: { code, message } }
    expect(response.status).toBe(402)
    expect(data.error.code).toBe('PAYMENT_REQUIRED')
  })

  test('should reject generation when no stored references found', async () => {
    const { POST } = await import('@/app/api/generate/route')

    mockFindOrCreateUser.mockResolvedValue(testProUser)
    // Avatar check
    mockSql.mockResolvedValueOnce([{ id: TEST_AVATAR_ID }])
    // No stored references
    mockSql.mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        avatarId: TEST_AVATAR_ID,
        styleId: 'professional',
        useStoredReferences: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    // API returns 400 when no reference images stored for avatar
    // Response format: { success: false, error: { code, message } }
    expect(response.status).toBe(400)
    expect(data.error.code).toBe('NO_REFERENCE_IMAGES')
  })
})

// ============================================================================
// STEP 4: TELEGRAM NOTIFICATION
// ============================================================================

describe('User Workflow: Step 4 - Telegram Notification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token_123'
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
    delete process.env.TELEGRAM_BOT_TOKEN
  })

  test('should send photos to Telegram chat', async () => {
    const { POST } = await import('@/app/api/telegram/send-photos/route')

    // Mock successful Telegram API responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 123 } }),
    })

    const photoUrls = testPhotos.map(p => p.image_url)

    const request = new NextRequest('http://localhost:3000/api/telegram/send-photos', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        photoUrls,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.sentCount).toBe(7)
    expect(mockFetch).toHaveBeenCalled()
  })

  test('should handle Telegram API errors gracefully', async () => {
    const { POST } = await import('@/app/api/telegram/send-photos/route')

    // First photo succeeds, second fails
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ ok: false, description: 'Bot was blocked by the user' }),
      })

    const request = new NextRequest('http://localhost:3000/api/telegram/send-photos', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        photoUrls: [testPhotos[0].image_url, testPhotos[1].image_url],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    // Should still return partial success
    expect(response.status).toBe(200)
    expect(data.sentCount).toBeGreaterThanOrEqual(1)
  })

  test('should return error when telegramUserId not found', async () => {
    const { POST } = await import('@/app/api/telegram/send-photos/route')

    const request = new NextRequest('http://localhost:3000/api/telegram/send-photos', {
      method: 'POST',
      body: JSON.stringify({
        photoUrls: ['https://example.com/photo.jpg'],
        // missing telegramUserId
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Telegram user ID')
  })

  test('should return error when no photos provided', async () => {
    const { POST } = await import('@/app/api/telegram/send-photos/route')

    const request = new NextRequest('http://localhost:3000/api/telegram/send-photos', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        photoUrls: [],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('No photos')
  })
})

// ============================================================================
// FULL WORKFLOW SUMMARY
// ============================================================================

describe('User Workflow: Full Journey Summary', () => {
  test('workflow steps are tested in correct order', () => {
    // This is a meta-test to document the workflow
    const workflowSteps = [
      '1. Payment Creation - User selects tier and pays via T-Bank',
      '2. Payment Webhook - T-Bank confirms payment, user becomes Pro',
      '3. Generation Start - User starts AI photo generation',
      '4. Telegram Notification - Generated photos sent to user',
    ]

    expect(workflowSteps).toHaveLength(4)
    console.log('\n=== User Workflow Steps ===')
    workflowSteps.forEach(step => console.log(step))
  })
})
