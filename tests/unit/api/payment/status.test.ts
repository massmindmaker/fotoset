/**
 * Unit Tests for GET /api/payment/status Route
 *
 * Coverage target: 80% (lines 25-168)
 * Tests: 33 comprehensive tests
 *
 * Test categories:
 * 1. Input Validation (4 tests)
 * 2. Test Mode Fallback (2 tests)
 * 3. User Lookup (3 tests)
 * 4. Latest Payment Lookup (6 tests)
 * 5. T-Bank Status Check (8 tests)
 * 6. Referral Processing (10 tests)
 *
 * PRIORITY: P0 (Critical - Payment status polling)
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('@/lib/tbank');
jest.mock('@/lib/user-identity');

const mockSql = jest.fn();
const mockQuery = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  // Mock db module
  jest.doMock('@/lib/db', () => ({
    sql: mockSql,
    query: mockQuery,
  }));

  // Set environment variables
  process.env.DATABASE_URL = 'postgresql://test';
});

afterEach(() => {
  delete process.env.DATABASE_URL;
});

function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/payment/status');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe('GET /api/payment/status - Input Validation', () => {
  test('should return 400 for missing telegram_user_id', async () => {
    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({});
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('telegram_user_id is required');
  });

  test('should return 400 for empty telegram_user_id', async () => {
    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('telegram_user_id is required');
  });

  test('should return 400 for whitespace-only telegram_user_id', async () => {
    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '   ' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('telegram_user_id is required');
  });

  test('should proceed with valid telegram_user_id', async () => {
    const userIdentity = await import('@/lib/user-identity');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql.mockResolvedValueOnce([]); // No payments

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('no_payment');
  });
});

describe('GET /api/payment/status - Test Mode Fallback', () => {
  test('should return testMode response when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    jest.resetModules();

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(false);
    expect(data.status).toBe('pending');
    expect(data.testMode).toBe(true);
  });

  test('should use database when DATABASE_URL is set', async () => {
    const userIdentity = await import('@/lib/user-identity');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql.mockResolvedValueOnce([]); // No payments

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.testMode).toBeUndefined();
  });
});

describe('GET /api/payment/status - User Lookup', () => {
  test('should find or create user successfully', async () => {
    const userIdentity = await import('@/lib/user-identity');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 42, telegram_user_id: 12345 });
    mockSql.mockResolvedValueOnce([]); // No payments

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(userIdentity.findOrCreateUser).toHaveBeenCalledWith({
      telegramUserId: 12345
    });
  });

  test('should create new user on first call', async () => {
    const userIdentity = await import('@/lib/user-identity');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({
      id: 99,
      telegram_user_id: 99999,
      created_at: new Date()
    });
    mockSql.mockResolvedValueOnce([]); // No payments

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '99999' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('no_payment');
  });

  test('should return db_unavailable error when findOrCreateUser throws', async () => {
    const userIdentity = await import('@/lib/user-identity');
    (userIdentity.findOrCreateUser as jest.Mock).mockRejectedValueOnce(new Error('Connection timeout'));

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(false);
    expect(data.status).toBe('pending');
    expect(data.error).toBe('db_unavailable');
  });
});

describe('GET /api/payment/status - Latest Payment Lookup', () => {
  test('should return success immediately if latest payment already succeeded', async () => {
    const userIdentity = await import('@/lib/user-identity');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql.mockResolvedValueOnce([
      { tbank_payment_id: 'pay-123', status: 'succeeded' }
    ]);

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });

  test('should proceed to T-Bank check if latest payment is pending', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql.mockResolvedValueOnce([
      { tbank_payment_id: 'pay-456', status: 'pending' }
    ]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Status: 'NEW',
      PaymentId: 'pay-456'
    });

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(tbank.getPaymentState).toHaveBeenCalledWith('pay-456');
  });

  test('should return no_payment when no payments exist', async () => {
    const userIdentity = await import('@/lib/user-identity');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql.mockResolvedValueOnce([]); // No payments

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(false);
    expect(data.status).toBe('no_payment');
  });

  test('should return pending when SQL query throws', async () => {
    const userIdentity = await import('@/lib/user-identity');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql.mockRejectedValueOnce(new Error('DB query error'));

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(false);
    expect(data.status).toBe('pending');
  });

  test('should skip latest payment lookup when payment_id is provided', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Status: 'CONFIRMED',
      PaymentId: 'pay-explicit'
    });
    mockSql.mockResolvedValueOnce([]); // UPDATE query

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({
      telegram_user_id: '12345',
      payment_id: 'pay-explicit'
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(tbank.getPaymentState).toHaveBeenCalledWith('pay-explicit');
  });

  test('should handle invalid telegram_user_id parsing gracefully', async () => {
    const userIdentity = await import('@/lib/user-identity');
    (userIdentity.findOrCreateUser as jest.Mock).mockRejectedValueOnce(new Error('Invalid integer'));

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: 'not-a-number' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe('db_unavailable');
  });
});

describe('GET /api/payment/status - T-Bank Status Check', () => {
  test('should process CONFIRMED status - update DB and process referral', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }]) // Latest payment
      .mockResolvedValueOnce([{ id: 1, user_id: 1 }]); // UPDATE returns row
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Status: 'CONFIRMED',
      PaymentId: 'pay-123'
    });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 2 }] }) // Has referrer
      .mockResolvedValueOnce({ rows: [{ id: 1, amount: 1499 }] }) // Payment amount
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert earning
      .mockResolvedValueOnce({ rows: [] }); // Update balance

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
    expect(mockQuery).toHaveBeenCalled(); // Referral processing
  });

  test('should process AUTHORIZED status same as CONFIRMED', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 1, user_id: 1 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Status: 'AUTHORIZED',
      PaymentId: 'pay-123'
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // No referrer

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });

  test('should skip referral when UPDATE returns 0 rows (already succeeded)', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([]); // UPDATE returns empty (race condition - webhook won)
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Status: 'CONFIRMED',
      PaymentId: 'pay-123'
    });

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled(); // No referral processing
  });

  test('should trigger referral processing when UPDATE returns rows', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 5, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-789', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 10, user_id: 5 }]); // UPDATE successful
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Status: 'CONFIRMED',
      PaymentId: 'pay-789'
    });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ id: 10, amount: 999 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [] });

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(4); // Referral flow completed
  });

  test('should return false + status for NEW/PENDING T-Bank statuses', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql.mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({
      Status: 'NEW',
      PaymentId: 'pay-123'
    });

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(false);
    expect(data.status).toBe('new');
  });

  test('should fall back to DB when T-Bank API throws', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ status: 'succeeded' }]); // DB fallback
    (tbank.getPaymentState as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });

  test('should return success if T-Bank error but DB shows succeeded', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ status: 'succeeded' }]);
    (tbank.getPaymentState as jest.Mock).mockRejectedValueOnce(new Error('T-Bank timeout'));

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });

  test('should return pending if T-Bank error and payment not found in DB', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 1, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-unknown', status: 'pending' }])
      .mockResolvedValueOnce([]); // Not found in DB
    (tbank.getPaymentState as jest.Mock).mockRejectedValueOnce(new Error('Payment not found'));

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(data.paid).toBe(false);
    expect(data.status).toBe('pending');
  });
});

describe('GET /api/payment/status - Referral Processing', () => {
  test('should record earning when user has referrer', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, amount: 1499 }] })
      .mockResolvedValueOnce({ rows: [{ id: 100 }] })
      .mockResolvedValueOnce({ rows: [] });

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    await GET(request);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT referrer_id FROM referrals'),
      [10]
    );
  });

  test('should prevent duplicate earning with ON CONFLICT', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, amount: 1499 }] })
      .mockResolvedValueOnce({ rows: [] }); // ON CONFLICT - no rows returned

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    await GET(request);

    // Should not update balance if earning already exists
    expect(mockQuery).toHaveBeenCalledTimes(3); // No 4th call for balance
  });

  test('should increment referral balance when exists', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, amount: 1499 }] })
      .mockResolvedValueOnce({ rows: [{ id: 100 }] })
      .mockResolvedValueOnce({ rows: [] });

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    await GET(request);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO referral_balances'),
      expect.arrayContaining([5, 149.9]) // 10% of 1499
    );
  });

  test('should insert referral balance when missing', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, amount: 999 }] })
      .mockResolvedValueOnce({ rows: [{ id: 100 }] })
      .mockResolvedValueOnce({ rows: [] });

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    await GET(request);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (user_id) DO UPDATE'),
      expect.arrayContaining([5, 99.9]) // 10% of 999
    );
  });

  test('should calculate 10% commission correctly', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, amount: 499 }] })
      .mockResolvedValueOnce({ rows: [{ id: 100 }] })
      .mockResolvedValueOnce({ rows: [] });

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    await GET(request);

    // Verify 10% calculation: 499 * 0.10 = 49.9
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO referral_earnings'),
      expect.arrayContaining([5, 10, 20, 49.9, 499])
    );
  });

  test('should skip processing when user has no referrer', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // No referrer

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    await GET(request);

    expect(mockQuery).toHaveBeenCalledTimes(1); // Only referral check
  });

  test('should skip processing when payment not found', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 5 }] })
      .mockResolvedValueOnce({ rows: [] }); // Payment not found

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    await GET(request);

    expect(mockQuery).toHaveBeenCalledTimes(2); // Early return after payment check
  });

  test('should not block response when INSERT earnings throws', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, amount: 1499 }] })
      .mockRejectedValueOnce(new Error('DB constraint violation'));

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(true); // Still returns success
  });

  test('should not block response when INSERT balances throws', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ referrer_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, amount: 1499 }] })
      .mockResolvedValueOnce({ rows: [{ id: 100 }] })
      .mockRejectedValueOnce(new Error('Balance update failed'));

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paid).toBe(true); // Still returns success
  });

  test('should handle referral processing error gracefully', async () => {
    const userIdentity = await import('@/lib/user-identity');
    const tbank = await import('@/lib/tbank');
    (userIdentity.findOrCreateUser as jest.Mock).mockResolvedValueOnce({ id: 10, telegram_user_id: 12345 });
    mockSql
      .mockResolvedValueOnce([{ tbank_payment_id: 'pay-123', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 20, user_id: 10 }]);
    (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce({ Status: 'CONFIRMED' });
    mockQuery.mockRejectedValueOnce(new Error('Referral query failed'));

    const { GET } = await import('@/app/api/payment/status/route');

    const request = createRequest({ telegram_user_id: '12345' });
    const response = await GET(request);
    const data = await response.json();

    // Should not crash - referral is non-critical
    expect(response.status).toBe(200);
    expect(data.paid).toBe(true);
    expect(data.status).toBe('succeeded');
  });
});
