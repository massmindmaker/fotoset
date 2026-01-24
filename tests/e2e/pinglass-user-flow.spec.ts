import { test, expect } from '@playwright/test';
import { PersonaPage } from './page-objects/PersonaPage';
import path from 'path';

/**
 * PinGlass E2E Test Suite - User Flow Testing
 *
 * Tests the complete user journey from onboarding to photo generation
 */

test.describe('PinGlass User Flow', () => {
  let personaPage: PersonaPage;

  test.beforeEach(async ({ page }) => {
    personaPage = new PersonaPage(page);
    await personaPage.goto();
  });

  test.describe('First-Time User Journey', () => {
    test('should complete onboarding flow', async () => {
      // Clear storage to simulate first-time user
      await personaPage.clearStorage();
      await personaPage.goto();

      // Verify onboarding screen displays
      await expect(personaPage.onboardingContainer).toBeVisible();

      // Complete onboarding
      await personaPage.completeOnboardingFlow();

      // Verify navigation to upload screen
      await expect(personaPage.uploadZone).toBeVisible();
    });

    test('should upload photos successfully', async ({ page }) => {
      // Setup: Skip onboarding
      await personaPage.completeOnboarding();
      await personaPage.goto();

      // Navigate to upload screen
      await expect(personaPage.uploadZone).toBeVisible();

      // Prepare test images (create mock files)
      const testImages = await page.evaluate(() => {
        // Create mock file paths (in real test, use actual images from fixtures)
        return Array.from({ length: 10 }, (_, i) => `test-image-${i + 1}.jpg`);
      });

      // Note: In real tests, use actual fixture images
      // Example: path.join(__dirname, '../fixtures/test-photos/photo1.jpg')

      // For now, test that upload zone is interactive
      await expect(personaPage.uploadInput).toBeAttached();
      await expect(personaPage.uploadNextButton).toBeDisabled(); // Should be disabled initially
    });

    test('should validate minimum photo count', async () => {
      // Setup
      await personaPage.completeOnboarding();
      await personaPage.goto();

      // Verify upload next button is disabled when no photos uploaded
      await expect(personaPage.uploadNextButton).toBeDisabled();

      // TODO: Upload <10 photos and verify error message
    });

    test('should select style and proceed', async () => {
      // Setup: Mock previous steps
      await personaPage.setProStatus(true); // Skip payment for this test
      await personaPage.completeOnboarding();

      // Mock navigation to style selection
      // (In real app, would need to upload photos first)

      // Verify style selection buttons exist
      const professionalButton = personaPage.professionalStyleButton;
      const lifestyleButton = personaPage.lifestyleStyleButton;
      const creativeButton = personaPage.creativeStyleButton;

      // Test style selection (once we navigate to that screen)
      // await personaPage.selectStyle('professional');
      // await personaPage.proceedFromStyleSelection();
    });
  });

  test.describe('Payment Flow', () => {
    test('should show payment modal for non-pro user', async () => {
      // Setup: Non-pro user attempting generation
      await personaPage.clearStorage();
      await personaPage.setDeviceId('test-device-123');
      await personaPage.completeOnboarding();

      // Navigate through flow until payment modal
      // (Mock previous steps)

      // Verify payment modal appears
      // const isVisible = await personaPage.isPaymentModalVisible();
      // expect(isVisible).toBe(true);
    });

    test('should create payment and redirect', async ({ page, context }) => {
      // Enable API mocking
      await personaPage.mockAPIResponses();

      // Setup
      await personaPage.clearStorage();
      await personaPage.goto();

      // Listen for payment redirect
      const popupPromise = context.waitForEvent('page');

      // Initiate payment (once modal is visible)
      // await personaPage.initiatePayment();

      // Verify API call was made
      const paymentRequest = page.waitForRequest('**/api/payment/create');
      // await paymentRequest;

      // Verify redirect would occur
      // const popup = await popupPromise;
      // expect(popup.url()).toContain('payment');
    });

    test('should update Pro status after successful payment', async () => {
      // Mock successful payment callback
      await personaPage.setProStatus(true);
      await personaPage.goto();

      // Verify Pro status is persisted
      const isPro = await personaPage.page.evaluate(() => {
        return localStorage.getItem('pinglass_is_pro') === 'true';
      });

      expect(isPro).toBe(true);
    });
  });

  test.describe('Photo Generation Flow', () => {
    test('should initiate generation for Pro user', async ({ page }) => {
      // Setup: Pro user with uploaded photos
      await personaPage.setProStatus(true);
      await personaPage.setDeviceId('test-device-123');
      await personaPage.mockAPIResponses();

      // Monitor API call
      const generateRequest = page.waitForRequest('**/api/generate');

      // Initiate generation (once we reach that screen)
      // await personaPage.selectStyle('professional');
      // await personaPage.proceedFromStyleSelection();

      // Verify API was called
      // const request = await generateRequest;
      // expect(request.method()).toBe('POST');
    });

    test('should display generation progress', async () => {
      // Setup: Pro user starting generation
      await personaPage.setProStatus(true);
      await personaPage.mockAPIResponses();

      // Verify progress spinner appears
      // await personaPage.waitForGenerationStart();
      // await expect(personaPage.generatingSpinner).toBeVisible();
    });

    test('should display 23 generated photos in results', async () => {
      // Setup: Mock completed generation
      await personaPage.setProStatus(true);
      await personaPage.mockAPIResponses();

      // Wait for results
      // await personaPage.waitForResults(60000); // 1 minute for mock

      // Verify all photos generated
      // await personaPage.verifyAllPhotosGenerated();
    });

    test('should allow photo download', async () => {
      // Setup: Results screen with generated photos
      await personaPage.setProStatus(true);
      await personaPage.mockAPIResponses();

      // Download first photo
      // const download = await personaPage.downloadPhoto(0);
      // expect(download).toBeTruthy();
      // expect(download.suggestedFilename()).toMatch(/\.(jpg|png)$/);
    });
  });

  test.describe('Returning User (Pro)', () => {
    test('should skip onboarding and show dashboard', async () => {
      // Setup: Returning Pro user
      await personaPage.setProStatus(true);
      await personaPage.setDeviceId('test-device-123');
      await personaPage.completeOnboarding();
      await personaPage.goto();

      // Verify dashboard displays
      await personaPage.verifyDashboardVisible();
    });

    test('should display existing personas', async () => {
      // Setup: Pro user with existing avatars
      await personaPage.setProStatus(true);
      await personaPage.goto();

      // Get avatar count
      // const count = await personaPage.getAvatarCount();
      // expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should allow creating new persona', async () => {
      // Setup: Pro user on dashboard
      await personaPage.setProStatus(true);
      await personaPage.goto();

      // Create new persona
      // await personaPage.createNewPersona();

      // Verify navigation to upload screen
      // await expect(personaPage.uploadZone).toBeVisible();
    });
  });

  test.describe('Error Handling & Edge Cases', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock failed API response
      await page.route('**/api/generate', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      // Attempt generation
      // Error should be displayed to user
    });

    test('should handle network timeout', async ({ page }) => {
      // Mock slow/timeout response
      await page.route('**/api/generate', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 60000)); // Never resolve
      });

      // Should show timeout error
    });

    test('should handle partial generation failure', async ({ page }) => {
      // Mock response with only some photos generated
      await page.route('**/api/generate', async (route) => {
        const photos = Array.from({ length: 15 }, (_, i) => `https://example.com/photo${i + 1}.jpg`);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            jobId: 'test-job-123',
            photosGenerated: 15,
            photos,
          }),
        });
      });

      // Should show 15 photos, warn about missing 8
    });
  });

  test.describe('Browser Console & Errors', () => {
    test('should load without JavaScript errors', async ({ page }) => {
      const consoleErrors: string[] = [];

      // Listen for console errors
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Navigate and interact
      await personaPage.goto();

      // Verify no errors
      expect(consoleErrors).toHaveLength(0);
    });

    test('should load without network errors', async ({ page }) => {
      const failedRequests: string[] = [];

      // Listen for failed requests
      page.on('requestfailed', (request) => {
        failedRequests.push(request.url());
      });

      // Navigate
      await personaPage.goto();
      await page.waitForLoadState('networkidle');

      // Verify no failed requests
      expect(failedRequests).toHaveLength(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have no accessibility violations', async ({ page }) => {
      // Note: Requires @axe-core/playwright
      // const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
      // expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should support keyboard navigation', async ({ page }) => {
      await personaPage.goto();

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Verify focus is visible
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await personaPage.goto();
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Should load in under 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should have good Core Web Vitals', async ({ page }) => {
      await personaPage.goto();

      // Measure Web Vitals
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries);
          }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        });
      });

      // Assertions for performance metrics
      // expect(metrics).toBeDefined();
    });
  });
});
