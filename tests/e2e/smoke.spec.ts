/**
 * Smoke Tests - Basic functionality verification
 * Only tests that reliably pass in CI
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Check page has loaded with content
    await expect(page.locator('body')).toBeVisible({ timeout: 20000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/homepage.png' });
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
});
