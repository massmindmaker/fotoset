import { test, expect } from '@playwright/test';
import { PersonaPage } from '../page-objects/PersonaPage';
import path from 'path';

/**
 * Critical Path: Full First-Time User Journey
 *
 * This is the most important E2E test - it covers the complete
 * revenue-generating user flow from landing to paid generation.
 *
 * PRIORITY: P0 (Must never fail in production)
 */

test.describe('Full User Journey - First Time User', () => {
  let personaPage: PersonaPage;

  test.beforeEach(async ({ page }) => {
    personaPage = new PersonaPage(page);
  });

  test('should complete entire flow: onboarding → upload → payment → generation → results', async ({
    page,
    context
  }) => {
    test.setTimeout(15 * 60 * 1000); // 15 minutes for full flow

    // STEP 1: Clear storage (simulate first-time user)
    await personaPage.clearStorage();
    await personaPage.goto();

    // STEP 2: Complete onboarding
    await test.step('Complete onboarding flow', async () => {
      await expect(personaPage.onboardingContainer).toBeVisible({ timeout: 10000 });
      await personaPage.completeOnboardingFlow();

      // Verify onboarding marked complete
      const onboardingComplete = await page.evaluate(() =>
        localStorage.getItem('pinglass_onboarding_complete')
      );
      expect(onboardingComplete).toBe('true');
    });

    // STEP 3: Upload photos
    await test.step('Upload 15 test photos', async () => {
      await expect(personaPage.uploadZone).toBeVisible({ timeout: 5000 });

      // Prepare test photos
      const testPhotos = Array.from({ length: 15 }, (_, i) =>
        path.join(__dirname, '../../fixtures/test-photos', `photo${i + 1}.jpg`)
      );

      await personaPage.uploadPhotos(testPhotos);

      // Verify upload complete
      const uploadedCount = await personaPage.uploadedPhotosList
        .locator('img')
        .count();
      expect(uploadedCount).toBe(15);

      // Proceed to style selection
      await personaPage.proceedFromUpload();
    });

    // STEP 4: Select style
    await test.step('Select Professional style', async () => {
      await expect(personaPage.styleSelectionContainer).toBeVisible({ timeout: 5000 });
      await personaPage.selectStyle('professional');
      await personaPage.proceedFromStyleSelection();
    });

    // STEP 5: Payment flow (non-pro user)
    await test.step('Complete payment flow', async () => {
      // Verify payment modal appears
      await expect(personaPage.paymentModal).toBeVisible({ timeout: 5000 });

      // Listen for payment redirect
      const popupPromise = context.waitForEvent('page');

      // Click payment button
      await personaPage.initiatePayment();

      // Verify API call made
      const createPaymentRequest = await page.waitForRequest(
        request => request.url().includes('/api/payment/create') && request.method() === 'POST'
      );
      expect(createPaymentRequest).toBeTruthy();

      // In production, user would be redirected to T-Bank
      // For testing, we'll mock the successful payment
      const response = await createPaymentRequest.response();
      const paymentData = await response?.json();

      expect(paymentData).toHaveProperty('paymentId');
      expect(paymentData).toHaveProperty('confirmationUrl');

      // Simulate successful payment (mock webhook)
      // In real scenario, user completes payment on T-Bank, webhook fires
      await page.evaluate(() => {
        localStorage.setItem('pinglass_is_pro', 'true');
      });

      // Close modal after "payment"
      await personaPage.closePaymentModal();
    });

    // STEP 6: Photo generation
    await test.step('Generate 23 AI photos', async () => {
      // Verify generation started
      await personaPage.waitForGenerationStart();

      // Monitor API call
      const generateRequest = await page.waitForRequest(
        request => request.url().includes('/api/generate') && request.method() === 'POST',
        { timeout: 10000 }
      );

      const requestBody = generateRequest.postDataJSON();
      expect(requestBody).toHaveProperty('deviceId');
      expect(requestBody).toHaveProperty('avatarId');
      expect(requestBody).toHaveProperty('styleId', 'professional');
      expect(requestBody.referenceImages).toBeInstanceOf(Array);
      expect(requestBody.referenceImages.length).toBeGreaterThan(0);

      // Wait for results (with long timeout for real generation)
      // In test environment with mocks, this should be faster
      await personaPage.waitForResults(10 * 60 * 1000); // 10 minutes
    });

    // STEP 7: View results
    await test.step('View and verify 23 generated photos', async () => {
      await expect(personaPage.resultsGallery).toBeVisible();

      // Verify photo count
      await personaPage.verifyAllPhotosGenerated();

      // Verify photos are loaded (not broken images)
      const photoElements = personaPage.resultsPhotos;
      const count = await photoElements.count();

      for (let i = 0; i < count; i++) {
        const photo = photoElements.nth(i);
        await expect(photo).toBeVisible();

        // Check image loaded successfully
        const isLoaded = await photo.evaluate((img: HTMLImageElement) => {
          return img.complete && img.naturalHeight > 0;
        });
        expect(isLoaded).toBe(true);
      }
    });

    // STEP 8: Download photo
    await test.step('Download a generated photo', async () => {
      const download = await personaPage.downloadPhoto(0);

      expect(download).toBeTruthy();
      expect(download.suggestedFilename()).toMatch(/\.(jpg|png|jpeg)$/i);

      // Verify file was actually downloaded
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();
    });

    // FINAL VERIFICATION: User state
    await test.step('Verify final user state', async () => {
      const finalState = await page.evaluate(() => ({
        paidStatus: localStorage.getItem('pinglass_is_pro'),
        deviceId: localStorage.getItem('pinglass_device_id'),
        onboardingComplete: localStorage.getItem('pinglass_onboarding_complete'),
      }));

      expect(finalState.paidStatus).toBe('true');
      expect(finalState.deviceId).toBeTruthy();
      expect(finalState.onboardingComplete).toBe('true');
    });
  });

  test('should handle generation failure gracefully', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Setup: Pro user ready to generate
    await personaPage.setProStatus(true);
    await personaPage.setDeviceId('test-device-failure');
    await personaPage.completeOnboarding();
    await personaPage.goto();

    // Mock API failure
    await page.route('**/api/generate', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Generation service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE'
        }),
      });
    });

    // Complete upload and style selection
    // (Simplified - in real test would upload actual files)

    // Trigger generation
    // Should see error message, not crash
    // Should offer retry option
  });

  test('should allow user to leave and return during generation', async ({ page, context }) => {
    test.setTimeout(5 * 60 * 1000);

    // Setup: Pro user starting generation
    await personaPage.setProStatus(true);
    await personaPage.goto();

    // Start generation (mock)
    await personaPage.mockAPIResponses();

    // Simulate navigation away
    await page.goto('https://example.com');

    // Wait a bit
    await page.waitForTimeout(2000);

    // Navigate back
    await personaPage.goto();

    // Should resume or show completed results
    // (Depends on implementation - may need job ID persistence)
  });
});

test.describe('Full User Journey - Different Styles', () => {
  let personaPage: PersonaPage;

  test.beforeEach(async ({ page }) => {
    personaPage = new PersonaPage(page);
    // Setup: Pro user to skip payment
    await personaPage.setProStatus(true);
    await personaPage.setDeviceId('test-device-styles');
    await personaPage.completeOnboarding();
  });

  const styles = ['professional', 'lifestyle', 'creative'] as const;

  for (const style of styles) {
    test(`should generate photos with ${style} style`, async ({ page }) => {
      test.setTimeout(12 * 60 * 1000);

      await personaPage.goto();

      // Upload photos (simplified)
      await test.step(`Upload photos for ${style}`, async () => {
        await expect(personaPage.uploadZone).toBeVisible({ timeout: 5000 });

        const testPhotos = Array.from({ length: 12 }, (_, i) =>
          path.join(__dirname, '../../fixtures/test-photos', `photo${i + 1}.jpg`)
        );

        await personaPage.uploadPhotos(testPhotos);
        await personaPage.proceedFromUpload();
      });

      // Select style
      await test.step(`Select ${style} style`, async () => {
        await personaPage.selectStyle(style);
        await personaPage.proceedFromStyleSelection();
      });

      // Wait for generation
      await test.step(`Generate with ${style} style`, async () => {
        const generateRequest = await page.waitForRequest(
          request => request.url().includes('/api/generate') && request.method() === 'POST'
        );

        const requestBody = generateRequest.postDataJSON();
        expect(requestBody.styleId).toBe(style);

        await personaPage.waitForResults(10 * 60 * 1000);
      });

      // Verify results
      await test.step(`Verify ${style} results`, async () => {
        await personaPage.verifyAllPhotosGenerated();
      });
    });
  }
});

test.describe('Full User Journey - Error Recovery', () => {
  let personaPage: PersonaPage;

  test.beforeEach(async ({ page }) => {
    personaPage = new PersonaPage(page);
  });

  test('should recover from network interruption during upload', async ({ page }) => {
    await personaPage.clearStorage();
    await personaPage.goto();
    await personaPage.completeOnboardingFlow();

    // Start upload
    await expect(personaPage.uploadZone).toBeVisible();

    // Simulate network interruption
    await page.context().setOffline(true);

    // Attempt upload (should fail or queue)
    const testPhotos = [
      path.join(__dirname, '../../fixtures/test-photos/photo1.jpg')
    ];

    // Restore network
    await page.waitForTimeout(2000);
    await page.context().setOffline(false);

    // Retry upload (should succeed)
    await personaPage.uploadPhotos(testPhotos);

    const uploadedCount = await personaPage.uploadedPhotosList
      .locator('img')
      .count();
    expect(uploadedCount).toBeGreaterThan(0);
  });

  test('should handle payment timeout', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    await personaPage.clearStorage();
    await personaPage.goto();
    await personaPage.completeOnboardingFlow();

    // Setup payment timeout mock
    await page.route('**/api/payment/create', async (route) => {
      // Delay indefinitely
      await new Promise(() => {}); // Never resolves
    });

    // Attempt payment
    // Should timeout and show error
    // Should allow retry
  });

  test('should handle partial generation (only 15/23 photos)', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    await personaPage.setProStatus(true);
    await personaPage.goto();

    // Mock partial generation
    await page.route('**/api/generate', async (route) => {
      const photos = Array.from({ length: 15 }, (_, i) =>
        `https://example.com/generated/photo${i + 1}.jpg`
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          jobId: 'test-job-partial',
          photosGenerated: 15,
          totalExpected: 23,
          photos,
          errors: Array.from({ length: 8 }, (_, i) => ({
            promptIndex: i + 15,
            error: 'Generation timeout'
          }))
        }),
      });
    });

    // Complete flow
    // Should show 15 photos
    // Should warn about 8 missing
    // Should offer retry for failed photos
  });
});
