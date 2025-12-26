import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);
const PROD_URL = 'https://fotoset.vercel.app';

// Test configuration
const TEST_USER_ID = 92;
const TEST_AVATAR_ID = 9;
const TEST_TELEGRAM_USER_ID = 7731172872; // number, not string!
const TEST_EMAIL = 'test@example.com';
const TIER = 'starter'; // 7 photos

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testGenerationE2E() {
  console.log('=== E2E Generation Test ===\n');
  console.log(`URL: ${PROD_URL}`);
  console.log(`User ID: ${TEST_USER_ID}, Avatar ID: ${TEST_AVATAR_ID}`);
  console.log(`Tier: ${TIER} (7 photos)\n`);

  const startTime = Date.now();

  try {
    // Step 1: Get reference photos
    console.log('--- Step 1: Get reference photos ---');
    const refs = await sql`
      SELECT image_url FROM reference_photos
      WHERE avatar_id = ${TEST_AVATAR_ID}
      LIMIT 10
    `;
    console.log(`Found ${refs.length} reference photos`);

    if (refs.length < 1) {
      console.error('ERROR: No reference photos found!');
      process.exit(1);
    }

    const referenceImages = refs.map(r => r.image_url);
    console.log('First ref URL:', referenceImages[0].substring(0, 60) + '...');

    // Step 2: Create payment (test mode)
    console.log('\n--- Step 2: Create payment ---');
    const paymentRes = await fetch(`${PROD_URL}/api/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        email: TEST_EMAIL,
        tierId: TIER,
        avatarId: TEST_AVATAR_ID,
      }),
    });

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      console.error('Payment creation failed:', paymentRes.status, errorText);
      process.exit(1);
    }

    const paymentData = await paymentRes.json();
    console.log('Payment created:', JSON.stringify(paymentData, null, 2));

    const tbankPaymentId = paymentData.paymentId;
    console.log(`TBank Payment ID: ${tbankPaymentId}`);
    console.log(`Test mode: ${paymentData.testMode}`);

    // Step 3: Simulate successful payment (via direct DB update in test mode)
    console.log('\n--- Step 3: Simulate payment success ---');

    // In test mode, we need to manually update payment status and trigger generation
    // First, mark payment as succeeded (using tbank_payment_id, not id!)
    await sql`
      UPDATE payments
      SET status = 'succeeded', updated_at = NOW()
      WHERE tbank_payment_id = ${tbankPaymentId}
    `;
    console.log('Payment marked as succeeded');

    // Note: is_pro column no longer exists - payment status is checked directly
    // The generate API checks for succeeded payment by avatarId

    // Step 4: Call generate API
    console.log('\n--- Step 4: Start generation ---');
    const genRes = await fetch(`${PROD_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId: TEST_TELEGRAM_USER_ID,
        avatarId: TEST_AVATAR_ID,
        styleId: 'pinglass',
        useStoredReferences: true, // Use reference photos from DB
        photoCount: 7, // Starter tier
      }),
    });

    console.log(`Generate response status: ${genRes.status}`);
    const genData = await genRes.json();
    console.log('Generate response:', JSON.stringify(genData, null, 2));

    if (!genRes.ok) {
      console.error('Generation failed to start!');
      process.exit(1);
    }

    // jobId is inside data object
    const jobId = genData.data?.jobId || genData.jobId;
    console.log(`\nJob ID: ${jobId}`);
    console.log('Generation started via QStash...\n');

    // Step 5: Poll for completion
    console.log('--- Step 5: Polling for completion ---');
    const maxWaitTime = 600000; // 10 minutes max
    const pollInterval = 5000; // 5 seconds
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
      await sleep(pollInterval);
      elapsed += pollInterval;

      const job = await sql`
        SELECT id, status, completed_photos, total_photos, error_message, updated_at
        FROM generation_jobs
        WHERE id = ${jobId}
      `.then(rows => rows[0]);

      if (!job) {
        console.log(`[${elapsed/1000}s] Job not found!`);
        break;
      }

      const progress = `${job.completed_photos}/${job.total_photos}`;
      console.log(`[${elapsed/1000}s] Status: ${job.status}, Progress: ${progress}`);

      if (job.status === 'completed') {
        console.log('\n=== GENERATION COMPLETED ===');

        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`Total time: ${totalTime.toFixed(1)}s (${(totalTime/60).toFixed(2)} min)`);

        // Get generated photos
        const photos = await sql`
          SELECT id, style_id, SUBSTRING(image_url, 1, 80) as url_preview
          FROM generated_photos
          WHERE avatar_id = ${TEST_AVATAR_ID}
          ORDER BY created_at DESC
          LIMIT 10
        `;

        console.log(`\nGenerated photos: ${photos.length}`);
        photos.forEach((p, i) => {
          console.log(`  ${i+1}. ${p.url_preview}...`);
        });

        process.exit(0);
      }

      if (job.status === 'failed') {
        console.log('\n=== GENERATION FAILED ===');
        console.log(`Error: ${job.error_message}`);

        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`Total time: ${totalTime.toFixed(1)}s`);

        process.exit(1);
      }
    }

    console.log('\n=== TIMEOUT ===');
    console.log('Generation did not complete within 10 minutes');
    process.exit(1);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testGenerationE2E();
