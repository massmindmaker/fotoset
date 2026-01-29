import { chromium } from 'playwright';

async function testAdminLoginFresh() {
  // Use incognito context
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('=== FRESH ADMIN LOGIN TEST ===\n');

  // Collect responses
  const responses = [];
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      responses.push({ url: response.url(), status: response.status() });
    }
  });

  console.log('Step 1: Opening login page...');
  await page.goto('https://test.pinglass.ru/auth/login?hint=admin', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('Page title:', await page.title());

  await page.screenshot({ path: 'C:/Users/bob/Projects/Fotoset/admin-test-fresh-01.png', fullPage: true });

  console.log('\nStep 2: Filling credentials...');
  await page.fill('input[type="email"]', 'massmindmaker@gmail.com');
  await page.fill('input[type="password"]', 'MegaAdmin2025!');

  console.log('\nStep 3: Submitting...');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('unified-login'), { timeout: 30000 }).then(r => {
      console.log('Login API response status:', r.status());
      return r.json().then(body => {
        console.log('Login API response:', JSON.stringify(body, null, 2));
      }).catch(() => {});
    }).catch(e => console.log('No response captured:', e.message)),
    page.click('button[type="submit"]'),
  ]);

  await page.waitForTimeout(3000);
  console.log('\nStep 4: Current URL:', page.url());

  await page.screenshot({ path: 'C:/Users/bob/Projects/Fotoset/admin-test-fresh-02.png', fullPage: true });

  if (page.url().includes('/admin')) {
    console.log('\n=== SUCCESS ===');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/bob/Projects/Fotoset/admin-test-fresh-03-dashboard.png', fullPage: true });
  } else {
    console.log('\n=== STILL ON LOGIN ===');
    // Check for visible errors
    const pageText = await page.textContent('body');
    if (pageText.includes('много')) {
      console.log('Rate limit detected in page text');
    }
    if (pageText.includes('Неверный')) {
      console.log('Invalid credentials detected');
    }
  }

  console.log('\nAPI responses:', responses);

  await browser.close();
}

testAdminLoginFresh().catch(console.error);
