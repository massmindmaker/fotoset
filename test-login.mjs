import { chromium } from 'playwright';

async function testAdminLogin() {
  console.log('Starting Playwright test...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept API responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/auth/unified-login')) {
      console.log('\n=== API RESPONSE ===');
      console.log('Status:', response.status());
      try {
        const body = await response.json();
        console.log('Body:', JSON.stringify(body, null, 2));
      } catch (e) {
        console.log('Body: (not JSON)');
      }
      console.log('===================\n');
    }
  });

  try {
    // Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('https://test.pinglass.ru/auth/login?hint=admin', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Page title:', await page.title());

    // Find form elements
    const emailInput = await page.$('input[type="email"], input[name="email"]');
    const passwordInput = await page.$('input[type="password"], input[name="password"]');

    if (!emailInput || !passwordInput) {
      console.log('Form inputs not found');
      return;
    }

    console.log('2. Filling form...');
    await emailInput.fill('testadmin@pinglass.ru');
    await passwordInput.fill('Test123!');

    // Find and click submit button
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      console.log('3. Clicking submit...');

      // Wait for API response
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/auth/unified-login'), { timeout: 30000 }),
        submitButton.click()
      ]);

      console.log('4. API Response status:', response.status());
      const data = await response.json();
      console.log('API Response:', JSON.stringify(data, null, 2));

      // Wait a bit for redirect
      await page.waitForTimeout(2000);
      console.log('5. Final URL:', page.url());

    } else {
      console.log('Submit button not found');
    }

  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    await browser.close();
  }
}

testAdminLogin();
