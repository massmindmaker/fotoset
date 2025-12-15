/**
 * Unit Tests for Payment API Routes
 *
 * Tests:
 * - POST /api/payment/create (tier selection, referral codes)
 * - GET /api/payment/status (polling, status checks)
 * - POST /api/payment/webhook (signature verification, referral earnings)
 *
 * PRIORITY: P0 (Critical - Payment flow)
 * COVERAGE TARGET: 85%
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('@/lib/tbank');

const mockSql = jest.fn();
const mockQuery = jest.fn();

// Setup mocks
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  // Mock db module
  jest.doMock('@/lib/db', () => ({
    sql: mockSql,
    query: mockQuery,
  }));

  // Mock tbank module
  jest.doMock('@/lib/tbank', () => ({
    initPayment: jest.fn(),
    getPaymentState: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    HAS_CREDENTIALS: true,
    IS_TEST_MODE: true,
  }));

  // Set environment variables
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.DATABASE_URL = 'postgresql://test';
  process.env.TBANK_TERMINAL_KEY = 'TestDEMOKey';
  process.env.TBANK_PASSWORD = 'TestPassword';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.DATABASE_URL;
  delete process.env.TBANK_TERMINAL_KEY;
  delete process.env.TBANK_PASSWORD;
});

describe('POST /api/payment/create', () => {
  test('should create payment for starter tier (499 RUB, 7 photos)', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const tbank = await import('@/lib/tbank');

    // Mock user lookup/creation
    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]); // Existing user
    mockSql.mockResolvedValueOnce([]); // Payment insert

    // Mock T-Bank response
    (tbank.initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device-123',
        tierId: 'starter',
        email: 'user@example.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paymentId).toBe('pay-123');
    expect(data.confirmationUrl).toContain('tinkoff.ru');
    expect(data.testMode).toBe(true);

    // Verify initPayment was called with correct amount
    expect(tbank.initPayment).toHaveBeenCalledWith(
      499, // starter tier price
      expect.stringContaining('u1t'), // orderId format
      expect.stringContaining('7 AI Photos'),
      expect.stringContaining('/payment/callback'),
      expect.stringContaining('/payment/fail'),
      expect.stringContaining('/api/payment/webhook'),
      'user@example.com',
      undefined
    );
  });

  test('should create payment for standard tier (999 RUB, 15 photos)', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);
    mockSql.mockResolvedValueOnce([]);

    (tbank.initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device-123',
        tierId: 'standard',
      }),
    });

    await POST(request);

    expect(tbank.initPayment).toHaveBeenCalledWith(
      999,
      expect.any(String),
      expect.stringContaining('15 AI Photos'),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      undefined,
      undefined
    );
  });

  test('should create payment for premium tier (1499 RUB, 23 photos) as default', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);
    mockSql.mockResolvedValueOnce([]);

    (tbank.initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device-123',
        // No tierId - should default to premium
      }),
    });

    await POST(request);

    expect(tbank.initPayment).toHaveBeenCalledWith(
      1499,
      expect.any(String),
      expect.stringContaining('23 AI Photos'),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      undefined,
      undefined
    );
  });

  test('should reject invalid tier', async () => {
    const { POST } = await import('@/app/api/payment/create/route');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device-123',
        tierId: 'invalid-tier',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid tier');
  });

  test('should reject missing deviceId', async () => {
    const { POST } = await import('@/app/api/payment/create/route');

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        tierId: 'starter',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Device ID required');
  });

  test('should create new user if not exists', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const tbank = await import('@/lib/tbank');

    // Mock user not found, then created
    mockSql.mockResolvedValueOnce([]); // No existing user
    mockSql.mockResolvedValueOnce([{ id: 2, device_id: 'new-device' }]); // Created user
    mockSql.mockResolvedValueOnce([]); // Payment insert

    (tbank.initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'new-device',
        tierId: 'starter',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('INSERT INTO users')])
    );
  });

  test('should apply referral code if provided', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);
    mockSql.mockResolvedValueOnce([]);

    // Mock referral code application
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // No existing referral
      .mockResolvedValueOnce({ rows: [{ user_id: 999 }] }) // Referral code owner
      .mockResolvedValueOnce({ rows: [] }) // Insert referral
      .mockResolvedValueOnce({ rows: [] }); // Update balance

    (tbank.initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device-123',
        tierId: 'starter',
        referralCode: 'FRIEND123',
      }),
    });

    await POST(request);

    // Verify referral queries were made
    expect(mockQuery).toHaveBeenCalled();
  });

  test('should return 503 when credentials not configured', async () => {
    // Mock HAS_CREDENTIALS = false
    jest.doMock('@/lib/tbank', () => ({
      initPayment: jest.fn(),
      HAS_CREDENTIALS: false,
      IS_TEST_MODE: false,
    }));

    const { POST } = await import('@/app/api/payment/create/route');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device-123',
        tierId: 'starter',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain('not configured');
  });

  test('should handle T-Bank API errors', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);

    (tbank.initPayment as jest.Mock).mockRejectedValueOnce(
      new Error('T-Bank error 9999: Invalid terminal key')
    );

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device-123',
        tierId: 'starter',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Invalid terminal key');
  });

  test('should generate unique OrderId format', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 42, device_id: 'device-123' }]);
    mockSql.mockResolvedValueOnce([]);

    (tbank.initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device-123',
        tierId: 'starter',
      }),
    });

    await POST(request);

    const orderId = (tbank.initPayment as jest.Mock).mock.calls[0][1];
    expect(orderId).toMatch(/^u\d+t[a-z0-9]+$/); // Format: u{userId}t{timestamp}
    expect(orderId.length).toBeLessThanOrEqual(20); // T-Bank limit
  });
});

describe('GET /api/payment/status', () => {
  test('should return payment status for device_id', async () => {
    const { GET } = await import('@/app/api/payment/status/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]); // User
    mockSql.mockResolvedValueOnce([
      { tbank_payment_id: 'pay-123', status: 'pending' },
    ]); // Latest payment

    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Success: true,
      Status: 'CONFIRMED',
      PaymentId: 'pay-123',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?device_id=device-123'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });

  test('should return payment status with explicit payment_id', async () => {
    const { GET } = await import('@/app/api/payment/status/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);

    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Success: true,
      Status: 'CONFIRMED',
      PaymentId: 'pay-123',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?device_id=device-123&payment_id=pay-123'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });

  test('should handle AUTHORIZED status as success', async () => {
    const { GET } = await import('@/app/api/payment/status/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);
    mockSql.mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }]);

    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Success: true,
      Status: 'AUTHORIZED',
      PaymentId: 'pay-123',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?device_id=device-123'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });

  test('should return pending for NEW status', async () => {
    const { GET } = await import('@/app/api/payment/status/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);
    mockSql.mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }]);

    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Success: true,
      Status: 'NEW',
      PaymentId: 'pay-123',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?device_id=device-123'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(false);
    expect(data.status).toBe('new');
  });

  test('should return immediately if payment already succeeded in DB', async () => {
    const { GET } = await import('@/app/api/payment/status/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);
    mockSql.mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'succeeded' }]);

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?device_id=device-123'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
    expect(tbank.getPaymentState).not.toHaveBeenCalled(); // Should not check T-Bank
  });

  test('should fall back to DB status if T-Bank unavailable', async () => {
    const { GET } = await import('@/app/api/payment/status/route');
    const tbank = await import('@/lib/tbank');

    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'device-123' }]);
    mockSql.mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }]);
    mockSql.mockResolvedValueOnce([{ status: 'succeeded' }]); // DB fallback

    (tbank.getPaymentState as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?device_id=device-123'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });

  test('should require device_id parameter', async () => {
    const { GET } = await import('@/app/api/payment/status/route');

    const request = new NextRequest('http://localhost:3000/api/payment/status');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Device ID required');
  });

  test('should create user if not exists', async () => {
    const { GET } = await import('@/app/api/payment/status/route');

    mockSql.mockResolvedValueOnce([]); // No user
    mockSql.mockResolvedValueOnce([{ id: 1, device_id: 'new-device' }]); // Created user
    mockSql.mockResolvedValueOnce([]); // No payments

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?device_id=new-device'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(false);
    expect(data.status).toBe('no_payment');
  });

  test('should handle DATABASE_URL not configured', async () => {
    delete process.env.DATABASE_URL;
    jest.resetModules();

    const { GET } = await import('@/app/api/payment/status/route');

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?device_id=device-123'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(false);
    expect(data.testMode).toBe(true);
  });
});

describe('POST /api/payment/webhook', () => {
  test('should process CONFIRMED webhook', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');
    const tbank = await import('@/lib/tbank');

    (tbank.verifyWebhookSignature as jest.Mock).mockReturnValueOnce(true);

    mockSql.mockResolvedValueOnce([]); // Update payment
    mockSql.mockResolvedValueOnce([{ user_id: 1 }]); // Get payment
    mockQuery.mockResolvedValueOnce({ rows: [] }); // No referral

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({
        TerminalKey: 'TestDEMOKey',
        OrderId: 'u1t123',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: 'pay-123',
        Amount: 49900,
        Token: 'valid-token',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSql).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('succeeded')])
    );
  });

  test('should process AUTHORIZED webhook as success', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');
    const tbank = await import('@/lib/tbank');

    (tbank.verifyWebhookSignature as jest.Mock).mockReturnValueOnce(true);

    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ user_id: 1 }]);
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({
        Status: 'AUTHORIZED',
        PaymentId: 'pay-123',
        Token: 'valid-token',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  test('should process REJECTED webhook', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');
    const tbank = await import('@/lib/tbank');

    (tbank.verifyWebhookSignature as jest.Mock).mockReturnValueOnce(true);

    mockSql.mockResolvedValueOnce([]);

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({
        Status: 'REJECTED',
        PaymentId: 'pay-123',
        Token: 'valid-token',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('canceled')])
    );
  });

  test('should reject invalid signature', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');
    const tbank = await import('@/lib/tbank');

    (tbank.verifyWebhookSignature as jest.Mock).mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({
        Status: 'CONFIRMED',
        PaymentId: 'pay-123',
        Token: 'invalid-token',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Invalid signature');
  });

  test('should calculate referral earning (10% of payment)', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');
    const tbank = await import('@/lib/tbank');

    (tbank.verifyWebhookSignature as jest.Mock).mockReturnValueOnce(true);

    mockSql.mockResolvedValueOnce([]); // Update payment
    mockSql.mockResolvedValueOnce([{ user_id: 2 }]); // Get payment
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 1 }] }) // User has referrer
      .mockResolvedValueOnce({ rows: [{ id: 1, amount: 499 }] }) // Payment amount
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert earning
      .mockResolvedValueOnce({ rows: [] }); // Update balance

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({
        Status: 'CONFIRMED',
        PaymentId: 'pay-123',
        Token: 'valid-token',
      }),
    });

    await POST(request);

    // Verify earning was calculated (499 * 0.10 = 49.9)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO referral_earnings'),
      expect.arrayContaining([1, 2, 1, 49.9, 499])
    );
  });

  test('should prevent duplicate earning (idempotency)', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');
    const tbank = await import('@/lib/tbank');

    (tbank.verifyWebhookSignature as jest.Mock).mockReturnValueOnce(true);

    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ user_id: 2 }]);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, amount: 499 }] })
      .mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING - no rows returned

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({
        Status: 'CONFIRMED',
        PaymentId: 'pay-123',
        Token: 'valid-token',
      }),
    });

    await POST(request);

    // Balance should not be updated if earning already exists
    expect(mockQuery).toHaveBeenCalledTimes(3); // No balance update
  });

  test('should handle webhook for user without referrer', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');
    const tbank = await import('@/lib/tbank');

    (tbank.verifyWebhookSignature as jest.Mock).mockReturnValueOnce(true);

    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ user_id: 2 }]);
    mockQuery.mockResolvedValueOnce({ rows: [] }); // No referrer

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({
        Status: 'CONFIRMED',
        PaymentId: 'pay-123',
        Token: 'valid-token',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(1); // Only referral check
  });

  test('should ignore unhandled webhook statuses', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');
    const tbank = await import('@/lib/tbank');

    (tbank.verifyWebhookSignature as jest.Mock).mockReturnValueOnce(true);

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({
        Status: 'REFUNDED', // Unhandled status
        PaymentId: 'pay-123',
        Token: 'valid-token',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockSql).not.toHaveBeenCalled(); // No DB updates
  });

  test('should handle referral processing errors gracefully', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');
    const tbank = await import('@/lib/tbank');

    (tbank.verifyWebhookSignature as jest.Mock).mockReturnValueOnce(true);

    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ user_id: 2 }]);
    mockQuery.mockRejectedValueOnce(new Error('DB error')); // Referral fails

    const request = new NextRequest('http://localhost:3000/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({
        Status: 'CONFIRMED',
        PaymentId: 'pay-123',
        Token: 'valid-token',
      }),
    });

    const response = await POST(request);

    // Should still return success - referral is not critical
    expect(response.status).toBe(200);
  });
});
