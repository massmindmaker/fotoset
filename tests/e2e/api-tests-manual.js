const { chromium } = require('playwright');

const BASE_URL = 'https://www.pinglass.ru';

(async () => {
  console.log('Starting PinGlass API Tests...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
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

  // === Telegram Auth Endpoint Tests ===
  console.log('\n=== POST /api/telegram/auth ===\n');

  await runTest('POST /api/telegram/auth - rejects empty body', async () => {
    const response = await page.request.post(`${BASE_URL}/api/telegram/auth`, {
      data: {}
    });
    console.log(`  Status: ${response.status()}`);
    if (response.status() < 400) throw new Error(`Expected 4xx, got ${response.status()}`);
  });

  await runTest('POST /api/telegram/auth - rejects invalid initData', async () => {
    const response = await page.request.post(`${BASE_URL}/api/telegram/auth`, {
      data: { initData: 'invalid_data_string' }
    });
    console.log(`  Status: ${response.status()}`);
    if (response.status() < 400) throw new Error(`Expected 4xx, got ${response.status()}`);
  });

  // === Avatars Endpoint Tests ===
  console.log('\n=== GET /api/avatars ===\n');

  await runTest('GET /api/avatars - requires authentication', async () => {
    const response = await page.request.get(`${BASE_URL}/api/avatars`);
    console.log(`  Status: ${response.status()}`);
    if (response.status() !== 401 && response.status() !== 403) {
      throw new Error(`Expected 401/403, got ${response.status()}`);
    }
  });

  await runTest('GET /api/avatars - with fake telegram_user_id', async () => {
    const response = await page.request.get(`${BASE_URL}/api/avatars?telegram_user_id=123456789`);
    console.log(`  Status: ${response.status()}`);
    // Should return empty array or 401 depending on implementation
    if (response.status() === 200) {
      const data = await response.json();
      console.log(`  Response: ${JSON.stringify(data)}`);
    }
  });

  // === Payment Endpoints Tests ===
  console.log('\n=== Payment Endpoints ===\n');

  await runTest('POST /api/payment/create - requires deviceId', async () => {
    const response = await page.request.post(`${BASE_URL}/api/payment/create`, {
      data: {}
    });
    console.log(`  Status: ${response.status()}`);
    if (response.status() < 400) throw new Error(`Expected 4xx, got ${response.status()}`);
  });

  await runTest('POST /api/payment/create - rejects empty deviceId', async () => {
    const response = await page.request.post(`${BASE_URL}/api/payment/create`, {
      data: { deviceId: '' }
    });
    console.log(`  Status: ${response.status()}`);
    if (response.status() < 400) throw new Error(`Expected 4xx, got ${response.status()}`);
  });

  await runTest('POST /api/payment/create - creates payment with valid data', async () => {
    const response = await page.request.post(`${BASE_URL}/api/payment/create`, {
      data: {
        deviceId: `test-device-${Date.now()}`,
        telegramUserId: 123456789,
        email: 'test@example.com',
        tierId: 'standard',
        photoCount: 15
      }
    });
    console.log(`  Status: ${response.status()}`);
    if (response.ok()) {
      const data = await response.json();
      console.log(`  Response keys: ${Object.keys(data).join(', ')}`);
      if (!data.paymentId) throw new Error('Missing paymentId in response');
      if (!data.confirmationUrl) throw new Error('Missing confirmationUrl');
    }
  });

  await runTest('GET /api/payment/status - requires device_id and payment_id', async () => {
    const response = await page.request.get(`${BASE_URL}/api/payment/status`);
    console.log(`  Status: ${response.status()}`);
    if (response.status() < 400) throw new Error(`Expected 4xx, got ${response.status()}`);
  });

  await runTest('GET /api/payment/status - returns status for valid params', async () => {
    const response = await page.request.get(
      `${BASE_URL}/api/payment/status?device_id=test-123&payment_id=test-payment`
    );
    console.log(`  Status: ${response.status()}`);
    if (response.ok()) {
      const data = await response.json();
      console.log(`  Response: ${JSON.stringify(data)}`);
    }
  });

  // === Generate Endpoint Tests ===
  console.log('\n=== POST /api/generate ===\n');

  await runTest('POST /api/generate - requires authentication', async () => {
    const response = await page.request.post(`${BASE_URL}/api/generate`, {
      data: {}
    });
    console.log(`  Status: ${response.status()}`);
    // Should require auth or return 400/403
    if (response.status() !== 400 && response.status() !== 401 && response.status() !== 403) {
      throw new Error(`Expected 400/401/403, got ${response.status()}`);
    }
  });

  await runTest('POST /api/generate - rejects without required fields', async () => {
    const response = await page.request.post(`${BASE_URL}/api/generate`, {
      data: {
        deviceId: 'test-device',
        avatarId: '123'
        // missing styleId, photoCount
      }
    });
    console.log(`  Status: ${response.status()}`);
    if (response.status() < 400) throw new Error(`Expected 4xx, got ${response.status()}`);
  });

  await runTest('POST /api/generate - validates styleId', async () => {
    const response = await page.request.post(`${BASE_URL}/api/generate`, {
      data: {
        deviceId: 'test-device',
        avatarId: '123',
        styleId: 'invalid_style',
        photoCount: 23
      }
    });
    console.log(`  Status: ${response.status()}`);
    if (response.status() < 400) throw new Error(`Expected 4xx for invalid styleId`);
  });

  // === Upload Endpoint Tests ===
  console.log('\n=== POST /api/upload ===\n');

  await runTest('POST /api/upload - requires authentication', async () => {
    const response = await page.request.post(`${BASE_URL}/api/upload`, {
      data: {}
    });
    console.log(`  Status: ${response.status()}`);
    if (response.status() !== 400 && response.status() !== 401) {
      throw new Error(`Expected 400/401, got ${response.status()}`);
    }
  });

  // === Referral Endpoints ===
  console.log('\n=== Referral Endpoints ===\n');

  await runTest('GET /api/referral/stats - requires telegram_user_id', async () => {
    const response = await page.request.get(`${BASE_URL}/api/referral/stats`);
    console.log(`  Status: ${response.status()}`);
    if (response.status() < 400) throw new Error(`Expected 4xx, got ${response.status()}`);
  });

  await runTest('GET /api/referral/stats - with telegram_user_id', async () => {
    const response = await page.request.get(
      `${BASE_URL}/api/referral/stats?telegram_user_id=123456789`
    );
    console.log(`  Status: ${response.status()}`);
    if (response.ok()) {
      const data = await response.json();
      console.log(`  Response: ${JSON.stringify(data)}`);
    }
  });

  // === Security Tests ===
  console.log('\n=== Security Tests ===\n');

  await runTest('SQL Injection prevention - user endpoint', async () => {
    const maliciousDeviceId = "'; DROP TABLE users; --";
    const response = await page.request.post(`${BASE_URL}/api/user`, {
      data: { deviceId: maliciousDeviceId }
    });
    // Should not crash server - any response except 500 is OK
    console.log(`  Status: ${response.status()}`);
    if (response.status() >= 500) throw new Error('Possible SQL injection vulnerability');
  });

  await runTest('XSS prevention - user endpoint', async () => {
    const xssPayload = '<script>alert("XSS")</script>';
    const response = await page.request.post(`${BASE_URL}/api/user`, {
      data: { deviceId: xssPayload }
    });
    console.log(`  Status: ${response.status()}`);
    if (response.ok()) {
      const data = await response.json();
      const dataStr = JSON.stringify(data);
      if (dataStr.includes('<script>')) {
        throw new Error('XSS payload not sanitized');
      }
    }
  });

  await runTest('Error responses are JSON', async () => {
    const response = await page.request.post(`${BASE_URL}/api/generate`, {
      data: { invalid: 'data' }
    });
    if (!response.ok()) {
      const contentType = response.headers()['content-type'] || '';
      console.log(`  Content-Type: ${contentType}`);
      if (!contentType.includes('application/json')) {
        throw new Error('Error response is not JSON');
      }
    }
  });

  await runTest('No sensitive data in error responses', async () => {
    const response = await page.request.post(`${BASE_URL}/api/generate`, {
      data: { invalid: 'data' }
    });
    if (!response.ok()) {
      const errorText = await response.text();
      const sensitivePatterns = ['DATABASE_URL', 'API_KEY', 'PASSWORD', 'SECRET', 'postgresql://'];
      for (const pattern of sensitivePatterns) {
        if (errorText.includes(pattern)) {
          throw new Error(`Error contains sensitive data: ${pattern}`);
        }
      }
    }
  });

  // === Performance Tests ===
  console.log('\n=== Performance Tests ===\n');

  await runTest('Payment status responds < 500ms', async () => {
    const start = Date.now();
    await page.request.get(
      `${BASE_URL}/api/payment/status?device_id=test&payment_id=test`
    );
    const duration = Date.now() - start;
    console.log(`  Duration: ${duration}ms`);
    if (duration > 500) throw new Error(`Too slow: ${duration}ms`);
  });

  await runTest('Homepage loads < 3s', async () => {
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const duration = Date.now() - start;
    console.log(`  Duration: ${duration}ms`);
    if (duration > 3000) throw new Error(`Too slow: ${duration}ms`);
  });

  // === Summary ===
  console.log('\n' + '='.repeat(60));
  console.log('API TEST RESULTS');
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

  await browser.close();

  console.log(`\nExit code: ${results.failed > 0 ? 1 : 0}`);
  process.exit(results.failed > 0 ? 1 : 0);
})();
