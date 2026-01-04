#!/usr/bin/env node

/**
 * Test Generation API
 * Tests the /api/generate endpoint with race condition protection
 */

import 'dotenv/config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testGenerationAPI() {
  console.log('🧪 Testing Generation API\n');
  console.log('Base URL:', BASE_URL);
  console.log('='.repeat(60));

  // Test 1: Missing telegramUserId
  console.log('\n📋 Test 1: Missing telegramUserId (should fail)');
  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarId: '1',
        styleId: 'photoset',
        referenceImages: ['https://example.com/image.jpg']
      })
    });
    const data = await res.json();
    console.log('   Status:', res.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
    console.log('   ✓ Test passed:', data.error?.includes('telegramUserId') ? 'Correct error' : 'UNEXPECTED');
  } catch (err) {
    console.log('   ✗ Error:', err.message);
  }

  // Test 2: Invalid telegramUserId format
  console.log('\n📋 Test 2: Invalid telegramUserId format (should fail)');
  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId: 'not-a-number',
        avatarId: '1',
        styleId: 'photoset',
        referenceImages: ['https://example.com/image.jpg']
      })
    });
    const data = await res.json();
    console.log('   Status:', res.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
    console.log('   ✓ Test passed:', data.error?.includes('Invalid') ? 'Correct error' : 'UNEXPECTED');
  } catch (err) {
    console.log('   ✗ Error:', err.message);
  }

  // Test 3: No payment available
  console.log('\n📋 Test 3: No available payment (should fail with NO_PAYMENT)');
  try {
    const testTelegramId = 999999999; // Non-existent user
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId: testTelegramId,
        avatarId: '1',
        styleId: 'photoset',
        referenceImages: ['https://example.com/image.jpg']
      })
    });
    const data = await res.json();
    console.log('   Status:', res.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
    const expectedError = data.code === 'NO_PAYMENT' || data.error?.includes('payment');
    console.log('   ✓ Test passed:', expectedError ? 'Correct - no payment' : 'Check response');
  } catch (err) {
    console.log('   ✗ Error:', err.message);
  }

  // Test 4: Invalid style
  console.log('\n📋 Test 4: Invalid style (should fail)');
  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId: 123456789,
        avatarId: '1',
        styleId: 'invalid-style',
        referenceImages: ['https://example.com/image.jpg']
      })
    });
    const data = await res.json();
    console.log('   Status:', res.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
    console.log('   ✓ Test passed:', data.error?.includes('Invalid style') || data.code === 'INVALID_STYLE' ? 'Correct error' : 'UNEXPECTED');
  } catch (err) {
    console.log('   ✗ Error:', err.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Basic validation tests completed\n');

  // Check if we can query DB for a real user with payment
  console.log('📊 Checking database for test data...\n');

  const { neon } = await import('@neondatabase/serverless');
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('⚠️  DATABASE_URL not set - skipping DB tests');
    return;
  }

  const sql = neon(databaseUrl);

  // Find a user with available payment
  const usersWithPayment = await sql`
    SELECT u.id, u.telegram_user_id, p.id as payment_id, p.tier_id, p.photo_count, p.amount
    FROM users u
    JOIN payments p ON p.user_id = u.id
    WHERE p.status = 'succeeded'
      AND COALESCE(p.generation_consumed, FALSE) = FALSE
    ORDER BY p.created_at DESC
    LIMIT 5
  `;

  console.log('Users with available payments:', usersWithPayment.length);
  if (usersWithPayment.length > 0) {
    console.table(usersWithPayment.map(u => ({
      userId: u.id,
      telegramId: u.telegram_user_id,
      paymentId: u.payment_id,
      tier: u.tier_id,
      photos: u.photo_count,
      amount: u.amount
    })));
  }

  // Check QStash idempotency table
  console.log('\n📊 QStash processed messages (last 5):');
  try {
    const qstashMessages = await sql`
      SELECT message_id, job_id, processed_at
      FROM qstash_processed_messages
      ORDER BY created_at DESC
      LIMIT 5
    `;
    if (qstashMessages.length > 0) {
      console.table(qstashMessages);
    } else {
      console.log('   No messages yet (table exists but empty)');
    }
  } catch (err) {
    if (err.message?.includes('does not exist')) {
      console.log('   ⚠️ Table not created yet - run migration 031');
    } else {
      console.log('   Error:', err.message);
    }
  }

  // Check unique constraint on generation_jobs
  console.log('\n📊 Checking unique constraint on generation_jobs.payment_id:');
  try {
    const constraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'generation_jobs'
        AND constraint_name = 'generation_jobs_payment_id_unique'
    `;
    if (constraints.length > 0) {
      console.log('   ✓ Constraint exists:', constraints[0].constraint_name);
    } else {
      console.log('   ⚠️ Constraint not found - run migration 030');
    }
  } catch (err) {
    console.log('   Error:', err.message);
  }

  // Check recent generation jobs
  console.log('\n📊 Recent generation jobs:');
  const recentJobs = await sql`
    SELECT id, avatar_id, status, total_photos, completed_photos, payment_id,
           created_at, error_message
    FROM generation_jobs
    ORDER BY created_at DESC
    LIMIT 5
  `;
  if (recentJobs.length > 0) {
    console.table(recentJobs.map(j => ({
      id: j.id,
      avatarId: j.avatar_id,
      status: j.status,
      photos: `${j.completed_photos}/${j.total_photos}`,
      paymentId: j.payment_id,
      error: j.error_message?.substring(0, 30)
    })));
  } else {
    console.log('   No generation jobs yet');
  }

  // Check Kie tasks
  console.log('\n📊 Kie.ai tasks status:');
  const kieTasks = await sql`
    SELECT status, COUNT(*) as count
    FROM kie_tasks
    GROUP BY status
  `;
  if (kieTasks.length > 0) {
    console.table(kieTasks);
  } else {
    console.log('   No Kie tasks yet');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Database check completed');
}

testGenerationAPI().catch(console.error);
