// PinGlass API Test Suite
const BASE_URL = 'https://pinglass.ru';
const TG_USER_ID = 217133707;

const results = { passed: 0, failed: 0, tests: [] };
let AVATAR_ID = null;
let PAYMENT_ID = null;
let JOB_ID = null;

// Helper to avoid rate limits
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function log(emoji, name, status, data) {
  const passed = emoji === '✅';
  results.tests.push({ name, status, passed, data });
  if (passed) results.passed++; else results.failed++;
  console.log(`${emoji} ${name}: ${status}`);
  if (data && typeof data === 'object') {
    console.log('   Response:', JSON.stringify(data).substring(0, 300));
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  PINGLASS API TEST SUITE');
  console.log('  telegram_user_id:', TG_USER_ID);
  console.log('='.repeat(60) + '\n');

  // ===== СЦЕНАРИЙ 1: Новый пользователь =====
  console.log('\n--- СЦЕНАРИЙ 1: Новый пользователь ---\n');

  // 1.1 Avatar Creation
  try {
    const res = await fetch(`${BASE_URL}/api/avatars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: TG_USER_ID, name: 'Test Avatar API' })
    });
    const data = await res.json();
    AVATAR_ID = data.data?.id || data.id;
    const ok = res.status === 200 || res.status === 201;
    log(ok && AVATAR_ID ? '✅' : '❌', '1.1 Avatar Creation', res.status, data);
  } catch (e) { log('❌', '1.1 Avatar Creation', 'error', e.message); }

  // 1.2 Get Avatars List
  try {
    const res = await fetch(`${BASE_URL}/api/avatars?telegram_user_id=${TG_USER_ID}`);
    const data = await res.json();
    // API returns { success: true, data: { avatars: [...] } }
    const avatars = data.data?.avatars || data.avatars || [];
    const hasAvatars = avatars.length > 0;
    log(res.status === 200 && hasAvatars ? '✅' : '❌', '1.2 Get Avatars List', res.status, data);
  } catch (e) { log('❌', '1.2 Get Avatars List', 'error', e.message); }

  // 1.5 Payment Creation (with email for 54-FZ compliance)
  if (AVATAR_ID) {
    try {
      const res = await fetch(`${BASE_URL}/api/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: TG_USER_ID,
          avatarId: AVATAR_ID,
          tier: 'standard',
          email: 'test@pinglass.ru'  // Required for 54-FZ fiscal receipts
        })
      });
      const data = await res.json();
      PAYMENT_ID = data.paymentId;
      log(res.status === 200 && PAYMENT_ID ? '✅' : '❌', '1.5 Payment Creation', res.status, data);
    } catch (e) { log('❌', '1.5 Payment Creation', 'error', e.message); }
  }

  // 1.6 Payment Status
  if (PAYMENT_ID) {
    try {
      const res = await fetch(`${BASE_URL}/api/payment/status?telegram_user_id=${TG_USER_ID}&payment_id=${PAYMENT_ID}`);
      const data = await res.json();
      log(res.status === 200 ? '✅' : '❌', '1.6 Payment Status', res.status, data);
    } catch (e) { log('❌', '1.6 Payment Status', 'error', e.message); }
  }

  // ===== СЦЕНАРИЙ 3: Авторизация =====
  console.log('\n--- СЦЕНАРИЙ 3: Проверка авторизации ---\n');

  // 3.1 Access without telegram_user_id
  if (AVATAR_ID) {
    try {
      const res = await fetch(`${BASE_URL}/api/avatars/${AVATAR_ID}/references`);
      const data = await res.json();
      log(res.status === 403 ? '✅' : '❌', '3.1 Access without auth', res.status, data);
    } catch (e) { log('❌', '3.1 Access without auth', 'error', e.message); }
  }

  // 3.2 Access with wrong user
  if (AVATAR_ID) {
    try {
      const res = await fetch(`${BASE_URL}/api/avatars/${AVATAR_ID}/references?telegram_user_id=999999999`);
      const data = await res.json();
      log(res.status === 403 ? '✅' : '❌', '3.2 Access wrong user', res.status, data);
    } catch (e) { log('❌', '3.2 Access wrong user', 'error', e.message); }
  }

  // 3.3 Access non-existent resource
  try {
    const res = await fetch(`${BASE_URL}/api/avatars/999999/references?telegram_user_id=${TG_USER_ID}`);
    const data = await res.json();
    log(res.status === 404 ? '✅' : '❌', '3.3 Non-existent resource', res.status, data);
  } catch (e) { log('❌', '3.3 Non-existent resource', 'error', e.message); }

  // ===== СЦЕНАРИЙ 5: Получение данных =====
  console.log('\n--- СЦЕНАРИЙ 5: Получение данных ---\n');

  // 5.2 Avatar Details
  if (AVATAR_ID) {
    try {
      const res = await fetch(`${BASE_URL}/api/avatars/${AVATAR_ID}?telegram_user_id=${TG_USER_ID}`);
      const data = await res.json();
      log(res.status === 200 ? '✅' : '❌', '5.2 Avatar Details', res.status, data);
    } catch (e) { log('❌', '5.2 Avatar Details', 'error', e.message); }
  }

  // 5.3 References (with delay to avoid rate limit)
  if (AVATAR_ID) {
    await delay(2000); // Wait 2s to avoid Neon rate limit
    try {
      const res = await fetch(`${BASE_URL}/api/avatars/${AVATAR_ID}/references?telegram_user_id=${TG_USER_ID}`);
      const data = await res.json();
      log(res.status === 200 ? '✅' : '❌', '5.3 Avatar References', res.status, data);
    } catch (e) { log('❌', '5.3 Avatar References', 'error', e.message); }
  }

  // ===== SUMMARY =====
  console.log('\n' + '='.repeat(60));
  console.log('  РЕЗУЛЬТАТЫ');
  console.log('='.repeat(60));
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Total:  ${results.tests.length}`);
  console.log(`  Avatar ID: ${AVATAR_ID}`);
  console.log(`  Payment ID: ${PAYMENT_ID}`);
  console.log('='.repeat(60) + '\n');
}

runTests().catch(console.error);
