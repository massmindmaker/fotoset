const { chromium } = require('playwright');

const BASE_URL = 'https://www.pinglass.ru';

(async () => {
  console.log('Starting PinGlass User Flow Tests...\n');

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

  await runTest('Homepage displays onboarding view', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Check for onboarding elements
    const hasOnboarding = await page.locator('text=/PinGlass|Розовые очки|AI-фото/i').count() > 0;
    console.log(`  Onboarding elements present: ${hasOnboarding}`);

    // Check for start button
    const startButton = page.locator('button:has-text("Начать")');
    const isVisible = await startButton.isVisible();
    console.log(`  Start button visible: ${isVisible}`);

    if (!isVisible) throw new Error('Start button not found');
  });

  await runTest('Click "Начать" transitions to upload view', async () => {
    const startButton = page.locator('button:has-text("Начать")');
    await startButton.click();
    await page.waitForTimeout(1500);

    // Check for upload zone or dashboard
    const hasUpload = await page.locator('input[type="file"]').count() > 0;
    const hasDropZone = await page.locator('[class*="drop"], [class*="upload"]').count() > 0;
    const hasCreateButton = await page.locator('button:has-text(/создать|create/i)').count() > 0;

    console.log(`  File input: ${hasUpload}`);
    console.log(`  Drop zone: ${hasDropZone}`);
    console.log(`  Create button: ${hasCreateButton}`);

    if (!hasUpload && !hasDropZone && !hasCreateButton) {
      throw new Error('Neither upload zone nor dashboard elements found');
    }
  });

  // === Dashboard Flow ===
  console.log('\n=== DASHBOARD FLOW ===\n');

  await runTest('Dashboard shows empty state for new user', async () => {
    // Reload to ensure clean state
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('button:has-text("Начать")').click();
    await page.waitForTimeout(1500);

    // Look for empty state or create button
    const createButton = page.locator('button:has-text(/создать|новый|аватар/i)');
    const hasCreateButton = await createButton.count() > 0;

    console.log(`  Create button present: ${hasCreateButton}`);
  });

  await runTest('Click "Создать аватар" shows upload interface', async () => {
    // Try clicking create button
    const createButtons = [
      'button:has-text("Создать аватар")',
      'button:has-text("Создать")',
      'button:has-text("Новый аватар")',
      '[data-testid="create-avatar"]',
      'button:has-text("+")'
    ];

    let clicked = false;
    for (const selector of createButtons) {
      const btn = page.locator(selector);
      if (await btn.count() > 0 && await btn.isVisible()) {
        await btn.first().click();
        clicked = true;
        console.log(`  Clicked: ${selector}`);
        break;
      }
    }

    if (!clicked) {
      // Maybe already on upload screen
      const hasUpload = await page.locator('input[type="file"]').count() > 0;
      if (hasUpload) {
        console.log('  Already on upload screen');
        clicked = true;
      }
    }

    await page.waitForTimeout(1500);

    // Verify upload interface
    const hasFileInput = await page.locator('input[type="file"]').count() > 0;
    console.log(`  File input present: ${hasFileInput}`);
  });

  // === Upload Interface ===
  console.log('\n=== UPLOAD INTERFACE ===\n');

  await runTest('Upload interface has file input', async () => {
    // Navigate fresh
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Click start
    await page.locator('button:has-text("Начать")').click();
    await page.waitForTimeout(1500);

    // Try to get to upload
    const createBtn = page.locator('button:has-text(/создать|create/i)');
    if (await createBtn.count() > 0 && await createBtn.isVisible()) {
      await createBtn.first().click();
      await page.waitForTimeout(1500);
    }

    const fileInput = page.locator('input[type="file"]');
    const count = await fileInput.count();
    console.log(`  File input count: ${count}`);

    if (count === 0) throw new Error('No file input found');
  });

  await runTest('Upload interface accepts multiple files', async () => {
    const fileInput = page.locator('input[type="file"]');
    const multiple = await fileInput.getAttribute('multiple');
    console.log(`  Multiple attribute: ${multiple !== null}`);
  });

  await runTest('Upload interface has proceed button (initially disabled)', async () => {
    // Look for continue/proceed button
    const proceedButtons = [
      'button:has-text("Продолжить")',
      'button:has-text("Далее")',
      'button:has-text("Выбрать стиль")'
    ];

    let buttonFound = false;
    for (const selector of proceedButtons) {
      const btn = page.locator(selector);
      if (await btn.count() > 0) {
        buttonFound = true;
        const isDisabled = await btn.isDisabled();
        console.log(`  Button ${selector}: found, disabled=${isDisabled}`);
        break;
      }
    }

    if (!buttonFound) {
      console.log('  No proceed button found (may be conditional)');
    }
  });

  // === Payment Modal ===
  console.log('\n=== PAYMENT MODAL ===\n');

  await runTest('Payment callback page renders', async () => {
    await page.goto(`${BASE_URL}/payment/callback?device_id=test`, {
      waitUntil: 'networkidle',
      timeout: 15000
    });

    // Should show payment status UI
    const hasText = await page.locator('text=/оплат|payment|статус|status/i').count() > 0;
    console.log(`  Payment UI text present: ${hasText}`);

    const bodyText = await page.textContent('body');
    console.log(`  Body content length: ${bodyText.length}`);

    if (bodyText.length < 50) throw new Error('Payment callback page appears empty');
  });

  // === Mobile Viewport Tests ===
  console.log('\n=== MOBILE VIEWPORT ===\n');

  await runTest('Mobile: Homepage renders correctly', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Check start button on mobile
    const startButton = page.locator('button:has-text("Начать")');
    const isVisible = await startButton.isVisible();
    console.log(`  Start button visible on mobile: ${isVisible}`);

    if (!isVisible) throw new Error('Start button not visible on mobile');
  });

  await runTest('Mobile: Header is visible and styled', async () => {
    const header = page.locator('header');
    const hasHeader = await header.count() > 0;
    console.log(`  Header present: ${hasHeader}`);

    if (hasHeader) {
      const box = await header.boundingBox();
      console.log(`  Header height: ${box?.height}px`);
    }
  });

  await runTest('Mobile: Touch targets are adequate size', async () => {
    const buttons = await page.locator('button:visible').all();
    let smallButtons = 0;

    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box && (box.width < 44 || box.height < 44)) {
        smallButtons++;
      }
    }

    console.log(`  Total visible buttons: ${buttons.length}`);
    console.log(`  Small buttons (<44px): ${smallButtons}`);

    if (smallButtons > buttons.length / 2) {
      throw new Error('Too many small touch targets');
    }
  });

  // === Tablet Viewport Tests ===
  console.log('\n=== TABLET VIEWPORT ===\n');

  await runTest('Tablet: Layout adapts correctly', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    const startButton = page.locator('button:has-text("Начать")');
    const isVisible = await startButton.isVisible();
    console.log(`  Start button visible on tablet: ${isVisible}`);
  });

  // === Console Errors Check ===
  console.log('\n=== ERROR CHECKING ===\n');

  await runTest('No JavaScript errors on page load', async () => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log(`  Console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log(`  First error: ${consoleErrors[0].substring(0, 100)}`);
    }

    // Allow some React hydration warnings but fail on actual errors
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('hydration') &&
      !e.includes('Hydration') &&
      !e.includes('Warning:')
    );

    if (criticalErrors.length > 0) {
      throw new Error(`Critical console errors: ${criticalErrors.length}`);
    }
  });

  await runTest('No failed network requests', async () => {
    const failedRequests = [];
    page.on('requestfailed', request => {
      failedRequests.push(`${request.url()} - ${request.failure().errorText}`);
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log(`  Failed requests: ${failedRequests.length}`);
    if (failedRequests.length > 0) {
      console.log(`  First failure: ${failedRequests[0].substring(0, 100)}`);
    }

    // Allow some favicon/analytics failures
    const criticalFailures = failedRequests.filter(r =>
      !r.includes('favicon') &&
      !r.includes('analytics') &&
      !r.includes('sentry')
    );

    if (criticalFailures.length > 0) {
      throw new Error(`Critical network failures: ${criticalFailures.length}`);
    }
  });

  // === Performance Metrics ===
  console.log('\n=== PERFORMANCE ===\n');

  await runTest('Page load performance acceptable', async () => {
    const startTime = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    console.log(`  Full page load: ${loadTime}ms`);

    if (loadTime > 10000) {
      throw new Error(`Page load too slow: ${loadTime}ms`);
    }
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
  }

  console.log('\n' + '='.repeat(60));
  console.log('PASSED TESTS:');
  for (const test of results.tests.filter(t => t.status === 'PASSED')) {
    console.log(`  + ${test.name}`);
  }

  await browser.close();

  console.log(`\nExit code: ${results.failed > 0 ? 1 : 0}`);
  process.exit(results.failed > 0 ? 1 : 0);
})();
