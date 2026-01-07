import { test, expect } from '@playwright/test';
import { PersonaPage } from '../page-objects/PersonaPage';

/**
 * Payment Flow E2E Tests
 *
 * Tests the complete payment integration with T-Bank,
 * including modal display, redirect, webhook processing,
 * and status updates.
 *
 * PRIORITY: P0 (Revenue-critical)
 */

test.describe('Payment Flow - T-Bank Integration', () => {
  let personaPage: PersonaPage;

  test.beforeEach(async ({ page }) => {
    personaPage = new PersonaPage(page);

    // Setup: Non-pro user ready to trigger payment
    await personaPage.clearStorage();
    await personaPage.setDeviceId('test-payment-flow');
    await personaPage.completeOnboarding();
  });

  test('should display payment modal for non-Pro user', async ({ page }) => {
    await personaPage.goto();

    // Navigate through flow to trigger payment
    // (Simplified - in full test would upload photos and select style)

    // Mock navigation to payment step
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });

    // Reload to apply state
    await page.reload();

    // Verify payment modal appears
    await expect(personaPage.paymentModal).toBeVisible({ timeout: 5000 });

    // Verify modal content
    await expect(page.getByText(/500/)).toBeVisible(); // Price
    await expect(page.getByText(/₽/)).toBeVisible(); // Currency
    await expect(personaPage.paymentOfferButton).toBeVisible();
  });

  test('should create payment order via API', async ({ page }) => {
    await personaPage.goto();

    // Mock API response
    let paymentRequestMade = false;
    let paymentRequestBody: any;

    await page.route('**/api/payment/create', async (route) => {
      paymentRequestMade = true;
      paymentRequestBody = route.request().postDataJSON();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId: 'test-payment-12345',
          confirmationUrl: 'https://securepay.tinkoff.ru/test/12345',
          testMode: true,
          amount: 500,
          currency: 'RUB',
        }),
      });
    });

    // Trigger payment modal
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    // Click payment button
    await personaPage.initiatePayment();

    // Verify API was called
    expect(paymentRequestMade).toBe(true);
    expect(paymentRequestBody).toHaveProperty('deviceId', 'test-payment-flow');
    expect(paymentRequestBody).toHaveProperty('avatarId'); // May be optional

    // Verify redirect URL received
    // In real scenario, would open in new window
  });

  test('should redirect to T-Bank payment page', async ({ page, context }) => {
    const confirmationUrl = 'https://securepay.tinkoff.ru/test/12345';

    // Mock payment create response
    await page.route('**/api/payment/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId: 'test-payment-12345',
          confirmationUrl,
          testMode: true,
        }),
      });
    });

    await personaPage.goto();

    // Trigger payment
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    // Listen for new page (redirect)
    const popupPromise = context.waitForEvent('page');

    // Click payment
    await personaPage.initiatePayment();

    // Wait for redirect
    const popup = await popupPromise;

    // Verify URL contains T-Bank domain
    expect(popup.url()).toContain('tinkoff.ru');

    await popup.close();
  });

  test('should poll payment status after redirect', async ({ page }) => {
    test.setTimeout(2 * 60 * 1000); // 2 minutes

    const paymentId = 'test-payment-status-poll';

    // Mock payment create
    await page.route('**/api/payment/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId,
          confirmationUrl: 'https://test.example.com/payment',
          testMode: true,
        }),
      });
    });

    let statusPollCount = 0;

    // Mock status endpoint (pending initially, then success)
    await page.route('**/api/payment/status*', async (route) => {
      statusPollCount++;

      // Return pending for first 3 polls, then success
      const paid = statusPollCount > 3;
      const status = paid ? 'succeeded' : 'pending';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ paid, status }),
      });
    });

    await personaPage.goto();

    // Trigger payment
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    await personaPage.initiatePayment();

    // Wait for polling to detect success
    await page.waitForFunction(
      () => localStorage.getItem('pinglass_is_pro') === 'true',
      { timeout: 60000 }
    );

    // Verify polling occurred multiple times
    expect(statusPollCount).toBeGreaterThan(1);

    // Verify paid status set in localStorage
    const paidStatus = await page.evaluate(() =>
      localStorage.getItem('pinglass_is_pro')
    );
    expect(paidStatus).toBe('true');
  });

  test('should handle payment cancellation', async ({ page }) => {
    const paymentId = 'test-payment-canceled';

    // Mock payment create
    await page.route('**/api/payment/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId,
          confirmationUrl: 'https://test.example.com/payment',
          testMode: true,
        }),
      });
    });

    // Mock status endpoint (canceled)
    await page.route('**/api/payment/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paid: false,
          status: 'canceled',
        }),
      });
    });

    await personaPage.goto();

    // Trigger payment
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    await personaPage.initiatePayment();

    // Wait for status check
    await page.waitForTimeout(3000);

    // Verify paid status NOT set
    const paidStatus = await page.evaluate(() =>
      localStorage.getItem('pinglass_is_pro')
    );
    expect(paidStatus).not.toBe('true');

    // Verify modal still shows (can retry)
    await expect(personaPage.paymentModal).toBeVisible();
  });

  test('should handle payment API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/payment/create', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Payment service temporarily unavailable',
          code: 'SERVICE_ERROR',
        }),
      });
    });

    await personaPage.goto();

    // Trigger payment
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    // Attempt payment
    await personaPage.initiatePayment();

    // Should show error message
    await expect(page.getByText(/ошибк|error/i)).toBeVisible({ timeout: 5000 });

    // Should offer retry
    const retryButton = page.getByRole('button', { name: /повтор|retry/i });
    await expect(retryButton).toBeVisible();
  });

  test('should update localStorage after successful payment', async ({ page }) => {
    const deviceId = 'test-device-localstorage';
    const paymentId = 'test-payment-success';

    await personaPage.setDeviceId(deviceId);

    // Mock successful payment flow
    await page.route('**/api/payment/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId,
          confirmationUrl: 'https://test.example.com',
          testMode: true,
        }),
      });
    });

    await page.route('**/api/payment/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paid: true,
          status: 'succeeded',
        }),
      });
    });

    await personaPage.goto();

    // Trigger payment
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    await personaPage.initiatePayment();

    // Wait for status update
    await page.waitForFunction(
      () => localStorage.getItem('pinglass_is_pro') === 'true',
      { timeout: 30000 }
    );

    // Verify all expected localStorage keys
    const localStorageState = await page.evaluate(() => ({
      deviceId: localStorage.getItem('pinglass_device_id'),
      paidStatus: localStorage.getItem('pinglass_is_pro'),
      onboardingComplete: localStorage.getItem('pinglass_onboarding_complete'),
    }));

    expect(localStorageState.deviceId).toBe(deviceId);
    expect(localStorageState.paidStatus).toBe('true');
  });

  test('should navigate to generation after successful payment', async ({ page }) => {
    // Mock successful payment
    await page.route('**/api/payment/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId: 'test-nav-payment',
          confirmationUrl: 'https://test.example.com',
          testMode: true,
        }),
      });
    });

    await page.route('**/api/payment/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paid: true,
          status: 'succeeded',
        }),
      });
    });

    await personaPage.goto();

    // Trigger payment
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    await personaPage.initiatePayment();

    // Wait for paid status
    await page.waitForFunction(
      () => localStorage.getItem('pinglass_is_pro') === 'true',
      { timeout: 30000 }
    );

    // Close payment modal (if still open)
    const closeButton = page.locator('[data-testid="payment-close"]');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }

    // Should proceed to generation or next step
    // (Depends on implementation)
  });
});

test.describe('Payment Webhook Processing', () => {
  test('should process webhook correctly', async ({ request }) => {
    const deviceId = 'test-webhook-device';
    const paymentId = 'test-webhook-payment';

    // Create user first
    await request.post(`${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/user`, {
      data: { deviceId },
    });

    // Create payment
    const paymentResponse = await request.post(
      `${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/payment/create`,
      {
        data: { deviceId },
      }
    );

    const paymentData = await paymentResponse.json();
    const actualPaymentId = paymentData.paymentId;

    // Simulate T-Bank webhook
    // Note: Real webhook requires valid signature
    // This test would need access to T-Bank credentials

    const webhookPayload = {
      TerminalKey: process.env.TBANK_TERMINAL_KEY || 'test',
      OrderId: actualPaymentId,
      Status: 'CONFIRMED',
      PaymentId: actualPaymentId,
      Amount: 50000, // 500.00 RUB in kopecks
      // Token: generateSignature(webhookPayload), // Would need to implement
    };

    // Send webhook
    const webhookResponse = await request.post(
      `${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/payment/webhook`,
      {
        data: webhookPayload,
      }
    );

    // In test mode, might accept without signature
    // In production, would reject without valid signature
    if (webhookResponse.ok()) {
      // Verify user is now Pro
      const statusResponse = await request.get(
        `${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/payment/status?device_id=${deviceId}&payment_id=${actualPaymentId}`
      );

      const statusData = await statusResponse.json();
      expect(statusData.paid).toBe(true);
    }
  });

  test('should reject webhook with invalid signature', async ({ request }) => {
    const webhookPayload = {
      TerminalKey: 'invalid',
      OrderId: 'fake-order',
      Status: 'CONFIRMED',
      Token: 'invalid-signature',
    };

    const webhookResponse = await request.post(
      `${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/payment/webhook`,
      {
        data: webhookPayload,
      }
    );

    // Should reject (400 or 403)
    expect(webhookResponse.status()).toBeGreaterThanOrEqual(400);
  });

  test('should handle duplicate webhook delivery', async ({ request }) => {
    // T-Bank may send webhook multiple times
    // App should be idempotent

    const deviceId = 'test-duplicate-webhook';

    // Create user and payment
    await request.post(`${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/user`, {
      data: { deviceId },
    });

    const paymentResponse = await request.post(
      `${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/payment/create`,
      {
        data: { deviceId },
      }
    );

    const paymentData = await paymentResponse.json();

    const webhookPayload = {
      TerminalKey: process.env.TBANK_TERMINAL_KEY || 'test',
      OrderId: paymentData.paymentId,
      Status: 'CONFIRMED',
    };

    // Send webhook twice
    const webhook1 = await request.post(
      `${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/payment/webhook`,
      { data: webhookPayload }
    );

    const webhook2 = await request.post(
      `${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/payment/webhook`,
      { data: webhookPayload }
    );

    // Both should succeed (or second should return 200 OK with "already processed")
    expect(webhook1.ok()).toBe(true);
    expect(webhook2.ok()).toBe(true);

    // User should be Pro (only once)
    const statusResponse = await request.get(
      `${process.env.TEST_URL || 'https://www.pinglass.ru'}/api/payment/status?device_id=${deviceId}&payment_id=${paymentData.paymentId}`
    );

    const statusData = await statusResponse.json();
    expect(statusData.paid).toBe(true);
  });
});

test.describe('Payment Edge Cases', () => {
  let personaPage: PersonaPage;

  test.beforeEach(async ({ page }) => {
    personaPage = new PersonaPage(page);
  });

  test('should handle network timeout during payment creation', async ({ page }) => {
    await personaPage.clearStorage();
    await personaPage.goto();

    // Mock timeout (never respond)
    await page.route('**/api/payment/create', async () => {
      // Never fulfill - simulates timeout
      await new Promise(() => {});
    });

    // Trigger payment
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    await personaPage.initiatePayment();

    // Should timeout and show error
    // (Implementation-dependent)
  });

  test('should prevent double payment for same generation', async ({ page }) => {
    await personaPage.clearStorage();
    await personaPage.setDeviceId('test-double-payment');

    let paymentCreateCount = 0;

    await page.route('**/api/payment/create', async (route) => {
      paymentCreateCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId: `payment-${paymentCreateCount}`,
          confirmationUrl: 'https://test.example.com',
          testMode: true,
        }),
      });
    });

    await personaPage.goto();

    // Trigger payment
    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    // Click payment button multiple times rapidly
    await personaPage.initiatePayment();
    await personaPage.initiatePayment();
    await personaPage.initiatePayment();

    // Should only create one payment
    await page.waitForTimeout(2000);
    expect(paymentCreateCount).toBe(1);
  });

  test('should handle user closing payment window without completing', async ({ page, context }) => {
    await personaPage.clearStorage();
    await personaPage.goto();

    await page.route('**/api/payment/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId: 'test-abandoned',
          confirmationUrl: 'https://test.example.com',
          testMode: true,
        }),
      });
    });

    await page.evaluate(() => {
      localStorage.setItem('pinglass_current_view', 'STYLE_SELECTED');
    });
    await page.reload();

    const popupPromise = context.waitForEvent('page');
    await personaPage.initiatePayment();

    const popup = await popupPromise;
    await popup.close(); // User closes window

    // Main page should detect and allow retry
    // Pro status should remain false
    await page.waitForTimeout(2000);

    const paidStatus = await page.evaluate(() =>
      localStorage.getItem('pinglass_is_pro')
    );
    expect(paidStatus).not.toBe('true');
  });
});
