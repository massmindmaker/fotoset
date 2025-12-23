import { defineConfig, devices } from '@playwright/test';

/**
 * PinGlass Playwright Configuration
 *
 * E2E testing configuration for https://www.pinglass.ru
 * Supports local development and production testing
 */

export default defineConfig({
  testDir: './tests/e2e',

  // Maximum time one test can run
  timeout: 60 * 1000, // 60 seconds

  // Maximum time entire test suite can run
  globalTimeout: 10 * 60 * 1000, // 10 minutes

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // Retry failed tests in CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-reports/playwright-html' }],
    ['json', { outputFile: 'test-reports/playwright-results.json' }],
    ['junit', { outputFile: 'test-reports/playwright-junit.xml' }],
    ['list'], // Console output
  ],

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL: process.env.TEST_URL || 'https://www.pinglass.ru',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Browser context options
    viewport: { width: 1280, height: 720 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',

    // Network settings
    actionTimeout: 15 * 1000, // 15 seconds for actions
    navigationTimeout: 30 * 1000, // 30 seconds for navigation
  },

  // Configure projects for major browsers
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Web server configuration (for local development)
  webServer: process.env.TEST_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
  },
});
