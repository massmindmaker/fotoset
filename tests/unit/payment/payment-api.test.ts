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
 *
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock dependencies BEFORE any imports
jest.mock('@/lib/db', () => ({
  sql: jest.fn(),
  query: jest.fn(),
}));

jest.mock('@/lib/tbank', () => ({
  initPayment: jest.fn(),
  getPaymentState: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  HAS_CREDENTIALS: true,
  IS_TEST_MODE: true,
}));

jest.mock('@/lib/user-identity', () => ({
  findOrCreateUser: jest.fn(),
}));

// Get mocked functions
import { sql as mockSql, query as mockQuery } from '@/lib/db';
import { initPayment, getPaymentState, verifyWebhookSignature } from '@/lib/tbank';
import { findOrCreateUser } from '@/lib/user-identity';

// Setup environment
beforeEach(() => {
  jest.clearAllMocks();
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

    // Mock user lookup/creation
    (findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 123456 });

    // Mock T-Bank response
    (initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });

    // Mock SQL calls (INSERT payment, UPDATE user)
    (mockSql as jest.Mock).mockResolvedValue([{ id: 1 }]);

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: 123456,
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
  });

  test('should create payment for standard tier (999 RUB, 15 photos)', async () => {
    const { POST } = await import('@/app/api/payment/create/route');

    (findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 123456 });
    (initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });
    (mockSql as jest.Mock).mockResolvedValue([{ id: 1 }]);

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: 123456,
        tierId: 'standard',
        email: 'user@example.com',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify initPayment was called with standard tier amount (999)
    expect(initPayment).toHaveBeenCalledWith(
      999, // amount
      expect.any(String), // orderId
      expect.stringContaining('15 AI Photos'), // description
      expect.any(String), // successUrl
      expect.any(String), // failUrl
      expect.any(String), // notificationUrl
      'user@example.com', // email
      undefined, // paymentMethod
      expect.any(Object), // receipt
    );
  });

  test('should create payment for premium tier (1499 RUB) as default', async () => {
    const { POST } = await import('@/app/api/payment/create/route');

    (findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 123456 });
    (initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });
    (mockSql as jest.Mock).mockResolvedValue([{ id: 1 }]);

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: 123456,
        email: 'user@example.com',
        // No tierId - should default to premium
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify initPayment was called with premium tier amount (1499)
    expect(initPayment).toHaveBeenCalledWith(
      1499, // amount
      expect.any(String), // orderId
      expect.stringContaining('23 AI Photos'), // description
      expect.any(String), // successUrl
      expect.any(String), // failUrl
      expect.any(String), // notificationUrl
      'user@example.com', // email
      undefined, // paymentMethod
      expect.any(Object), // receipt
    );
  });

  test('should reject missing telegramUserId', async () => {
    const { POST } = await import('@/app/api/payment/create/route');

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        tierId: 'starter',
        email: 'user@example.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('telegramUserId');
  });

  test('should reject missing email (54-ФЗ requirement)', async () => {
    const { POST } = await import('@/app/api/payment/create/route');

    (findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 123456 });

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: 123456,
        tierId: 'starter',
        // No email
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Email');
  });

  test('should handle referral code', async () => {
    const { POST } = await import('@/app/api/payment/create/route');

    (findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 123456 });
    (initPayment as jest.Mock).mockResolvedValueOnce({
      Success: true,
      PaymentId: 'pay-123',
      PaymentURL: 'https://securepay.tinkoff.ru/new/pay-123',
    });
    (mockSql as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: 123456,
        tierId: 'starter',
        email: 'user@example.com',
        referralCode: 'FRIEND123',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  test('should handle T-Bank API errors', async () => {
    const { POST } = await import('@/app/api/payment/create/route');

    (findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 123456 });
    (initPayment as jest.Mock).mockRejectedValueOnce(
      new Error('T-Bank error 9999: Invalid terminal key')
    );

    const request = new NextRequest('http://localhost:3000/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({
        telegramUserId: 123456,
        tierId: 'starter',
        email: 'user@example.com',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});

describe('GET /api/payment/status', () => {
  test('should return payment status for telegram_user_id', async () => {
    const { GET } = await import('@/app/api/payment/status/route');

    (findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 123456 });
    (mockSql as jest.Mock)
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }]);

    (getPaymentState as jest.Mock).mockResolvedValueOnce({
      Success: true,
      Status: 'CONFIRMED',
      PaymentId: 'pay-123',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?telegram_user_id=123456'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });

  test('should return pending for NEW status', async () => {
    const { GET } = await import('@/app/api/payment/status/route');

    (findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 123456 });
    (mockSql as jest.Mock)
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }]);

    (getPaymentState as jest.Mock).mockResolvedValueOnce({
      Success: true,
      Status: 'NEW',
      PaymentId: 'pay-123',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/payment/status?telegram_user_id=123456'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(false);
  });

  test('should require telegram_user_id parameter', async () => {
    const { GET } = await import('@/app/api/payment/status/route');

    const request = new NextRequest('http://localhost:3000/api/payment/status');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});

describe('POST /api/payment/webhook', () => {
  test('should process CONFIRMED webhook', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');

    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    
    // Mock sql template literal - it's called as tagged template
    const mockSqlFn = jest.fn()
      .mockResolvedValueOnce(undefined) // INSERT INTO webhook_logs (async, non-blocking)
      .mockResolvedValueOnce([{ id: 1, user_id: 1, status: 'pending' }]) // SELECT from payments
      .mockResolvedValueOnce([{ id: 1, user_id: 1 }]); // UPDATE payments RETURNING
    
    // Mock query function for referral
    (mockQuery as jest.Mock).mockResolvedValue({ rows: [] }); // No referrer
    
    // Replace the mock
    (mockSql as jest.Mock).mockImplementation((...args: unknown[]) => mockSqlFn(...args));

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
    expect(response.status).toBe(200);
  });

  test('should process REJECTED webhook', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');

    (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    
    const mockSqlFn = jest.fn()
      .mockResolvedValueOnce(undefined) // INSERT INTO webhook_logs
      .mockResolvedValueOnce([{ id: 1, user_id: 1, status: 'pending' }]) // SELECT from payments
      .mockResolvedValueOnce([{ id: 1 }]); // UPDATE payments
    
    (mockSql as jest.Mock).mockImplementation((...args: unknown[]) => mockSqlFn(...args));

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
  });

  test('should reject invalid signature', async () => {
    const { POST } = await import('@/app/api/payment/webhook/route');

    (verifyWebhookSignature as jest.Mock).mockReturnValue(false);
    
    // Mock sql for webhook_logs insert (called before signature check)
    (mockSql as jest.Mock).mockResolvedValue(undefined);

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
    expect(data.error).toContain('signature');
  });
});
