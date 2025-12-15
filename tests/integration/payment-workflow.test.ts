/**
 * Integration Tests for Payment Workflow
 *
 * Tests the interaction between payment API routes, database, and T-Bank API
 * Uses real database (test instance) and mocked T-Bank responses
 *
 * PRIORITY: P0 (Critical business logic)
 * COVERAGE TARGET: 80%
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { sql, query } from '@/lib/db';
import * as tbank from '@/lib/tbank';
import {
  testUsers,
  paymentTiers,
  tbankResponses,
  webhookPayloads,
  generateWebhookToken,
} from '../fixtures/payment-data';

// Mock T-Bank API calls (but use real DB)
jest.mock('@/lib/tbank', () => ({
  ...jest.requireActual('@/lib/tbank'),
  initPayment: jest.fn(),
  getPaymentState: jest.fn(),
}));

describe('Payment Workflow Integration', () => {
  let testUserId: number;
  let testDeviceId: string;

  beforeEach(async () => {
    // Create test user
    testDeviceId = `test-device-${Date.now()}`;
    const userResult = await sql`
      INSERT INTO users (device_id)
      VALUES (${testDeviceId})
      RETURNING id
    `;
    testUserId = userResult[0].id;
  });

  afterEach(async () => {
    // Cleanup test data
    await sql`DELETE FROM payments WHERE user_id = ${testUserId}`;
    await sql`DELETE FROM users WHERE id = ${testUserId}`;
  });

  describe('Create Payment Flow', () => {
    test('should create payment record and return T-Bank URL', async () => {
      // Mock T-Bank response
      (tbank.initPayment as jest.Mock).mockResolvedValueOnce(tbankResponses.initSuccess);

      // Simulate API call
      const { POST } = await import('@/app/api/payment/create/route');
      const request = new Request('http://localhost:3000/api/payment/create', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: testDeviceId,
          tierId: 'starter',
          email: 'test@example.com',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      // Verify API response
      expect(response.status).toBe(200);
      expect(data.paymentId).toBe(tbankResponses.initSuccess.PaymentId);
      expect(data.confirmationUrl).toContain('tinkoff.ru');
      expect(data.testMode).toBe(true);

      // Verify database record
      const dbPayment = await sql`
        SELECT * FROM payments
        WHERE user_id = ${testUserId}
        AND tbank_payment_id = ${data.paymentId}
      `.then((rows) => rows[0]);

      expect(dbPayment).toBeDefined();
      expect(dbPayment.amount).toBe('499');
      expect(dbPayment.status).toBe('pending');
    });

    test('should create user if not exists', async () => {
      const newDeviceId = `new-device-${Date.now()}`;

      (tbank.initPayment as jest.Mock).mockResolvedValueOnce(tbankResponses.initSuccess);

      const { POST } = await import('@/app/api/payment/create/route');
      const request = new Request('http://localhost:3000/api/payment/create', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: newDeviceId,
          tierId: 'starter',
        }),
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);

      // Verify user was created
      const newUser = await sql`
        SELECT * FROM users WHERE device_id = ${newDeviceId}
      `.then((rows) => rows[0]);

      expect(newUser).toBeDefined();

      // Cleanup
      await sql`DELETE FROM payments WHERE user_id = ${newUser.id}`;
      await sql`DELETE FROM users WHERE id = ${newUser.id}`;
    });

    test('should handle all three tiers correctly', async () => {
      for (const [tierId, tierData] of Object.entries(paymentTiers)) {
        const mockResponse = {
          ...tbankResponses.initSuccess,
          Amount: tierData.price * 100,
        };

        (tbank.initPayment as jest.Mock).mockResolvedValueOnce(mockResponse);

        const { POST } = await import('@/app/api/payment/create/route');
        const request = new Request('http://localhost:3000/api/payment/create', {
          method: 'POST',
          body: JSON.stringify({
            deviceId: testDeviceId,
            tierId,
          }),
        });

        const response = await POST(request as any);
        const data = await response.json();

        expect(response.status).toBe(200);

        // Verify initPayment was called with correct amount
        expect(tbank.initPayment).toHaveBeenCalledWith(
          tierData.price,
          expect.any(String),
          expect.stringContaining(`${tierData.photos} AI Photos`),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          undefined,
          undefined
        );

        // Cleanup payment
        await sql`DELETE FROM payments WHERE tbank_payment_id = ${mockResponse.PaymentId}`;
      }
    });
  });

  describe('Payment Status Flow', () => {
    let paymentId: string;

    beforeEach(async () => {
      // Create test payment
      paymentId = `test-payment-${Date.now()}`;
      await sql`
        INSERT INTO payments (user_id, tbank_payment_id, amount, status)
        VALUES (${testUserId}, ${paymentId}, 499, 'pending')
      `;
    });

    test('should check payment status via T-Bank API', async () => {
      (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce(
        tbankResponses.stateConfirmed
      );

      const { GET } = await import('@/app/api/payment/status/route');
      const request = new Request(
        `http://localhost:3000/api/payment/status?device_id=${testDeviceId}&payment_id=${paymentId}`
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paid).toBe(true);
      expect(data.status).toBe('succeeded');

      // Verify database was updated
      const updatedPayment = await sql`
        SELECT status FROM payments WHERE tbank_payment_id = ${paymentId}
      `.then((rows) => rows[0]);

      expect(updatedPayment.status).toBe('succeeded');
    });

    test('should return pending for NEW status', async () => {
      (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce(tbankResponses.stateNew);

      const { GET } = await import('@/app/api/payment/status/route');
      const request = new Request(
        `http://localhost:3000/api/payment/status?device_id=${testDeviceId}&payment_id=${paymentId}`
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.paid).toBe(false);
      expect(data.status).toBe('new');
    });

    test('should find latest payment if payment_id not provided', async () => {
      (tbank.getPaymentState as jest.Mock).mockResolvedValueOnce(
        tbankResponses.stateConfirmed
      );

      const { GET } = await import('@/app/api/payment/status/route');
      const request = new Request(
        `http://localhost:3000/api/payment/status?device_id=${testDeviceId}`
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.paid).toBe(true);

      // Verify correct payment was checked
      expect(tbank.getPaymentState).toHaveBeenCalledWith(paymentId);
    });

    test('should return immediately if already succeeded in DB', async () => {
      // Update payment to succeeded
      await sql`
        UPDATE payments SET status = 'succeeded'
        WHERE tbank_payment_id = ${paymentId}
      `;

      const { GET } = await import('@/app/api/payment/status/route');
      const request = new Request(
        `http://localhost:3000/api/payment/status?device_id=${testDeviceId}`
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.paid).toBe(true);
      expect(data.status).toBe('succeeded');

      // Should NOT call T-Bank API
      expect(tbank.getPaymentState).not.toHaveBeenCalled();
    });

    test('should fall back to DB if T-Bank API fails', async () => {
      // Update payment to succeeded in DB
      await sql`
        UPDATE payments SET status = 'succeeded'
        WHERE tbank_payment_id = ${paymentId}
      `;

      // Mock T-Bank error
      (tbank.getPaymentState as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { GET } = await import('@/app/api/payment/status/route');
      const request = new Request(
        `http://localhost:3000/api/payment/status?device_id=${testDeviceId}&payment_id=${paymentId}`
      );

      const response = await GET(request as any);
      const data = await response.json();

      // Should still return success from DB
      expect(data.paid).toBe(true);
      expect(data.status).toBe('succeeded');
    });
  });

  describe('Webhook Flow', () => {
    let paymentId: string;

    beforeEach(async () => {
      paymentId = `test-payment-webhook-${Date.now()}`;
      await sql`
        INSERT INTO payments (user_id, tbank_payment_id, amount, status)
        VALUES (${testUserId}, ${paymentId}, 499, 'pending')
      `;
    });

    test('should process CONFIRMED webhook and update payment', async () => {
      const payload = {
        ...webhookPayloads.confirmed,
        PaymentId: paymentId,
      };
      payload.Token = generateWebhookToken(payload);

      const { POST } = await import('@/app/api/payment/webhook/route');
      const request = new Request('http://localhost:3000/api/payment/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify payment status updated
      const updatedPayment = await sql`
        SELECT status FROM payments WHERE tbank_payment_id = ${paymentId}
      `.then((rows) => rows[0]);

      expect(updatedPayment.status).toBe('succeeded');
    });

    test('should process REJECTED webhook', async () => {
      const payload = {
        ...webhookPayloads.rejected,
        PaymentId: paymentId,
      };
      payload.Token = generateWebhookToken(payload);

      const { POST } = await import('@/app/api/payment/webhook/route');
      const request = new Request('http://localhost:3000/api/payment/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);

      // Verify payment status
      const updatedPayment = await sql`
        SELECT status FROM payments WHERE tbank_payment_id = ${paymentId}
      `.then((rows) => rows[0]);

      expect(updatedPayment.status).toBe('canceled');
    });

    test('should reject webhook with invalid signature', async () => {
      const payload = {
        ...webhookPayloads.confirmed,
        PaymentId: paymentId,
        Token: 'invalid-signature-123',
      };

      const { POST } = await import('@/app/api/payment/webhook/route');
      const request = new Request('http://localhost:3000/api/payment/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Invalid signature');

      // Payment should NOT be updated
      const payment = await sql`
        SELECT status FROM payments WHERE tbank_payment_id = ${paymentId}
      `.then((rows) => rows[0]);

      expect(payment.status).toBe('pending');
    });
  });

  describe('Referral Program Integration', () => {
    let referrerId: number;
    let referredId: number;
    let referralCode: string;
    let paymentId: string;

    beforeEach(async () => {
      // Create referrer
      const referrerResult = await sql`
        INSERT INTO users (device_id)
        VALUES (${`referrer-${Date.now()}`})
        RETURNING id
      `;
      referrerId = referrerResult[0].id;

      // Create referral code
      referralCode = `TEST${Date.now().toString(36).toUpperCase()}`;
      await query(
        'INSERT INTO referral_codes (user_id, code, is_active) VALUES ($1, $2, true)',
        [referrerId, referralCode]
      );

      // Create referred user
      const referredResult = await sql`
        INSERT INTO users (device_id)
        VALUES (${`referred-${Date.now()}`})
        RETURNING id
      `;
      referredId = referredResult[0].id;

      // Create referral relationship
      await query(
        'INSERT INTO referrals (referrer_id, referred_id, referral_code) VALUES ($1, $2, $3)',
        [referrerId, referredId, referralCode]
      );

      // Create payment for referred user
      paymentId = `test-payment-ref-${Date.now()}`;
      const paymentResult = await sql`
        INSERT INTO payments (user_id, tbank_payment_id, amount, status)
        VALUES (${referredId}, ${paymentId}, 499, 'pending')
        RETURNING id
      `;
    });

    afterEach(async () => {
      // Cleanup
      await query('DELETE FROM referral_earnings WHERE referrer_id = $1', [referrerId]);
      await query('DELETE FROM referral_balances WHERE user_id = $1', [referrerId]);
      await query('DELETE FROM referrals WHERE referrer_id = $1', [referrerId]);
      await query('DELETE FROM referral_codes WHERE user_id = $1', [referrerId]);
      await sql`DELETE FROM payments WHERE tbank_payment_id = ${paymentId}`;
      await sql`DELETE FROM users WHERE id = ${referrerId}`;
      await sql`DELETE FROM users WHERE id = ${referredId}`;
    });

    test('should calculate and credit referral earning on payment success', async () => {
      const payload = {
        ...webhookPayloads.confirmed,
        PaymentId: paymentId,
      };
      payload.Token = generateWebhookToken(payload);

      const { POST } = await import('@/app/api/payment/webhook/route');
      const request = new Request('http://localhost:3000/api/payment/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await POST(request as any);

      // Verify earning was created
      const earnings = await query(
        'SELECT * FROM referral_earnings WHERE referrer_id = $1',
        [referrerId]
      );

      expect(earnings.rows.length).toBe(1);
      expect(Number(earnings.rows[0].amount)).toBe(49.9); // 10% of 499
      expect(Number(earnings.rows[0].original_amount)).toBe(499);

      // Verify balance was updated
      const balance = await query(
        'SELECT * FROM referral_balances WHERE user_id = $1',
        [referrerId]
      );

      expect(balance.rows.length).toBe(1);
      expect(Number(balance.rows[0].balance)).toBe(49.9);
      expect(Number(balance.rows[0].total_earned)).toBe(49.9);
    });

    test('should not create duplicate earning if webhook fires twice (idempotency)', async () => {
      const payload = {
        ...webhookPayloads.confirmed,
        PaymentId: paymentId,
      };
      payload.Token = generateWebhookToken(payload);

      const { POST } = await import('@/app/api/payment/webhook/route');

      // First webhook
      const request1 = new Request('http://localhost:3000/api/payment/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await POST(request1 as any);

      // Second webhook (duplicate)
      const request2 = new Request('http://localhost:3000/api/payment/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await POST(request2 as any);

      // Should only have one earning
      const earnings = await query(
        'SELECT * FROM referral_earnings WHERE referrer_id = $1',
        [referrerId]
      );

      expect(earnings.rows.length).toBe(1);

      // Balance should not be doubled
      const balance = await query(
        'SELECT * FROM referral_balances WHERE user_id = $1',
        [referrerId]
      );

      expect(Number(balance.rows[0].balance)).toBe(49.9);
    });

    test('should handle referral earning calculation for different tiers', async () => {
      const tiers = [
        { amount: 499, expected: 49.9 },
        { amount: 999, expected: 99.9 },
        { amount: 1499, expected: 149.9 },
      ];

      for (const tier of tiers) {
        const testPaymentId = `test-payment-tier-${tier.amount}-${Date.now()}`;

        await sql`
          INSERT INTO payments (user_id, tbank_payment_id, amount, status)
          VALUES (${referredId}, ${testPaymentId}, ${tier.amount}, 'pending')
        `;

        const payload = {
          ...webhookPayloads.confirmed,
          PaymentId: testPaymentId,
        };
        payload.Token = generateWebhookToken(payload);

        const { POST } = await import('@/app/api/payment/webhook/route');
        const request = new Request('http://localhost:3000/api/payment/webhook', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        await POST(request as any);

        const earnings = await query(
          'SELECT * FROM referral_earnings WHERE payment_id = (SELECT id FROM payments WHERE tbank_payment_id = $1)',
          [testPaymentId]
        );

        expect(Number(earnings.rows[0].amount)).toBe(tier.expected);

        // Cleanup
        await sql`DELETE FROM payments WHERE tbank_payment_id = ${testPaymentId}`;
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle T-Bank API errors gracefully', async () => {
      (tbank.initPayment as jest.Mock).mockRejectedValueOnce(
        new Error('T-Bank error 9999: Internal server error')
      );

      const { POST } = await import('@/app/api/payment/create/route');
      const request = new Request('http://localhost:3000/api/payment/create', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: testDeviceId,
          tierId: 'starter',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });

    test('should handle database errors during payment creation', async () => {
      // Create invalid user ID scenario
      const { POST } = await import('@/app/api/payment/create/route');
      const request = new Request('http://localhost:3000/api/payment/create', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: '', // Invalid
          tierId: 'starter',
        }),
      });

      const response = await POST(request as any);

      expect(response.status).toBe(400);
    });
  });
});
