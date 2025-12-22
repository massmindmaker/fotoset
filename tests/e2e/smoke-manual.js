const { chromium } = require('playwright');

const TARGET_URL = 'https://www.pinglass.ru';

(async () => {
  console.log('Starting PinGlass Smoke Tests...\n');

  const browser = await chromium.launch({ headless: true, slowMo: 50 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'ru-RU'
  });
  const page = await context.newPage();

  const results = { passed: 0, failed: 0, tests: [] };

  async function runTest(name, testFn) {
    console.log(`Testing: ${name}`);
    try {
      await testFn();
      results.passed++;
      results.tests.push({ name, status: 'PASSED' });
      console.log(`  PASSED\n`);
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: 'FAILED', error: error.message });
      console.log(`  FAILED: ${error.message}\n`);
    }
  }

  // Test 1: Homepage loads
  await runTest('Homepage loads correctly', async () => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title();
    console.log(`  Page title: ${title}`);
    if (!title) throw new Error('Page title is empty');
  });

  // Test 2: Start button visible
  await runTest('Start button is visible', async () => {
    const startButton = page.locator('button:has-text("Начать")');
    await startButton.waitFor({ state: 'visible', timeout: 15000 });
    const isVisible = await startButton.isVisible();
    if (!isVisible) throw new Error('Button not visible');
  });

  // Test 3: Click Start
  await runTest('Click Start navigates correctly', async () => {
    const startButton = page.locator('button:has-text("Начать")');
    await startButton.click();
    await page.waitForTimeout(2000);
    const hasFileInput = await page.locator('input[type="file"]').count() > 0;
    console.log(`  File input present: ${hasFileInput}`);
  });

  // Test 4: Payment callback
  await runTest('Payment callback page loads', async () => {
    await page.goto(`${TARGET_URL}/payment/callback?device_id=test-123`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    await page.waitForTimeout(1500);
    const bodyText = await page.textContent('body');
    if (!bodyText || bodyText.length < 10) {
      throw new Error('Payment callback page appears blank');
    }
  });

  // Test 5: API user endpoint
  await runTest('API /api/user endpoint responds', async () => {
    const response = await page.request.post(`${TARGET_URL}/api/user`, {
      data: { deviceId: `smoke-test-${Date.now()}` }
    });
    console.log(`  Status: ${response.status()}`);
    if (response.status() !== 200) {
      throw new Error(`API returned status ${response.status()}`);
    }
  });

  // Test 6: API payment validation
  await runTest('API /api/payment/create rejects empty deviceId', async () => {
    const response = await page.request.post(`${TARGET_URL}/api/payment/create`, {
      data: { deviceId: '' }
    });
    console.log(`  Status: ${response.status()}`);
    if (response.status() < 400) {
      throw new Error(`Expected 4xx error, got ${response.status()}`);
    }
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SMOKE TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total:  ${results.tests.length}`);
  console.log('');

  for (const test of results.tests) {
    console.log(`[${test.status}] ${test.name}`);
    if (test.error) console.log(`  Error: ${test.error}`);
  }

  await browser.close();

  if (results.failed > 0) {
    process.exit(1);
  }
})();
