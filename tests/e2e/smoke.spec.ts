/**
 * Smoke Tests - Basic functionality verification
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Check "Начать" button is present (main CTA)
    await expect(page.locator('button:has-text("Начать")')).toBeVisible({ timeout: 20000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/homepage.png' });
  });

  test('can start new persona flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Click start button
    await page.click('button:has-text("Начать")', { timeout: 15000 });

    // Should transition to upload interface - wait for file input
    await expect(page.locator('input[type="file"]')).toBeAttached({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/upload-page.png' });
  });

  test('payment callback page loads', async ({ page }) => {
    await page.goto('/payment/callback?device_id=test-123');

    // Should show some payment status UI
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/payment-callback.png' });

    // Page should not be blank
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(10);
  });

  test('API health check - user endpoint', async ({ request }) => {
    const response = await request.post('/api/user', {
      data: { deviceId: 'test-smoke-' + Date.now() }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.deviceId || data.device_id).toBeTruthy();
  });

  test('API health check - payment create validation', async ({ request }) => {
    // Should reject empty deviceId
    const response = await request.post('/api/payment/create', {
      data: { deviceId: '' }
    });

    expect(response.status()).toBe(400);
  });
});
