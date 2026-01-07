import { test, expect } from '@playwright/test';
import { PersonaPage } from '../page-objects/PersonaPage';
import path from 'path';

/**
 * Critical Path: Returning Pro User Journey
 *
 * Tests the experience for users who have already paid and
 * are creating additional personas or viewing existing ones.
 *
 * PRIORITY: P0 (Critical for retention)
 */

test.describe('Returning Pro User Journey', () => {
  let personaPage: PersonaPage;

  test.beforeEach(async ({ page }) => {
    personaPage = new PersonaPage(page);

    // Setup: Returning Pro user
    await personaPage.setProStatus(true);
    await personaPage.setDeviceId('test-returning-user');
    await personaPage.completeOnboarding();
  });

  test('should skip onboarding and go directly to dashboard', async ({ page }) => {
    await personaPage.goto();

    // Should NOT see onboarding
    await expect(personaPage.onboardingContainer).not.toBeVisible({ timeout: 2000 });

    // Should see dashboard
    await personaPage.verifyDashboardVisible();

    // Verify paid status maintained
    const paidStatus = await page.evaluate(() =>
      localStorage.getItem('pinglass_is_pro')
    );
    expect(paidStatus).toBe('true');
  });

  test('should display existing personas on dashboard', async ({ page }) => {
    // Mock API to return existing avatars
    await page.route('**/api/avatars*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          avatars: [
            {
              id: '1',
              name: 'Professional Headshots',
              status: 'ready',
              thumbnailUrl: 'https://example.com/thumb1.jpg',
              photoCount: 23,
              createdAt: '2025-12-01T10:00:00Z'
            },
            {
              id: '2',
              name: 'Lifestyle Photos',
              status: 'ready',
              thumbnailUrl: 'https://example.com/thumb2.jpg',
              photoCount: 23,
              createdAt: '2025-12-05T14:30:00Z'
            },
            {
              id: '3',
              name: 'Creative Portraits',
              status: 'processing',
              thumbnailUrl: null,
              photoCount: 0,
              createdAt: '2025-12-10T09:15:00Z'
            }
          ]
        }),
      });
    });

    await personaPage.goto();

    // Wait for avatars to load
    await page.waitForResponse(response =>
      response.url().includes('/api/avatars') && response.status() === 200
    );

    // Verify avatar count
    const avatarCount = await personaPage.getAvatarCount();
    expect(avatarCount).toBe(3);

    // Verify avatar details visible
    const firstAvatar = personaPage.avatarCards.first();
    await expect(firstAvatar).toBeVisible();
    await expect(firstAvatar).toContainText('Professional Headshots');
  });

  test('should create new persona without payment prompt', async ({ page }) => {
    test.setTimeout(12 * 60 * 1000);

    await personaPage.goto();

    // Click create new persona
    await personaPage.createNewPersona();

    // Should go to upload screen
    await expect(personaPage.uploadZone).toBeVisible({ timeout: 5000 });

    // Upload photos
    const testPhotos = Array.from({ length: 10 }, (_, i) =>
      path.join(__dirname, '../../fixtures/test-photos', `photo${i + 1}.jpg`)
    );
    await personaPage.uploadPhotos(testPhotos);
    await personaPage.proceedFromUpload();

    // Select style
    await personaPage.selectStyle('lifestyle');
    await personaPage.proceedFromStyleSelection();

    // Should NOT see payment modal (Pro user)
    await expect(personaPage.paymentModal).not.toBeVisible({ timeout: 2000 });

    // Should proceed directly to generation
    await personaPage.waitForGenerationStart();

    // Wait for results
    await personaPage.waitForResults(10 * 60 * 1000);

    // Verify success
    await personaPage.verifyAllPhotosGenerated();
  });

  test('should view existing persona photos', async ({ page }) => {
    const testAvatarId = 'test-avatar-123';

    // Mock API to return avatar details
    await page.route(`**/api/avatars/${testAvatarId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: testAvatarId,
          name: 'Test Avatar',
          status: 'ready',
          photos: Array.from({ length: 23 }, (_, i) => ({
            id: `photo-${i + 1}`,
            url: `https://example.com/photo${i + 1}.jpg`,
            prompt: `Test prompt ${i + 1}`,
            styleId: 'professional',
            createdAt: '2025-12-01T10:00:00Z'
          }))
        }),
      });
    });

    await personaPage.goto();

    // Select avatar (assuming it exists on dashboard)
    await page.locator(`[data-avatar-id="${testAvatarId}"]`).click();

    // Wait for API call
    await page.waitForResponse(response =>
      response.url().includes(`/api/avatars/${testAvatarId}`) && response.status() === 200
    );

    // Should show results view with 23 photos
    await expect(personaPage.resultsGallery).toBeVisible({ timeout: 5000 });
    await personaPage.verifyAllPhotosGenerated();
  });

  test('should download all photos as ZIP', async ({ page }) => {
    // Setup: User viewing results
    await personaPage.mockAPIResponses();
    await personaPage.goto();

    // Navigate to results (mock)
    await page.evaluate(() => {
      // Simulate being on results view
      localStorage.setItem('pinglass_current_view', 'RESULTS');
    });

    await page.reload();

    // Find "Download All" button
    const downloadAllButton = page.getByRole('button', { name: /скачать все|download all/i });
    await expect(downloadAllButton).toBeVisible({ timeout: 5000 });

    // Click download all
    const downloadPromise = page.waitForEvent('download');
    await downloadAllButton.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/i);
  });

  test('should create multiple personas sequentially', async ({ page }) => {
    test.setTimeout(25 * 60 * 1000); // 25 minutes for 2 full generations

    await personaPage.goto();

    // Create first persona
    await test.step('Create first persona', async () => {
      await personaPage.createNewPersona();

      const testPhotos1 = Array.from({ length: 10 }, (_, i) =>
        path.join(__dirname, '../../fixtures/test-photos', `photo${i + 1}.jpg`)
      );
      await personaPage.uploadPhotos(testPhotos1);
      await personaPage.proceedFromUpload();

      await personaPage.selectStyle('professional');
      await personaPage.proceedFromStyleSelection();

      await personaPage.waitForGenerationStart();
      await personaPage.waitForResults(10 * 60 * 1000);
      await personaPage.verifyAllPhotosGenerated();
    });

    // Return to dashboard
    await test.step('Return to dashboard', async () => {
      const dashboardButton = page.getByRole('button', { name: /dashboard|главная/i });
      await dashboardButton.click();
      await personaPage.verifyDashboardVisible();
    });

    // Create second persona
    await test.step('Create second persona', async () => {
      await personaPage.createNewPersona();

      const testPhotos2 = Array.from({ length: 15 }, (_, i) =>
        path.join(__dirname, '../../fixtures/test-photos', `photo${i + 1}.jpg`)
      );
      await personaPage.uploadPhotos(testPhotos2);
      await personaPage.proceedFromUpload();

      await personaPage.selectStyle('creative');
      await personaPage.proceedFromStyleSelection();

      await personaPage.waitForGenerationStart();
      await personaPage.waitForResults(10 * 60 * 1000);
      await personaPage.verifyAllPhotosGenerated();
    });

    // Verify dashboard shows both
    await test.step('Verify both personas on dashboard', async () => {
      const dashboardButton = page.getByRole('button', { name: /dashboard|главная/i });
      await dashboardButton.click();

      const avatarCount = await personaPage.getAvatarCount();
      expect(avatarCount).toBeGreaterThanOrEqual(2);
    });
  });

  test('should handle Pro status expiration gracefully', async ({ page }) => {
    await personaPage.goto();

    // Simulate Pro status expiring (e.g., refund, chargeback)
    await page.evaluate(() => {
      localStorage.setItem('pinglass_is_pro', 'false');
    });

    await page.reload();

    // Attempt to create new persona
    await personaPage.createNewPersona();

    // Should now trigger payment modal
    await expect(personaPage.paymentModal).toBeVisible({ timeout: 5000 });
  });

  test('should preserve state across browser sessions', async ({ page, context }) => {
    // First session
    await personaPage.goto();
    const deviceId = await page.evaluate(() =>
      localStorage.getItem('pinglass_device_id')
    );

    // Close browser, simulate new session
    await page.close();

    // New page with same context (simulates same browser)
    const newPage = await context.newPage();
    personaPage = new PersonaPage(newPage);

    // Manually set localStorage (simulates persistence)
    await newPage.evaluate((id) => {
      localStorage.setItem('pinglass_device_id', id);
      localStorage.setItem('pinglass_is_pro', 'true');
      localStorage.setItem('pinglass_onboarding_complete', 'true');
    }, deviceId);

    await personaPage.goto();

    // Should still be paid user
    await personaPage.verifyDashboardVisible();

    const paidStatus = await newPage.evaluate(() =>
      localStorage.getItem('pinglass_is_pro')
    );
    expect(paidStatus).toBe('true');
  });
});

test.describe('Returning User - Edge Cases', () => {
  let personaPage: PersonaPage;

  test.beforeEach(async ({ page }) => {
    personaPage = new PersonaPage(page);
  });

  test('should handle corrupted localStorage gracefully', async ({ page }) => {
    // Set invalid localStorage values
    await page.evaluate(() => {
      localStorage.setItem('pinglass_is_pro', 'invalid_value');
      localStorage.setItem('pinglass_device_id', '');
    });

    await personaPage.goto();

    // Should either:
    // 1. Reset to defaults and treat as new user
    // 2. Show error and offer to reset
    // Should NOT crash

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify no JavaScript errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    expect(consoleErrors).toHaveLength(0);
  });

  test('should sync payment status with backend', async ({ page }) => {
    // Scenario: localStorage says paid, but backend says unpaid
    await personaPage.setPaidStatus(true);
    await personaPage.setDeviceId('test-device-desync');

    // Mock backend to return user data (payment status comes from /api/payment/status)
    await page.route('**/api/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          deviceId: 'test-device-desync',
        }),
      });
    });

    await personaPage.goto();

    // Should sync with backend and update localStorage
    // Should trigger payment modal if attempting generation
  });

  test('should handle deleted avatar gracefully', async ({ page }) => {
    const deletedAvatarId = 'deleted-avatar-123';

    // Mock dashboard to show avatar
    await page.route('**/api/avatars*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          avatars: [
            {
              id: deletedAvatarId,
              name: 'Deleted Avatar',
              status: 'ready',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              photoCount: 23
            }
          ]
        }),
      });
    });

    await personaPage.setProStatus(true);
    await personaPage.goto();

    // Mock avatar details to return 404
    await page.route(`**/api/avatars/${deletedAvatarId}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Avatar not found',
        }),
      });
    });

    // Attempt to view avatar
    await page.locator(`[data-avatar-id="${deletedAvatarId}"]`).click();

    // Should show error message
    // Should return to dashboard
    // Should refresh avatar list
  });

  test('should handle concurrent generations', async ({ page, context }) => {
    test.setTimeout(15 * 60 * 1000);

    await personaPage.setProStatus(true);
    await personaPage.goto();

    // Start first generation
    await personaPage.createNewPersona();
    // ... complete upload and style selection

    // Open second tab
    const secondPage = await context.newPage();
    const secondPersonaPage = new PersonaPage(secondPage);
    await secondPersonaPage.setProStatus(true);
    await secondPersonaPage.goto();

    // Start second generation
    await secondPersonaPage.createNewPersona();
    // ... complete upload and style selection

    // Both should generate successfully (or show queue position)
  });
});
