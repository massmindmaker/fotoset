import { chromium } from 'playwright';

async function testAdminLogin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  const networkErrors = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push({ url: response.url(), status: response.status() });
    }
  });

  console.log('=== ADMIN LOGIN TEST ===\n');

  console.log('Step 1: Opening login page...');
  await page.goto('https://test.pinglass.ru/auth/login?hint=admin', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Page title:', await page.title());
  console.log('URL:', page.url());

  await page.screenshot({ path: 'C:/Users/bob/Projects/Fotoset/admin-test-01-login-page.png', fullPage: true });
  console.log('Screenshot: admin-test-01-login-page.png\n');

  console.log('Page structure:');
  const inputs = await page.$$('input');
  for (const input of inputs) {
    const type = await input.getAttribute('type') || 'text';
    const name = await input.getAttribute('name');
    console.log('  Input: type=' + type + ', name=' + name);
  }

  const buttons = await page.$$('button');
  for (const button of buttons) {
    const text = (await button.textContent())?.trim();
    const type = await button.getAttribute('type');
    console.log('  Button: "' + text + '", type=' + type);
  }
  console.log('');

  console.log('Step 2: Filling credentials...');
  await page.fill('input[type="email"]', 'massmindmaker@gmail.com');
  await page.fill('input[type="password"]', 'MegaAdmin2025!');
  
  await page.screenshot({ path: 'C:/Users/bob/Projects/Fotoset/admin-test-02-filled.png', fullPage: true });
  console.log('Screenshot: admin-test-02-filled.png\n');

  console.log('Step 3: Clicking submit...');
  
  const responsePromise = page.waitForResponse(r => r.url().includes('/api/') || r.url().includes('/auth/'), { timeout: 15000 }).catch(() => null);
  await page.click('button[type="submit"]');
  const response = await responsePromise;

  if (response) {
    console.log('API Response: ' + response.url() + ' - ' + response.status());
    try {
      const body = await response.json();
      console.log('Response body:', JSON.stringify(body, null, 2).substring(0, 500));
    } catch (e) {
      console.log('Response is not JSON');
    }
  }

  await page.waitForTimeout(3000);

  console.log('\nStep 4: After submit...');
  console.log('Current URL:', page.url());

  await page.screenshot({ path: 'C:/Users/bob/Projects/Fotoset/admin-test-03-after-submit.png', fullPage: true });
  console.log('Screenshot: admin-test-03-after-submit.png\n');

  const bodyText = await page.textContent('body');
  
  if (page.url().includes('/auth/login')) {
    console.log('Still on login page. Checking for errors...');
    const errorElements = await page.$$('[class*="error"], [role="alert"], [class*="destructive"]');
    for (const el of errorElements) {
      const isVisible = await el.isVisible();
      if (isVisible) {
        const text = (await el.textContent())?.trim();
        if (text) console.log('  Error: "' + text + '"');
      }
    }
    
    const toasts = await page.$$('[class*="toast"], [class*="notification"]');
    for (const toast of toasts) {
      const text = (await toast.textContent())?.trim();
      if (text) console.log('  Toast: "' + text + '"');
    }
  }

  if (page.url().includes('/admin')) {
    console.log('\n=== SUCCESS: Redirected to admin! ===');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/bob/Projects/Fotoset/admin-test-04-dashboard.png', fullPage: true });
    console.log('Screenshot: admin-test-04-dashboard.png');
    
    const h1 = await page.$eval('h1', el => el.textContent).catch(() => 'No h1');
    console.log('Dashboard heading:', h1);
  }

  if (consoleLogs.some(l => l.type === 'error')) {
    console.log('\n=== Console Errors ===');
    consoleLogs.filter(l => l.type === 'error').slice(0, 10).forEach(l => console.log(l.text));
  }

  if (networkErrors.length > 0) {
    console.log('\n=== Network Errors ===');
    networkErrors.slice(0, 10).forEach(e => console.log(e.status + ': ' + e.url));
  }

  await browser.close();
  console.log('\n=== Test completed ===');
}

testAdminLogin().catch(console.error);
