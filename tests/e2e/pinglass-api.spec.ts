import { test, expect } from '@playwright/test';

/**
 * PinGlass API Integration Tests
 *
 * Tests all API endpoints for correct responses and error handling
 */

const BASE_URL = process.env.TEST_URL || 'https://www.pinglass.ru';

test.describe('PinGlass API Endpoints', () => {
  const testDeviceId = `test-device-${Date.now()}`;

  test.describe('POST /api/user', () => {
    test('should create new user with device ID', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/user`, {
        data: {
          deviceId: testDeviceId,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('id');
      expect(data.deviceId).toBe(testDeviceId);
      expect(data.isPro).toBe(false); // New user should not be Pro
    });

    test('should return existing user on duplicate device ID', async ({ request }) => {
      // Create user first time
      const firstResponse = await request.post(`${BASE_URL}/api/user`, {
        data: { deviceId: testDeviceId },
      });
      const firstData = await firstResponse.json();

      // Request same device ID again
      const secondResponse = await request.post(`${BASE_URL}/api/user`, {
        data: { deviceId: testDeviceId },
      });
      const secondData = await secondResponse.json();

      // Should return same user ID
      expect(firstData.id).toBe(secondData.id);
    });

    test('should reject request without device ID', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/user`, {
        data: {},
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should reject invalid device ID format', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/user`, {
        data: {
          deviceId: '', // Empty string
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('POST /api/payment/create', () => {
    test('should create payment order', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/payment/create`, {
        data: {
          deviceId: testDeviceId,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('paymentId');
      expect(data).toHaveProperty('confirmationUrl');
      expect(data.confirmationUrl).toMatch(/^https?:\/\//); // Valid URL
      expect(data).toHaveProperty('testMode');
    });

    test('should create payment with avatar ID', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/payment/create`, {
        data: {
          deviceId: testDeviceId,
          avatarId: 'test-avatar-123',
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('paymentId');
    });

    test('should reject payment without device ID', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/payment/create`, {
        data: {},
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should handle T-Bank API errors gracefully', async ({ request }) => {
      // This test requires mocking or testing with invalid credentials
      // In real scenario, T-Bank might return errors

      const response = await request.post(`${BASE_URL}/api/payment/create`, {
        data: {
          deviceId: 'invalid-device-that-might-cause-error',
        },
      });

      // Should either succeed or return proper error
      if (!response.ok()) {
        const error = await response.json();
        expect(error).toHaveProperty('error');
      }
    });
  });

  test.describe('GET /api/payment/status', () => {
    test('should check payment status', async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/payment/status?device_id=${testDeviceId}&payment_id=test-payment-123`
      );

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data).toHaveProperty('isPro');
      expect(data).toHaveProperty('status');
      expect(typeof data.isPro).toBe('boolean');
    });

    test('should require device_id parameter', async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/payment/status?payment_id=test-payment-123`
      );

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should require payment_id parameter', async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/payment/status?device_id=${testDeviceId}`
      );

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('POST /api/generate', () => {
    test('should reject non-Pro user', async ({ request }) => {
      // Create non-Pro user
      await request.post(`${BASE_URL}/api/user`, {
        data: { deviceId: testDeviceId },
      });

      // Attempt generation
      const response = await request.post(`${BASE_URL}/api/generate`, {
        data: {
          deviceId: testDeviceId,
          avatarId: 'test-avatar-123',
          styleId: 'professional',
          referenceImages: ['base64-encoded-image'],
        },
      });

      expect(response.status()).toBe(403); // Forbidden
    });

    test('should accept Pro user generation request', async ({ request }) => {
      // This test requires setting up Pro user in database
      // Or mocking the Pro status check

      // Note: In real test, would need to:
      // 1. Create payment
      // 2. Complete payment
      // 3. Then test generation
    });

    test('should validate required fields', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/generate`, {
        data: {
          deviceId: testDeviceId,
          // Missing avatarId, styleId, referenceImages
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should validate style ID', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/generate`, {
        data: {
          deviceId: testDeviceId,
          avatarId: 'test-avatar-123',
          styleId: 'invalid-style', // Not professional/lifestyle/creative
          referenceImages: ['base64-encoded-image'],
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should validate reference images count', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/generate`, {
        data: {
          deviceId: testDeviceId,
          avatarId: 'test-avatar-123',
          styleId: 'professional',
          referenceImages: [], // Empty array
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('POST /api/payment/webhook', () => {
    test('should require valid T-Bank signature', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/payment/webhook`, {
        data: {
          TerminalKey: 'test',
          OrderId: 'test-order-123',
          Status: 'CONFIRMED',
        },
        // Missing or invalid Token (SHA256 signature)
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should handle payment.succeeded event', async ({ request }) => {
      // This test requires proper T-Bank signature generation
      // Would need to import tbank.ts and generate valid signature

      // Mock webhook payload
      const payload = {
        TerminalKey: process.env.TBANK_TERMINAL_KEY || 'test',
        OrderId: 'test-order-123',
        Status: 'CONFIRMED',
        // Token: generateSignature(payload), // Requires implementation
      };

      // In real test, would verify:
      // 1. Signature validation
      // 2. User Pro status updated
      // 3. Payment record updated in DB
    });
  });


  test.describe('API Error Handling', () => {
    test('should return JSON error responses', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/user`, {
        data: { invalid: 'data' },
      });

      if (!response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');

        const error = await response.json();
        expect(error).toHaveProperty('error');
      }
    });

    test('should handle CORS properly', async ({ request }) => {
      const response = await request.options(`${BASE_URL}/api/user`);

      // Should allow OPTIONS for CORS preflight
      expect([200, 204]).toContain(response.status());
    });

    test('should rate limit (if implemented)', async ({ request }) => {
      // Make many rapid requests
      const requests = Array.from({ length: 100 }, () =>
        request.post(`${BASE_URL}/api/user`, {
          data: { deviceId: `spam-${Math.random()}` },
        })
      );

      const responses = await Promise.all(requests);

      // If rate limiting exists, some should return 429
      // If not, all should succeed (but recommendation to add)
      const rateLimited = responses.some((r) => r.status() === 429);

      // Just document finding, don't assert
      if (!rateLimited) {
        console.warn('Warning: No rate limiting detected on /api/user');
      }
    });
  });

  test.describe('API Performance', () => {
    test('should respond quickly to user creation', async ({ request }) => {
      const start = Date.now();

      await request.post(`${BASE_URL}/api/user`, {
        data: { deviceId: `perf-test-${Date.now()}` },
      });

      const duration = Date.now() - start;

      // Should respond in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    test('should respond quickly to payment status check', async ({ request }) => {
      const start = Date.now();

      await request.get(
        `${BASE_URL}/api/payment/status?device_id=test&payment_id=test`
      );

      const duration = Date.now() - start;

      // Should respond in under 500ms
      expect(duration).toBeLessThan(500);
    });
  });

  test.describe('API Security', () => {
    test('should not expose sensitive data in errors', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/generate`, {
        data: { invalid: 'data' },
      });

      if (!response.ok()) {
        const error = await response.json();
        const errorString = JSON.stringify(error);

        // Should not leak credentials, API keys, database info
        expect(errorString).not.toContain('DATABASE_URL');
        expect(errorString).not.toContain('GOOGLE_API_KEY');
        expect(errorString).not.toContain('TBANK_PASSWORD');
        expect(errorString).not.toContain('postgresql://');
      }
    });

    test('should sanitize SQL injection attempts', async ({ request }) => {
      const maliciousDeviceId = "'; DROP TABLE users; --";

      const response = await request.post(`${BASE_URL}/api/user`, {
        data: { deviceId: maliciousDeviceId },
      });

      // Should either reject or sanitize
      if (response.ok()) {
        const data = await response.json();
        // Device ID should be sanitized or escaped
        expect(data.deviceId).not.toContain('DROP TABLE');
      }
    });

    test('should prevent XSS in user inputs', async ({ request }) => {
      const xssPayload = '<script>alert("XSS")</script>';

      const response = await request.post(`${BASE_URL}/api/user`, {
        data: { deviceId: xssPayload },
      });

      if (response.ok()) {
        const data = await response.json();
        // Should be escaped
        expect(data.deviceId).not.toContain('<script>');
      }
    });
  });
});
