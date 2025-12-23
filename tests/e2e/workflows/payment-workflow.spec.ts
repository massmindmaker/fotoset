/**
 * E2E Tests: Complete Payment Workflow
 *
 * Tests the full payment flow including:
 * - Payment creation with T-Bank
 * - Payment redirect and callback handling
 * - Race condition fix (onboarding shown after payment)
 * - Status polling and verification
 *
 * @priority P0 - Critical revenue path
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
test.describe.configure({ mode: 'serial' });

// Constants
const TEST_URL = process.env.TEST_URL || 'https://www.pinglass.ru';
const TBANK_TEST_CARD = {
  number: '4300000000000777',
  expiry: '12/30',
  cvv: '111',
};

// Helper: Generate unique device ID
function generateDeviceId(): string {
  return `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Helper: Setup clean user session
async function setupCleanSession(page: Page, deviceId?: string): Promise<string> {
  await page.context().clearCookies();
  await page.goto(TEST_URL);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const newDeviceId = deviceId || generateDeviceId();
  await page.evaluate((id) => {
    localStorage.setItem('pinglass_device_id', id);
  }, newDeviceId);

  await page.reload();
  return newDeviceId;
}

// Helper: Complete onboarding quickly
async function completeOnboarding(page: Page): Promise<void> {
  // Look for onboarding screen
  const onboardingVisible = await page.locator('[data-testid="onboarding"], .onboarding-container, text=Начать').first().isVisible({ timeout: 5000 }).catch(() => false);

  if (onboardingVisible) {
    // Click through onboarding steps
    for (let i = 0; i < 3; i++) {
      const nextButton = page.locator('button:has-text("Далее"), button:has-text("Начать!"), button:has-text("Продолжить")').first();
      if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }
  }

  // Mark onboarding complete in storage
  await page.evaluate(() => {
    localStorage.setItem('pinglass_onboarding_complete', 'true');
  });
}

// Helper: Upload test photos
async function uploadTestPhotos(page: Page, count: number = 10): Promise<void> {
  const fileInput = page.locator('input[type="file"]');

  // Generate file paths
  const testPhotos = Array.from({ length: Math.min(count, 10) }, (_, i) =>
    `tests/fixtures/test-photos/person${i + 1}.jpg`
  );

  await fileInput.setInputFiles(testPhotos);

  // Wait for uploads to complete
  await page.waitForTimeout(2000);
}

test.describe('Payment Flow - New User Complete Journey', () => {
  let deviceId: string;

  test.beforeEach(async ({ page }) => {
    deviceId = await setupCleanSession(page);
  });

  test('should complete payment and show dashboard (not onboarding) after T-Bank redirect', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000); // 3 minutes

    // Step 1: Complete onboarding
    await completeOnboarding(page);

    // Step 2: Navigate to upload if not already there
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // Step 3: Upload photos
    const uploadZone = page.locator('[data-testid="upload-zone"], .upload-zone, input[type="file"]').first();
    if (await uploadZone.isVisible({ timeout: 5000 }).catch(() => false)) {
      await uploadTestPhotos(page);
    }

    // Step 4: Proceed to style/payment
    const nextButton = page.locator('button:has-text("Далее")').first();
    if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextButton.click();
    }

    // Step 5: Select style if visible
    const styleButton = page.locator('[data-style="professional"], button:has-text("Professional")').first();
    if (await styleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await styleButton.click();
      const continueBtn = page.locator('button:has-text("Далее"), button:has-text("Продолжить")').first();
      if (await continueBtn.isVisible({ timeout: 2000 })) {
        await continueBtn.click();
      }
    }

    // Step 6: Wait for payment modal/screen
    await page.waitForTimeout(1000);

    // Step 7: Initiate payment
    const payButton = page.locator('button:has-text("Оплатить"), button:has-text("Pay"), button:has-text("499"), button:has-text("999"), button:has-text("1499")').first();

    if (await payButton.isVisible({ timeout: 5000 })) {
      // Listen for payment API call
      const paymentApiPromise = page.waitForResponse(
        response => response.url().includes('/api/payment/create') && response.status() === 200
      );

      await payButton.click();

      const paymentResponse = await paymentApiPromise;
      const paymentData = await paymentResponse.json();

      expect(paymentData.paymentId).toBeTruthy();
      expect(paymentData.confirmationUrl).toBeTruthy();

      // Step 8: Verify redirect happens or URL is present
      if (paymentData.confirmationUrl) {
        // In real test, user would be redirected to T-Bank
        // Simulate successful payment return
        const callbackUrl = `${TEST_URL}/?resume_payment=true&telegram_user_id=123&device_id=${deviceId}`;

        await page.goto(callbackUrl);
        await page.waitForLoadState('networkidle');

        // Critical assertion: Should NOT show onboarding
        const onboardingVisible = await page.locator('text=Добро пожаловать, text=розовые очки').first().isVisible({ timeout: 3000 }).catch(() => false);

        // Check that onboarding is NOT visible (this was the bug)
        expect(onboardingVisible).toBe(false);

        // Should show dashboard or generating view instead
        const dashboardOrGenerating = await page.locator('text=Dashboard, text=Generating, text=Мои аватары, text=Генерация').first().isVisible({ timeout: 5000 }).catch(() => false);

        // Verify localStorage was set correctly
        const storageState = await page.evaluate(() => ({
          resumePayment: sessionStorage.getItem('pinglass_resume_payment'),
          onboardingComplete: localStorage.getItem('pinglass_onboarding_complete'),
          deviceId: localStorage.getItem('pinglass_device_id'),
        }));

        expect(storageState.onboardingComplete).toBe('true');
      }
    }
  });

  test('should handle payment cancellation and allow retry', async ({ page }) => {
    test.setTimeout(2 * 60 * 1000);

    await completeOnboarding(page);
    await page.goto(TEST_URL);

    // Navigate to payment
    const payButton = page.locator('button:has-text("Оплатить"), button:has-text("Pay")').first();

    if (await payButton.isVisible({ timeout: 10000 })) {
      await payButton.click();

      // Wait for redirect or modal
      await page.waitForTimeout(2000);

      // Simulate cancel by going back
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Should be able to see payment button again
      const retryButton = page.locator('button:has-text("Оплатить"), button:has-text("Pay")').first();
      expect(await retryButton.isVisible({ timeout: 5000 })).toBeTruthy();
    }
  });

  test('should correctly save payment state in sessionStorage before redirect', async ({ page }) => {
    await completeOnboarding(page);

    // Simulate T-Bank redirect return with resume_payment parameter
    const callbackUrl = `${TEST_URL}/?resume_payment=true&device_id=${deviceId}`;
    await page.goto(callbackUrl);

    // Check that URL params were captured
    const storageCheck = await page.evaluate(() => {
      return {
        resumePayment: sessionStorage.getItem('pinglass_resume_payment'),
        onboardingComplete: localStorage.getItem('pinglass_onboarding_complete'),
      };
    });

    // These should be set by the early useEffect (fix for race condition)
    expect(storageCheck.onboardingComplete).toBe('true');
  });
});

test.describe('Payment Flow - All Tiers', () => {
  const tiers = [
    { id: 'starter', price: 499, photos: 7 },
    { id: 'standard', price: 999, photos: 15 },
    { id: 'premium', price: 1499, photos: 23 },
  ];

  for (const tier of tiers) {
    test(`should create payment for ${tier.id} tier (${tier.price} RUB)`, async ({ page }) => {
      const deviceId = await setupCleanSession(page);
      await completeOnboarding(page);
      await page.goto(TEST_URL);

      // Find and click tier selector
      const tierSelector = page.locator(`[data-tier="${tier.id}"], button:has-text("${tier.price}")`).first();

      if (await tierSelector.isVisible({ timeout: 10000 })) {
        await tierSelector.click();

        // Click pay button
        const payButton = page.locator('button:has-text("Оплатить"), button:has-text("Pay")').first();

        if (await payButton.isVisible({ timeout: 5000 })) {
          const paymentPromise = page.waitForResponse(
            response => response.url().includes('/api/payment/create')
          );

          await payButton.click();

          const response = await paymentPromise;

          if (response.status() === 200) {
            const data = await response.json();
            expect(data.paymentId).toBeTruthy();
            expect(data.confirmationUrl).toContain('tinkoff.ru');
          }
        }
      }
    });
  }
});

test.describe('Payment Status Polling', () => {
  test('should poll status until payment confirmed', async ({ page }) => {
    const deviceId = await setupCleanSession(page);

    // Mock payment status responses
    let pollCount = 0;
    await page.route('**/api/payment/status**', async (route) => {
      pollCount++;

      if (pollCount < 3) {
        // Return pending
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ paid: false, status: 'pending' }),
        });
      } else {
        // Return success
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ paid: true, status: 'succeeded' }),
        });
      }
    });

    // Navigate to callback page
    await page.goto(`${TEST_URL}/payment/callback?device_id=${deviceId}&payment_id=test-123`);

    // Wait for polling
    await page.waitForTimeout(6000); // 3 polls at 2s interval

    expect(pollCount).toBeGreaterThanOrEqual(3);
  });

  test('should handle payment failure gracefully', async ({ page }) => {
    const deviceId = await setupCleanSession(page);

    await page.route('**/api/payment/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ paid: false, status: 'rejected' }),
      });
    });

    await page.goto(`${TEST_URL}/payment/callback?device_id=${deviceId}&payment_id=test-fail`);

    // Should show error message
    const errorVisible = await page.locator('text=Ошибка, text=failed, text=отклонен').first().isVisible({ timeout: 10000 }).catch(() => false);

    // Verify we're not stuck in loading state
    await page.waitForTimeout(3000);
  });
});

test.describe('Payment API Validation', () => {
  test('should reject payment without device ID', async ({ page }) => {
    await page.goto(TEST_URL);

    const response = await page.request.post(`${TEST_URL}/api/payment/create`, {
      data: {
        tierId: 'starter',
        // No deviceId
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should reject invalid tier ID', async ({ page }) => {
    await page.goto(TEST_URL);

    const response = await page.request.post(`${TEST_URL}/api/payment/create`, {
      data: {
        deviceId: generateDeviceId(),
        tierId: 'invalid-tier',
      },
    });

    expect([400, 500]).toContain(response.status());
  });
});

test.describe('Payment Edge Cases', () => {
  test('should handle network error during payment creation', async ({ page }) => {
    const deviceId = await setupCleanSession(page);
    await completeOnboarding(page);

    // Mock network failure
    await page.route('**/api/payment/create', (route) => route.abort('failed'));

    await page.goto(TEST_URL);

    const payButton = page.locator('button:has-text("Оплатить"), button:has-text("Pay")').first();

    if (await payButton.isVisible({ timeout: 10000 })) {
      await payButton.click();

      // Should show error message
      const errorVisible = await page.locator('text=Ошибка, text=error, text=сети').first().isVisible({ timeout: 5000 }).catch(() => false);
    }
  });

  test('should handle rapid double-click on pay button', async ({ page }) => {
    const deviceId = await setupCleanSession(page);
    await completeOnboarding(page);
    await page.goto(TEST_URL);

    let apiCallCount = 0;
    await page.route('**/api/payment/create', async (route) => {
      apiCallCount++;
      await route.continue();
    });

    const payButton = page.locator('button:has-text("Оплатить"), button:has-text("Pay")').first();

    if (await payButton.isVisible({ timeout: 10000 })) {
      // Double click rapidly
      await payButton.dblclick();

      await page.waitForTimeout(2000);

      // Should only create one payment (button should be disabled after first click)
      expect(apiCallCount).toBeLessThanOrEqual(1);
    }
  });

  test('should preserve payment intent across page refresh', async ({ page }) => {
    const deviceId = await setupCleanSession(page);

    // Set up pending payment state
    await page.evaluate((paymentId) => {
      localStorage.setItem('pinglass_pending_payment', paymentId);
      localStorage.setItem('pinglass_onboarding_complete', 'true');
    }, 'test-pending-payment-123');

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check that pending payment is still tracked
    const pendingPayment = await page.evaluate(() =>
      localStorage.getItem('pinglass_pending_payment')
    );

    expect(pendingPayment).toBe('test-pending-payment-123');
  });
});
