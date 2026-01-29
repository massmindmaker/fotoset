import { chromium } from 'playwright';

const BASE_URL = 'https://test.pinglass.ru';
const ADMIN_CREDS = { email: 'testadmin@pinglass.ru', password: 'Test123!' };
const PARTNER_CREDS = { email: 'testpartner@pinglass.ru', password: 'Test123!' };

async function testLogin(page, credentials, userType) {
  console.log(`\n=== Testing ${userType.toUpperCase()} Login ===`);

  // Go to login page
  await page.goto(`${BASE_URL}/auth/login?hint=${userType}`, {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Fill form
  await page.fill('input[type="email"], input[name="email"]', credentials.email);
  await page.fill('input[type="password"], input[name="password"]', credentials.password);

  // Submit and wait for response
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/auth/unified-login'), { timeout: 30000 }),
    page.click('button[type="submit"]')
  ]);

  const data = await response.json();
  console.log(`API Response (${response.status()}):`, JSON.stringify(data, null, 2));

  if (data.success) {
    await page.waitForTimeout(2000);
    console.log(`Redirected to: ${page.url()}`);
    return true;
  }
  return false;
}

async function testAdminTabs(page) {
  console.log('\n=== Testing Admin Tabs ===');

  const tabs = [
    { name: 'Dashboard', url: '/admin', selector: 'h1, h2' },
    { name: 'Users', url: '/admin/users', selector: 'table, .user-list' },
    { name: 'Payments', url: '/admin/payments', selector: 'table, .payment-list' },
    { name: 'Settings', url: '/admin/settings', selector: 'form, .settings' },
  ];

  for (const tab of tabs) {
    try {
      await page.goto(`${BASE_URL}${tab.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      const hasContent = await page.$(tab.selector);
      console.log(`  ${tab.name}: ${hasContent ? '✅' : '❌'} (${page.url()})`);
    } catch (err) {
      console.log(`  ${tab.name}: ❌ Error - ${err.message}`);
    }
  }
}

async function testPartnerTabs(page) {
  console.log('\n=== Testing Partner Tabs ===');

  const tabs = [
    { name: 'Dashboard', url: '/partner/dashboard', selector: 'h1, h2, .dashboard' },
    { name: 'Referrals', url: '/partner/referrals', selector: 'table, .referral-list' },
    { name: 'Withdrawals', url: '/partner/withdrawals', selector: 'table, form' },
    { name: 'Settings', url: '/partner/settings', selector: 'form, .settings' },
  ];

  for (const tab of tabs) {
    try {
      await page.goto(`${BASE_URL}${tab.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      const hasContent = await page.$(tab.selector);
      console.log(`  ${tab.name}: ${hasContent ? '✅' : '❌'} (${page.url()})`);
    } catch (err) {
      console.log(`  ${tab.name}: ❌ Error - ${err.message}`);
    }
  }
}

async function main() {
  console.log('Starting cabinet tests...\n');

  const browser = await chromium.launch({ headless: true });

  // Test Admin
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  const adminLoggedIn = await testLogin(adminPage, ADMIN_CREDS, 'admin');
  if (adminLoggedIn) {
    await testAdminTabs(adminPage);
  } else {
    console.log('❌ Admin login failed - skipping tab tests');
  }
  await adminContext.close();

  // Test Partner
  const partnerContext = await browser.newContext();
  const partnerPage = await partnerContext.newPage();

  const partnerLoggedIn = await testLogin(partnerPage, PARTNER_CREDS, 'partner');
  if (partnerLoggedIn) {
    await testPartnerTabs(partnerPage);
  } else {
    console.log('❌ Partner login failed - skipping tab tests');
  }
  await partnerContext.close();

  await browser.close();
  console.log('\n=== Tests Complete ===');
}

main().catch(console.error);
