import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);
const PROD_URL = 'https://fotoset.vercel.app';

async function testProdApi() {
  console.log('=== Production API Test ===\n');

  try {
    // 1. Test /api/health or basic endpoint
    console.log('--- Testing API connectivity ---');
    const healthRes = await fetch(`${PROD_URL}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: '123456789_test' }),
    });
    console.log(`/api/user status: ${healthRes.status}`);
    const healthData = await healthRes.json();
    console.log('Response:', JSON.stringify(healthData, null, 2));

    // 2. Check webhook logs for recent errors
    console.log('\n--- Recent webhook errors ---');
    const webhookErrors = await sql`
      SELECT id, source, event_type, error_message, created_at
      FROM webhook_logs
      WHERE error_message IS NOT NULL
      ORDER BY created_at DESC LIMIT 10
    `;
    if (webhookErrors.length > 0) {
      console.log(JSON.stringify(webhookErrors, null, 2));
    } else {
      console.log('No webhook errors found');
    }

    // 3. Get detailed job failure info
    console.log('\n--- Generation job details with timing ---');
    const jobs = await sql`
      SELECT
        gj.id,
        gj.status,
        gj.completed_photos,
        gj.total_photos,
        gj.error_message,
        gj.created_at,
        gj.updated_at,
        EXTRACT(EPOCH FROM (gj.updated_at - gj.created_at)) as duration_seconds
      FROM generation_jobs gj
      ORDER BY gj.created_at DESC LIMIT 5
    `;
    jobs.forEach(j => {
      console.log(`\nJob #${j.id}:`);
      console.log(`  Status: ${j.status}`);
      console.log(`  Photos: ${j.completed_photos}/${j.total_photos}`);
      console.log(`  Duration: ${Math.round(j.duration_seconds)}s`);
      console.log(`  Error: ${j.error_message || 'None'}`);
    });

    // 4. Check if any photos were generated
    console.log('\n--- Generated photos timing ---');
    const photos = await sql`
      SELECT
        gp.avatar_id,
        COUNT(*) as count,
        MIN(gp.created_at) as first_photo,
        MAX(gp.created_at) as last_photo,
        EXTRACT(EPOCH FROM (MAX(gp.created_at) - MIN(gp.created_at))) as generation_duration
      FROM generated_photos gp
      GROUP BY gp.avatar_id
      ORDER BY MAX(gp.created_at) DESC LIMIT 5
    `;
    console.log(JSON.stringify(photos, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

testProdApi();
