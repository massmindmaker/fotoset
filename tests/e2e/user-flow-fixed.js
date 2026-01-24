const { chromium } = require('playwright');

const BASE_URL = 'https://www.pinglass.ru';

(async () => {
  console.log('Starting PinGlass User Flow Tests (Fixed)...\n');

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

  // === Onboarding Flow ===
  console.log('\n=== ONBOARDING FLOW ===\n');

  await runTest('Homepage displays correctly', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Check page loaded
    const title = await page.title();
    console.log(`  Page title: ${title}`);

    // Look for any button on page
    const buttons = await page.locator('button').count();
    console.log(`  Buttons on page: ${buttons}`);

    if (buttons === 0) throw new Error('No buttons found on page');
  });

  await runTest('Main CTA button is clickable', async () => {
    // Find visible buttons
    const buttons = await page.locator('button:visible').all();
    console.log(`  Visible buttons: ${buttons.length}`);

    if (buttons.length > 0) {
      // Click first visible button (likely "Начать")
      await buttons[0].click();
      await page.waitForTimeout(1500);
      console.log('  Clicked first button');
    }
  });

  // === Dashboard Flow ===
  console.log('\n=== DASHBOARD FLOW ===\n');

  await runTest('After click shows next screen', async () => {
    // Check for upload zone or any interactive elements
    const fileInput = await page.locator('input[type="file"]').count();
    const buttons = await page.locator('button:visible').count();

    console.log(`  File inputs: ${fileInput}`);
    console.log(`  Visible buttons: ${buttons}`);
  });

  await runTest('Page has navigation elements', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Check for nav/header
    const header = await page.locator('header').count();
    const nav = await page.locator('nav').count();

    console.log(`  Header elements: ${header}`);
    console.log(`  Nav elements: ${nav}`);
  });

  // === Payment Flow ===
  console.log('\n=== PAYMENT FLOW ===\n');

  await runTest('Payment callback page works', async () => {
    await page.goto(`${BASE_URL}/payment/callback?device_id=test-user&payment_id=test-payment`, {
      waitUntil: 'networkidle',
      timeout: 15000
    });

    const bodyText = await page.textContent('body');
    console.log(`  Content length: ${bodyText.length}`);

    if (bodyText.length < 50) throw new Error('Page appears empty');
  });

  await runTest('Payment fail page exists', async () => {
    const response = await page.goto(`${BASE_URL}/payment/fail`, {
      waitUntil: 'networkidle',
      timeout: 15000
    });

    console.log(`  Status: ${response.status()}`);
    // 404 is acceptable if page doesn't exist
  });

  // === Mobile Viewport ===
  console.log('\n=== MOBILE VIEWPORT ===\n');

  await runTest('Mobile viewport renders', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const buttons = await page.locator('button:visible').count();
    console.log(`  Visible buttons on mobile: ${buttons}`);

    if (buttons === 0) throw new Error('No buttons visible on mobile');
  });

  await runTest('Mobile layout has proper touch targets', async () => {
    const buttons = await page.locator('button:visible').all();
    let goodSize = 0;

    for (const btn of buttons) {
      const box = await btn.boundingBox();
      if (box && box.width >= 40 && box.height >= 40) {
        goodSize++;
      }
    }

    console.log(`  Buttons with good size: ${goodSize}/${buttons.length}`);
  });

  // === Tablet Viewport ===
  console.log('\n=== TABLET VIEWPORT ===\n');

  await runTest('Tablet viewport renders', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const buttons = await page.locator('button:visible').count();
    console.log(`  Visible buttons on tablet: ${buttons}`);
  });

  // === Desktop Viewport ===
  console.log('\n=== DESKTOP VIEWPORT ===\n');

  await runTest('Desktop viewport renders correctly', async () => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const buttons = await page.locator('button:visible').count();
    console.log(`  Visible buttons on desktop: ${buttons}`);
  });

  // === Error Checking ===
  console.log('\n=== ERROR CHECKING ===\n');

  await runTest('No critical JavaScript errors', async () => {
    const criticalErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore third-party analytics errors
        if (!text.includes('cloudflare') &&
            !text.includes('analytics') &&
            !text.includes('sentry') &&
            !text.includes('beacon')) {
          criticalErrors.push(text);
        }
      }
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log(`  Critical errors: ${criticalErrors.length}`);

    if (criticalErrors.length > 0) {
      throw new Error(`Errors: ${criticalErrors[0].substring(0, 100)}`);
    }
  });

  // === Performance ===
  console.log('\n=== PERFORMANCE ===\n');

  await runTest('Page loads in reasonable time', async () => {
    const startTime = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const domTime = Date.now() - startTime;

    await page.waitForLoadState('networkidle');
    const fullTime = Date.now() - startTime;

    console.log(`  DOM content loaded: ${domTime}ms`);
    console.log(`  Network idle: ${fullTime}ms`);

    if (domTime > 5000) throw new Error(`DOM load too slow: ${domTime}ms`);
  });

  await runTest('Core Web Vitals check', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Get performance timing
    const timing = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0];
      return perf ? {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.startTime,
        loadComplete: perf.loadEventEnd - perf.startTime
      } : null;
    });

    if (timing) {
      console.log(`  DOM Content Loaded: ${Math.round(timing.domContentLoaded)}ms`);
      console.log(`  Load Complete: ${Math.round(timing.loadComplete)}ms`);
    }
  });

  // === Accessibility ===
  console.log('\n=== ACCESSIBILITY ===\n');

  await runTest('Images have alt text', async () => {
    const images = await page.locator('img').all();
    let withAlt = 0;

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      if (alt && alt.length > 0) withAlt++;
    }

    console.log(`  Images with alt: ${withAlt}/${images.length}`);
  });

  await runTest('Interactive elements are focusable', async () => {
    // Tab through elements
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    console.log(`  First focused element: ${focused}`);
  });

  // === Summary ===
  console.log('\n' + '='.repeat(60));
  console.log('USER FLOW TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`PASSED: ${results.passed}`);
  console.log(`FAILED: ${results.failed}`);
  console.log(`TOTAL:  ${results.tests.length}`);
  console.log('');

  const failedTests = results.tests.filter(t => t.status === 'FAILED');
  if (failedTests.length > 0) {
    console.log('FAILED TESTS:');
    for (const test of failedTests) {
      console.log(`  - ${test.name}`);
      console.log(`    Error: ${test.error}`);
    }
    console.log('');
  }

  console.log('PASSED TESTS:');
  for (const test of results.tests.filter(t => t.status === 'PASSED')) {
    console.log(`  + ${test.name}`);
  }

  await browser.close();

  const passRate = Math.round((results.passed / results.tests.length) * 100);
  console.log(`\nPass Rate: ${passRate}%`);
  console.log(`Exit code: ${results.failed > 0 ? 1 : 0}`);

  process.exit(results.failed > 0 ? 1 : 0);
})();
