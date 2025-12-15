/**
 * E2E Tests for Complete Payment Flow
 *
 * Tests the entire payment journey from tier selection to photo generation
 *
 * PRIORITY: P0 (Critical user path)
 * RUNTIME: ~5-10 minutes per test
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
test.describe.configure({ mode: 'serial' }); // Run tests in order

// Helper: Setup new user session
async function setupNewUser(page: Page) {
  // Clear localStorage to simulate new user
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());

  // Generate unique device ID
  const deviceId = `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  await page.evaluate((id) => {
    localStorage.setItem('pinglass_device_id', id);
  }, deviceId);

  return deviceId;
}

// Helper: Wait for payment redirect
async function waitForPaymentRedirect(page: Page) {
  await page.waitForURL(/securepay\.tinkoff\.ru|payment\/callback/, {
    timeout: 30000,
  });
}

// Helper: Complete T-Bank test payment
async function completeTBankTestPayment(page: Page) {
  // Check if we're on T-Bank payment page
  const isTBankPage = page.url().includes('securepay.tinkoff.ru');

  if (isTBankPage) {
    // Fill test card details
    await page.fill('[name="card"]', '4300000000000777'); // Test success card
    await page.fill('[name="expiry"]', '12/24');
    await page.fill('[name="cvv"]', '123');

    // Submit payment
    await page.click('button[type="submit"]');

    // Wait for redirect back to app
    await page.waitForURL(/payment\/callback/, { timeout: 60000 });
  }
}

test.describe('Payment Flow - Starter Tier (499 RUB, 7 photos)', () => {
  let deviceId: string;

  test.beforeEach(async ({ page }) => {
    deviceId = await setupNewUser(page);
  });

  test('should complete full payment flow for starter tier', async ({ page }) => {
    // Step 1: Navigate to app
    await page.goto('/');

    // Step 2: Complete onboarding (if shown)
    const onboardingVisible = await page.isVisible('button:has-text("Next")');
    if (onboardingVisible) {
      // Click through onboarding steps
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Get Started")');
    }

    // Step 3: Click "Create New Persona"
    await page.click('button:has-text("Create")');

    // Step 4: Upload photos
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      'tests/fixtures/test-photos/person1.jpg',
      'tests/fixtures/test-photos/person2.jpg',
      'tests/fixtures/test-photos/person3.jpg',
      'tests/fixtures/test-photos/person4.jpg',
      'tests/fixtures/test-photos/person5.jpg',
    ]);

    // Wait for uploads to process
    await page.waitForSelector('button:has-text("Continue")', { timeout: 10000 });
    await page.click('button:has-text("Continue")');

    // Step 5: Select style (e.g., Professional)
    await page.click('[data-style="professional"]');
    await page.click('button:has-text("Continue")');

    // Step 6: Payment modal appears - select Starter tier
    await expect(page.locator('text=Choose Your Plan')).toBeVisible();
    await page.click('[data-tier="starter"]');
    await page.click('button:has-text("Pay 499 ₽")');

    // Step 7: API creates payment
    const createPaymentRequest = page.waitForResponse(
      (response) =>
        response.url().includes('/api/payment/create') && response.status() === 200
    );

    await page.click('button:has-text("Proceed to Payment")');

    const createResponse = await createPaymentRequest;
    const paymentData = await createResponse.json();

    expect(paymentData.paymentId).toBeTruthy();
    expect(paymentData.confirmationUrl).toContain('tinkoff.ru');
    expect(paymentData.testMode).toBe(true);

    // Step 8: Redirect to T-Bank
    await waitForPaymentRedirect(page);

    // Step 9: Complete payment on T-Bank (if test mode)
    if (paymentData.testMode && page.url().includes('tinkoff.ru')) {
      await completeTBankTestPayment(page);
    }

    // Step 10: Return to callback page, poll for status
    await page.waitForURL(/payment\/callback/, { timeout: 60000 });

    // Status polling should happen automatically
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/payment/status') && response.status() === 200,
      { timeout: 30000 }
    );

    // Step 11: Webhook confirms payment
    // (In real flow, T-Bank sends webhook to /api/payment/webhook)

    // Step 12: Redirect to generation
    await page.waitForSelector('text=Generating', { timeout: 10000 });

    // Step 13: Generation completes
    await page.waitForSelector('text=7', { timeout: 300000 }); // 5 min timeout

    // Step 14: Results page shows 7 photos
    const photoCount = await page.locator('[data-testid="generated-photo"]').count();
    expect(photoCount).toBe(7);

    // Step 15: Can download photos
    const downloadButton = page.locator('button:has-text("Download")').first();
    await expect(downloadButton).toBeVisible();
  });

  test('should handle payment cancellation gracefully', async ({ page }) => {
    await page.goto('/');

    // Navigate to payment modal
    await page.click('button:has-text("Create")');
    // ... (upload and style selection steps)

    await page.click('[data-tier="starter"]');
    await page.click('button:has-text("Proceed to Payment")');

    // Wait for T-Bank redirect
    await waitForPaymentRedirect(page);

    // User closes payment page (simulated by going back)
    await page.goBack();

    // Should return to app with payment modal still available
    await expect(page.locator('text=Choose Your Plan')).toBeVisible();

    // Can try payment again
    await page.click('button:has-text("Proceed to Payment")');
    await waitForPaymentRedirect(page);
  });

  test('should show error for failed payment', async ({ page }) => {
    await page.goto('/');

    // Mock failed payment response
    await page.route('**/api/payment/create', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Payment failed' }),
      })
    );

    // Try to create payment
    await page.click('button:has-text("Create")');
    // ... (upload and style selection)

    await page.click('[data-tier="starter"]');
    await page.click('button:has-text("Proceed to Payment")');

    // Should show error message
    await expect(page.locator('text=Payment failed')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Payment Flow - Standard Tier (999 RUB, 15 photos)', () => {
  test('should process standard tier payment correctly', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    await page.goto('/');

    // Navigate to payment (abbreviated)
    // ... (onboarding, create, upload, style selection)

    // Select Standard tier
    await page.click('[data-tier="standard"]');
    await page.click('button:has-text("Pay 999 ₽")');

    const createResponse = await page.waitForResponse('/api/payment/create');
    const paymentData = await createResponse.json();

    expect(paymentData.paymentId).toBeTruthy();

    // Complete payment flow
    await waitForPaymentRedirect(page);
    if (paymentData.testMode) {
      await completeTBankTestPayment(page);
    }

    // Wait for generation to complete
    await page.waitForSelector('text=15', { timeout: 300000 });

    const photoCount = await page.locator('[data-testid="generated-photo"]').count();
    expect(photoCount).toBe(15);
  });
});

test.describe('Payment Flow - Premium Tier (1499 RUB, 23 photos)', () => {
  test('should process premium tier payment correctly', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    await page.goto('/');

    // Select Premium tier (default)
    await page.click('[data-tier="premium"]');
    await page.click('button:has-text("Pay 1499 ₽")');

    const createResponse = await page.waitForResponse('/api/payment/create');
    const paymentData = await createResponse.json();

    expect(paymentData.paymentId).toBeTruthy();

    await waitForPaymentRedirect(page);
    if (paymentData.testMode) {
      await completeTBankTestPayment(page);
    }

    // Premium generates 23 photos
    await page.waitForSelector('text=23', { timeout: 600000 }); // 10 min timeout

    const photoCount = await page.locator('[data-testid="generated-photo"]').count();
    expect(photoCount).toBe(23);
  });
});

test.describe('Payment Status Polling', () => {
  test('should poll payment status until success', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    // Mock pending status first, then success
    let pollCount = 0;
    await page.route('**/api/payment/status**', (route) => {
      pollCount++;
      if (pollCount < 3) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ paid: false, status: 'pending' }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ paid: true, status: 'succeeded' }),
        });
      }
    });

    await page.goto('/payment/callback?device_id=' + deviceId);

    // Should poll multiple times
    await page.waitForTimeout(6000); // Wait for 3 polls (2s interval)

    expect(pollCount).toBeGreaterThanOrEqual(3);

    // Should redirect to generation after success
    await expect(page).toHaveURL(/\/(generating|results)/, { timeout: 5000 });
  });

  test('should handle permanent payment failure', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    // Mock failed payment status
    await page.route('**/api/payment/status**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ paid: false, status: 'rejected' }),
      })
    );

    await page.goto('/payment/callback?device_id=' + deviceId);

    // Should show error after timeout
    await expect(page.locator('text=Payment failed')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Referral Code Application', () => {
  test('should apply referral code during payment', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    await page.goto('/');

    // Navigate to payment modal
    // ... (onboarding, create, upload, style)

    // Enter referral code
    await page.fill('[name="referralCode"]', 'FRIEND123');
    await page.click('[data-tier="starter"]');
    await page.click('button:has-text("Proceed to Payment")');

    const createRequest = page.waitForRequest('/api/payment/create');
    const request = await createRequest;
    const requestBody = request.postDataJSON();

    expect(requestBody.referralCode).toBe('FRIEND123');
  });

  test('should ignore invalid referral code', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    await page.goto('/');

    // Enter invalid code (should not block payment)
    await page.fill('[name="referralCode"]', 'INVALID123');
    await page.click('[data-tier="starter"]');
    await page.click('button:has-text("Proceed to Payment")');

    // Payment should still proceed
    const createResponse = await page.waitForResponse('/api/payment/create');
    expect(createResponse.status()).toBe(200);
  });
});

test.describe('Payment Security', () => {
  test('should not allow duplicate payments', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    // Mock user already has pending payment
    await page.route('**/api/payment/create', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Payment already in progress' }),
      })
    );

    await page.goto('/');

    // Try to create payment
    await page.click('button:has-text("Proceed to Payment")');

    // Should show error
    await expect(page.locator('text=already in progress')).toBeVisible();
  });

  test('should require valid device ID', async ({ page }) => {
    // Don't set device ID
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.goto('/payment/callback'); // Direct access

    // Should redirect to home or show error
    await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
  });
});

test.describe('Edge Cases', () => {
  test('should handle network errors during payment creation', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    // Simulate network error
    await page.route('**/api/payment/create', (route) => route.abort('failed'));

    await page.goto('/');

    await page.click('button:has-text("Proceed to Payment")');

    // Should show network error
    await expect(page.locator('text=Network error')).toBeVisible({ timeout: 5000 });
  });

  test('should handle T-Bank timeout', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    // Mock slow T-Bank response
    await page.route('**/api/payment/create', async (route) => {
      await page.waitForTimeout(31000); // Exceed timeout
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Request timeout' }),
      });
    });

    await page.goto('/');

    await page.click('button:has-text("Proceed to Payment")');

    await expect(page.locator('text=timeout')).toBeVisible({ timeout: 35000 });
  });

  test('should handle browser back button during payment', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    await page.goto('/');

    // Start payment flow
    await page.click('button:has-text("Proceed to Payment")');
    await waitForPaymentRedirect(page);

    // Go back
    await page.goBack();

    // Should be able to retry
    await page.click('button:has-text("Proceed to Payment")');
    await waitForPaymentRedirect(page);
  });

  test('should handle page refresh during status polling', async ({ page }) => {
    const deviceId = await setupNewUser(page);

    await page.goto('/payment/callback?device_id=' + deviceId);

    // Wait for some polls
    await page.waitForTimeout(3000);

    // Refresh page
    await page.reload();

    // Should resume polling
    await page.waitForResponse('/api/payment/status', { timeout: 5000 });
  });
});
