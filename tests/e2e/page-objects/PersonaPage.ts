import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for PinGlass PersonaApp Component
 *
 * Encapsulates all user interactions and element selectors
 * for the main application flow.
 */
export class PersonaPage {
  readonly page: Page;

  // Onboarding elements
  readonly onboardingContainer: Locator;
  readonly onboardingStartButton: Locator;
  readonly carouselNextButton: Locator;
  readonly carouselPrevButton: Locator;

  // Upload elements
  readonly uploadZone: Locator;
  readonly uploadInput: Locator;
  readonly uploadedPhotosList: Locator;
  readonly uploadNextButton: Locator;
  readonly uploadProgressBar: Locator;

  // Style selection elements
  readonly styleSelectionContainer: Locator;
  readonly professionalStyleButton: Locator;
  readonly lifestyleStyleButton: Locator;
  readonly creativeStyleButton: Locator;
  readonly styleContinueButton: Locator;

  // Payment elements
  readonly paymentModal: Locator;
  readonly paymentOfferButton: Locator;
  readonly paymentCloseButton: Locator;

  // Generation elements
  readonly generatingSpinner: Locator;
  readonly generatingProgress: Locator;

  // Results elements
  readonly resultsGallery: Locator;
  readonly resultsPhotos: Locator;
  readonly downloadButton: Locator;
  readonly generateMoreButton: Locator;

  // Dashboard elements
  readonly dashboardContainer: Locator;
  readonly createPersonaButton: Locator;
  readonly avatarCards: Locator;

  constructor(page: Page) {
    this.page = page;

    // Onboarding selectors
    this.onboardingContainer = page.locator('[data-testid="onboarding-container"]');
    this.onboardingStartButton = page.getByRole('button', { name: /начать/i });
    this.carouselNextButton = page.locator('[data-testid="carousel-next"]');
    this.carouselPrevButton = page.locator('[data-testid="carousel-prev"]');

    // Upload selectors
    this.uploadZone = page.locator('[data-testid="upload-zone"]');
    this.uploadInput = page.locator('input[type="file"]');
    this.uploadedPhotosList = page.locator('[data-testid="uploaded-photos-list"]');
    this.uploadNextButton = page.getByRole('button', { name: /далее|next/i });
    this.uploadProgressBar = page.locator('[data-testid="upload-progress"]');

    // Style selection selectors
    this.styleSelectionContainer = page.locator('[data-testid="style-selection"]');
    this.professionalStyleButton = page.getByRole('button', { name: /профессиональный|professional/i });
    this.lifestyleStyleButton = page.getByRole('button', { name: /лайфстайл|lifestyle/i });
    this.creativeStyleButton = page.getByRole('button', { name: /креативный|creative/i });
    this.styleContinueButton = page.getByRole('button', { name: /продолжить|continue/i });

    // Payment selectors
    this.paymentModal = page.locator('[data-testid="payment-modal"]');
    this.paymentOfferButton = page.getByRole('button', { name: /500|оплатить|pay/i });
    this.paymentCloseButton = page.locator('[data-testid="payment-close"]');

    // Generation selectors
    this.generatingSpinner = page.locator('[data-testid="generating-spinner"]');
    this.generatingProgress = page.locator('[data-testid="generating-progress"]');

    // Results selectors
    this.resultsGallery = page.locator('[data-testid="results-gallery"]');
    this.resultsPhotos = page.locator('[data-testid="result-photo"]');
    this.downloadButton = page.getByRole('button', { name: /скачать|download/i });
    this.generateMoreButton = page.getByRole('button', { name: /создать ещё|generate more/i });

    // Dashboard selectors
    this.dashboardContainer = page.locator('[data-testid="dashboard"]');
    this.createPersonaButton = page.getByRole('button', { name: /создать|create/i });
    this.avatarCards = page.locator('[data-testid="avatar-card"]');
  }

  /**
   * Navigate to the application
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clear all localStorage to simulate first-time user
   */
  async clearStorage() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Set paid status in localStorage
   */
  async setPaidStatus(hasPaid: boolean) {
    await this.page.evaluate((paid) => {
      localStorage.setItem('pinglass_is_pro', String(paid));
    }, hasPaid);
  }

  /**
   * @deprecated Use setPaidStatus instead
   */
  async setProStatus(hasPaid: boolean) {
    return this.setPaidStatus(hasPaid);
  }

  /**
   * Set device ID in localStorage
   */
  async setDeviceId(deviceId: string) {
    await this.page.evaluate((id) => {
      localStorage.setItem('pinglass_device_id', id);
    }, deviceId);
  }

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding() {
    await this.page.evaluate(() => {
      localStorage.setItem('pinglass_onboarding_complete', 'true');
    });
  }

  /**
   * Get current view state from localStorage or page
   */
  async getCurrentView(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('pinglass_current_view');
    });
  }

  /**
   * Complete onboarding flow (3 steps)
   */
  async completeOnboardingFlow() {
    await expect(this.onboardingContainer).toBeVisible();

    // Navigate through carousel (if interactive)
    for (let i = 0; i < 3; i++) {
      const nextBtn = this.carouselNextButton;
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await this.page.waitForTimeout(500);
      }
    }

    // Click start button
    await this.onboardingStartButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Upload photos via file input
   * @param filePaths Array of absolute file paths to upload
   */
  async uploadPhotos(filePaths: string[]) {
    await expect(this.uploadZone).toBeVisible();

    // Use file input (drag-and-drop harder to test reliably)
    await this.uploadInput.setInputFiles(filePaths);

    // Wait for upload to process
    await this.page.waitForTimeout(1000);

    // Verify photos appear in list
    const uploadedPhotos = await this.uploadedPhotosList.locator('img').count();
    expect(uploadedPhotos).toBe(filePaths.length);
  }

  /**
   * Delete a specific uploaded photo by index
   */
  async deleteUploadedPhoto(index: number) {
    const deleteButtons = this.uploadedPhotosList.locator('[data-testid="delete-photo"]');
    await deleteButtons.nth(index).click();
  }

  /**
   * Click next button on upload screen
   */
  async proceedFromUpload() {
    await expect(this.uploadNextButton).toBeEnabled();
    await this.uploadNextButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Select a photo generation style
   */
  async selectStyle(style: 'professional' | 'lifestyle' | 'creative') {
    await expect(this.styleSelectionContainer).toBeVisible();

    const styleButton = {
      professional: this.professionalStyleButton,
      lifestyle: this.lifestyleStyleButton,
      creative: this.creativeStyleButton,
    }[style];

    await styleButton.click();
    await this.page.waitForTimeout(500); // Wait for selection animation
  }

  /**
   * Continue from style selection
   */
  async proceedFromStyleSelection() {
    await expect(this.styleContinueButton).toBeEnabled();
    await this.styleContinueButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if payment modal is visible
   */
  async isPaymentModalVisible(): Promise<boolean> {
    return await this.paymentModal.isVisible();
  }

  /**
   * Click payment button to initiate payment
   */
  async initiatePayment() {
    await expect(this.paymentModal).toBeVisible();
    await this.paymentOfferButton.click();
  }

  /**
   * Close payment modal
   */
  async closePaymentModal() {
    await this.paymentCloseButton.click();
  }

  /**
   * Wait for generation to start
   */
  async waitForGenerationStart() {
    await expect(this.generatingSpinner).toBeVisible({ timeout: 10000 });
  }

  /**
   * Wait for results to appear
   * @param timeout Maximum time to wait (default 10 minutes for full generation)
   */
  async waitForResults(timeout: number = 600000) {
    await expect(this.resultsGallery).toBeVisible({ timeout });
  }

  /**
   * Verify all 23 photos generated
   */
  async verifyAllPhotosGenerated() {
    await expect(this.resultsPhotos).toHaveCount(23);
  }

  /**
   * Download a specific photo by index
   */
  async downloadPhoto(index: number) {
    const downloadButtons = this.resultsGallery.locator(this.downloadButton);
    const downloadPromise = this.page.waitForEvent('download');
    await downloadButtons.nth(index).click();
    const download = await downloadPromise;
    return download;
  }

  /**
   * Verify dashboard is displayed (for returning users)
   */
  async verifyDashboardVisible() {
    await expect(this.dashboardContainer).toBeVisible();
  }

  /**
   * Create new persona from dashboard
   */
  async createNewPersona() {
    await expect(this.createPersonaButton).toBeVisible();
    await this.createPersonaButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get count of existing avatars/personas
   */
  async getAvatarCount(): Promise<number> {
    return await this.avatarCards.count();
  }

  /**
   * Select an existing avatar by index
   */
  async selectAvatar(index: number) {
    await this.avatarCards.nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Intercept and mock API calls for testing
   */
  async mockAPIResponses() {
    // Mock user API
    await this.page.route('**/api/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          deviceId: 'test-device-123',
        }),
      });
    });

    // Mock payment create API
    await this.page.route('**/api/payment/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId: 'test-payment-123',
          confirmationUrl: 'https://test-payment.example.com',
          testMode: true,
        }),
      });
    });

    // Mock payment status API
    await this.page.route('**/api/payment/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paid: true,
          status: 'succeeded',
        }),
      });
    });

    // Mock generate API
    await this.page.route('**/api/generate', async (route) => {
      const photos = Array.from({ length: 23 }, (_, i) => `https://example.com/photo${i + 1}.jpg`);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          jobId: 'test-job-123',
          photosGenerated: 23,
          photos,
        }),
      });
    });
  }
}
