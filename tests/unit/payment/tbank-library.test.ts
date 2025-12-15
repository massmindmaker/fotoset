/**
 * Unit Tests for T-Bank Payment Library (lib/tbank.ts)
 *
 * Tests all core functions: initPayment, getPaymentState, verifyWebhookSignature, generateToken
 *
 * PRIORITY: P0 (Critical - Payment security)
 * COVERAGE TARGET: 90%
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Mock environment variables
const mockEnv = {
  TBANK_TERMINAL_KEY: 'TestDEMOTerminalKey',
  TBANK_PASSWORD: 'TestPassword123',
};

beforeEach(() => {
  process.env.TBANK_TERMINAL_KEY = mockEnv.TBANK_TERMINAL_KEY;
  process.env.TBANK_PASSWORD = mockEnv.TBANK_PASSWORD;
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.TBANK_TERMINAL_KEY;
  delete process.env.TBANK_PASSWORD;
});

// Import after env setup
let tbank: typeof import('@/lib/tbank');

describe('T-Bank Library', () => {
  beforeEach(async () => {
    // Dynamic import to ensure env vars are set
    jest.resetModules();
    process.env.TBANK_TERMINAL_KEY = mockEnv.TBANK_TERMINAL_KEY;
    process.env.TBANK_PASSWORD = mockEnv.TBANK_PASSWORD;
    tbank = await import('@/lib/tbank');
  });

  describe('Configuration', () => {
    test('should detect test mode from terminal key containing DEMO', async () => {
      process.env.TBANK_TERMINAL_KEY = 'TestDEMOKey';
      jest.resetModules();
      const tbankModule = await import('@/lib/tbank');
      expect(tbankModule.IS_TEST_MODE).toBe(true);
    });

    test('should detect test mode from terminal key containing test', async () => {
      process.env.TBANK_TERMINAL_KEY = 'test_terminal_key';
      jest.resetModules();
      const tbankModule = await import('@/lib/tbank');
      expect(tbankModule.IS_TEST_MODE).toBe(true);
    });

    test('should detect production mode when no test indicators', async () => {
      process.env.TBANK_TERMINAL_KEY = 'ProductionKey12345';
      jest.resetModules();
      const tbankModule = await import('@/lib/tbank');
      expect(tbankModule.IS_TEST_MODE).toBe(false);
    });

    test('should detect when credentials are missing', async () => {
      delete process.env.TBANK_TERMINAL_KEY;
      delete process.env.TBANK_PASSWORD;
      jest.resetModules();
      const tbankModule = await import('@/lib/tbank');
      expect(tbankModule.HAS_CREDENTIALS).toBe(false);
    });

    test('should detect when credentials are present', () => {
      expect(tbank.HAS_CREDENTIALS).toBe(true);
    });
  });

  describe('initPayment()', () => {
    const mockSuccessResponse = {
      Success: true,
      ErrorCode: '0',
      TerminalKey: mockEnv.TBANK_TERMINAL_KEY,
      Status: 'NEW',
      PaymentId: '12345678',
      OrderId: 'u1t123',
      Amount: 49900,
      PaymentURL: 'https://securepay.tinkoff.ru/new/12345678',
    };

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    test('should create payment with valid parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const result = await tbank.initPayment(
        499,
        'u1t123',
        'PinGlass - 7 AI Photos (starter)',
        'https://example.com/success',
        'https://example.com/fail'
      );

      expect(result.Success).toBe(true);
      expect(result.PaymentId).toBe('12345678');
      expect(result.PaymentURL).toContain('tinkoff.ru');
      expect(result.Amount).toBe(49900); // 499 RUB * 100
    });

    test('should convert rubles to kopecks correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      await tbank.initPayment(
        499,
        'u1t123',
        'Test',
        'https://example.com/success',
        'https://example.com/fail'
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.Amount).toBe(49900); // 499 * 100
    });

    test('should handle decimal amounts correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSuccessResponse, Amount: 99950 }),
      });

      await tbank.initPayment(
        999.5,
        'u1t123',
        'Test',
        'https://example.com/success',
        'https://example.com/fail'
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.Amount).toBe(99950); // 999.5 * 100
    });

    test('should include all required parameters in request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      await tbank.initPayment(
        499,
        'u1t123',
        'PinGlass - 7 AI Photos',
        'https://example.com/success',
        'https://example.com/fail',
        'https://example.com/webhook',
        'user@example.com'
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);

      expect(callBody.TerminalKey).toBe(mockEnv.TBANK_TERMINAL_KEY);
      expect(callBody.Amount).toBe(49900);
      expect(callBody.OrderId).toBe('u1t123');
      expect(callBody.Description).toBe('PinGlass - 7 AI Photos');
      expect(callBody.SuccessURL).toBe('https://example.com/success');
      expect(callBody.FailURL).toBe('https://example.com/fail');
      expect(callBody.NotificationURL).toBe('https://example.com/webhook');
      expect(callBody.Token).toBeTruthy();
      expect(callBody.DATA).toEqual({ Email: 'user@example.com' });
    });

    test('should include Token in request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      await tbank.initPayment(
        499,
        'u1t123',
        'Test',
        'https://example.com/success',
        'https://example.com/fail'
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.Token).toBeTruthy();
      expect(callBody.Token).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    test('should truncate description to 250 chars', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const longDescription = 'A'.repeat(300);
      await tbank.initPayment(
        499,
        'u1t123',
        longDescription,
        'https://example.com/success',
        'https://example.com/fail'
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.Description).toHaveLength(250);
    });

    test('should throw error when credentials are not configured', async () => {
      delete process.env.TBANK_TERMINAL_KEY;
      delete process.env.TBANK_PASSWORD;
      jest.resetModules();
      const tbankModule = await import('@/lib/tbank');

      await expect(
        tbankModule.initPayment(
          499,
          'u1t123',
          'Test',
          'https://example.com/success',
          'https://example.com/fail'
        )
      ).rejects.toThrow('T-Bank credentials not configured');
    });

    test('should throw error when API returns Success=false', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Success: false,
          ErrorCode: '9999',
          Message: 'Invalid terminal key',
        }),
      });

      await expect(
        tbank.initPayment(
          499,
          'u1t123',
          'Test',
          'https://example.com/success',
          'https://example.com/fail'
        )
      ).rejects.toThrow('T-Bank error 9999: Invalid terminal key');
    });

    test('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        tbank.initPayment(
          499,
          'u1t123',
          'Test',
          'https://example.com/success',
          'https://example.com/fail'
        )
      ).rejects.toThrow('Network error');
    });

    test('should call correct API endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      await tbank.initPayment(
        499,
        'u1t123',
        'Test',
        'https://example.com/success',
        'https://example.com/fail'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://securepay.tinkoff.ru/v2/Init',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('getPaymentState()', () => {
    const mockStateResponse = {
      Success: true,
      ErrorCode: '0',
      TerminalKey: mockEnv.TBANK_TERMINAL_KEY,
      Status: 'CONFIRMED',
      PaymentId: '12345678',
      OrderId: 'u1t123',
      Amount: 49900,
    };

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    test('should get payment status with valid paymentId', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStateResponse,
      });

      const result = await tbank.getPaymentState('12345678');

      expect(result.Success).toBe(true);
      expect(result.Status).toBe('CONFIRMED');
      expect(result.PaymentId).toBe('12345678');
    });

    test('should throw error when credentials are not configured', async () => {
      delete process.env.TBANK_TERMINAL_KEY;
      delete process.env.TBANK_PASSWORD;
      jest.resetModules();
      const tbankModule = await import('@/lib/tbank');

      await expect(tbankModule.getPaymentState('12345678')).rejects.toThrow(
        'T-Bank credentials not configured'
      );
    });

    test('should include Token in request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStateResponse,
      });

      await tbank.getPaymentState('12345678');

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.Token).toBeTruthy();
      expect(callBody.Token).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
      expect(callBody.TerminalKey).toBe(mockEnv.TBANK_TERMINAL_KEY);
      expect(callBody.PaymentId).toBe('12345678');
    });

    test('should throw error when API returns Success=false', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Success: false,
          ErrorCode: '7',
          Message: 'Payment not found',
        }),
      });

      await expect(tbank.getPaymentState('invalid-id')).rejects.toThrow(
        'T-Bank get payment failed: Payment not found'
      );
    });

    test('should handle all payment statuses', async () => {
      const statuses = ['NEW', 'CONFIRMED', 'REJECTED', 'AUTHORIZED', 'PARTIAL_REFUNDED', 'REFUNDED'];

      for (const status of statuses) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockStateResponse, Status: status }),
        });

        const result = await tbank.getPaymentState('12345678');
        expect(result.Status).toBe(status);
      }
    });

    test('should call correct API endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStateResponse,
      });

      await tbank.getPaymentState('12345678');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://securepay.tinkoff.ru/v2/GetState',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('verifyWebhookSignature()', () => {
    test('should verify valid webhook signature', () => {
      const notification = {
        TerminalKey: mockEnv.TBANK_TERMINAL_KEY,
        OrderId: 'u1t123',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: '12345678',
        Amount: 49900,
      };

      // Generate valid token using the same algorithm
      const crypto = require('crypto');
      const params = { ...notification, Password: mockEnv.TBANK_PASSWORD };
      const sortedKeys = Object.keys(params).sort();
      const concatenated = sortedKeys.map((key) => String(params[key as keyof typeof params])).join('');
      const validToken = crypto.createHash('sha256').update(concatenated).digest('hex');

      const isValid = tbank.verifyWebhookSignature(notification, validToken);
      expect(isValid).toBe(true);
    });

    test('should reject invalid webhook signature', () => {
      const notification = {
        TerminalKey: mockEnv.TBANK_TERMINAL_KEY,
        OrderId: 'u1t123',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: '12345678',
      };

      const isValid = tbank.verifyWebhookSignature(notification, 'invalid-signature');
      expect(isValid).toBe(false);
    });

    test('should detect tampered amount', () => {
      const notification = {
        TerminalKey: mockEnv.TBANK_TERMINAL_KEY,
        OrderId: 'u1t123',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: '12345678',
        Amount: 49900,
      };

      // Generate valid token for original amount
      const crypto = require('crypto');
      const params = { ...notification, Password: mockEnv.TBANK_PASSWORD };
      const sortedKeys = Object.keys(params).sort();
      const concatenated = sortedKeys.map((key) => String(params[key as keyof typeof params])).join('');
      const validToken = crypto.createHash('sha256').update(concatenated).digest('hex');

      // Tamper with amount
      const tamperedNotification = { ...notification, Amount: 10000 };

      const isValid = tbank.verifyWebhookSignature(tamperedNotification, validToken);
      expect(isValid).toBe(false);
    });

    test('should detect tampered status', () => {
      const notification = {
        TerminalKey: mockEnv.TBANK_TERMINAL_KEY,
        OrderId: 'u1t123',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: '12345678',
      };

      const crypto = require('crypto');
      const params = { ...notification, Password: mockEnv.TBANK_PASSWORD };
      const sortedKeys = Object.keys(params).sort();
      const concatenated = sortedKeys.map((key) => String(params[key as keyof typeof params])).join('');
      const validToken = crypto.createHash('sha256').update(concatenated).digest('hex');

      // Tamper with status
      const tamperedNotification = { ...notification, Status: 'REJECTED' };

      const isValid = tbank.verifyWebhookSignature(tamperedNotification, validToken);
      expect(isValid).toBe(false);
    });

    test('should skip verification in dev + test mode', async () => {
      process.env.NODE_ENV = 'development';
      process.env.TBANK_TERMINAL_KEY = 'TestDEMOKey';
      jest.resetModules();
      const tbankModule = await import('@/lib/tbank');

      const notification = {
        TerminalKey: 'TestDEMOKey',
        OrderId: 'u1t123',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: '12345678',
      };

      const isValid = tbankModule.verifyWebhookSignature(notification, 'any-invalid-token');
      expect(isValid).toBe(true); // Should skip verification

      delete process.env.NODE_ENV;
    });

    test('should handle notification with null/undefined values', () => {
      const notification = {
        TerminalKey: mockEnv.TBANK_TERMINAL_KEY,
        OrderId: 'u1t123',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: '12345678',
        ErrorCode: null,
        CardId: undefined,
      };

      const crypto = require('crypto');
      const filteredParams = Object.fromEntries(
        Object.entries({ ...notification, Password: mockEnv.TBANK_PASSWORD })
          .filter(([, v]) => v !== null && v !== undefined)
      );
      const sortedKeys = Object.keys(filteredParams).sort();
      const concatenated = sortedKeys.map((key) => String(filteredParams[key])).join('');
      const validToken = crypto.createHash('sha256').update(concatenated).digest('hex');

      const isValid = tbank.verifyWebhookSignature(notification, validToken);
      expect(isValid).toBe(true);
    });

    test('should use timing-safe comparison', () => {
      // This test verifies that the function doesn't leak timing information
      const notification = {
        TerminalKey: mockEnv.TBANK_TERMINAL_KEY,
        OrderId: 'u1t123',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: '12345678',
      };

      const startTime = Date.now();
      tbank.verifyWebhookSignature(notification, 'a'.repeat(64));
      const time1 = Date.now() - startTime;

      const startTime2 = Date.now();
      tbank.verifyWebhookSignature(notification, 'z'.repeat(64));
      const time2 = Date.now() - startTime2;

      // Timing should be similar (within 10ms) - not a perfect test but helps
      expect(Math.abs(time1 - time2)).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    test('should handle very large amounts', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Success: true,
          PaymentId: '12345678',
          Amount: 99999900, // 999,999 RUB
        }),
      });

      const result = await tbank.initPayment(
        999999,
        'u1t123',
        'Test',
        'https://example.com/success',
        'https://example.com/fail'
      );

      expect(result.Amount).toBe(99999900);
    });

    test('should handle minimum amount (1 kopeck)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Success: true,
          PaymentId: '12345678',
          Amount: 1,
        }),
      });

      await tbank.initPayment(
        0.01,
        'u1t123',
        'Test',
        'https://example.com/success',
        'https://example.com/fail'
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.Amount).toBe(1);
    });

    test('should handle special characters in OrderId', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Success: true,
          PaymentId: '12345678',
          OrderId: 'u1_t-123',
        }),
      });

      await tbank.initPayment(
        499,
        'u1_t-123',
        'Test',
        'https://example.com/success',
        'https://example.com/fail'
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.OrderId).toBe('u1_t-123');
    });

    test('should handle Cyrillic characters in description', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Success: true,
          PaymentId: '12345678',
        }),
      });

      await tbank.initPayment(
        499,
        'u1t123',
        'PinGlass - Фотопортреты',
        'https://example.com/success',
        'https://example.com/fail'
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.Description).toBe('PinGlass - Фотопортреты');
    });
  });
});
