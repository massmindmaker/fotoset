import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkJobErrors() {
  console.log('=== Generation Jobs Detailed Analysis ===\n');

  try {
    // Get all jobs with error messages
    console.log('--- GENERATION_JOBS with errors ---');
    const jobs = await sql`
      SELECT gj.id, gj.avatar_id, gj.status, gj.completed_photos, gj.total_photos,
             gj.error_message, gj.payment_id, gj.created_at, gj.updated_at,
             a.user_id, u.telegram_user_id
      FROM generation_jobs gj
      JOIN avatars a ON gj.avatar_id = a.id
      JOIN users u ON a.user_id = u.id
      ORDER BY gj.created_at DESC LIMIT 10
    `;
    jobs.forEach(j => {
      console.log(`\nJob #${j.id}:`);
      console.log(`  Avatar: ${j.avatar_id}, User TG: ${j.telegram_user_id}`);
      console.log(`  Status: ${j.status}`);
      console.log(`  Photos: ${j.completed_photos}/${j.total_photos}`);
      console.log(`  Payment ID: ${j.payment_id || 'NULL'}`);
      console.log(`  Error: ${j.error_message || 'None'}`);
      console.log(`  Created: ${j.created_at}`);
      console.log(`  Updated: ${j.updated_at}`);
    });

    // Check generated photos
    console.log('\n\n--- GENERATED_PHOTOS (last 20) ---');
    const photos = await sql`
      SELECT gp.id, gp.avatar_id, gp.style_id, gp.created_at,
             SUBSTRING(gp.image_url, 1, 80) as image_url_preview
      FROM generated_photos gp
      ORDER BY gp.created_at DESC LIMIT 20
    `;
    console.log(JSON.stringify(photos, null, 2));

    // Check webhook logs for errors
    console.log('\n\n--- WEBHOOK_LOGS (last 10) ---');
    const webhooks = await sql`
      SELECT id, source, event_type, processed, error_message, created_at
      FROM webhook_logs
      ORDER BY created_at DESC LIMIT 10
    `;
    console.log(JSON.stringify(webhooks, null, 2));

    // Check reference photos (were they uploaded?)
    console.log('\n\n--- REFERENCE_PHOTOS count by avatar ---');
    const refPhotos = await sql`
      SELECT avatar_id, COUNT(*) as count
      FROM reference_photos
      GROUP BY avatar_id
      ORDER BY avatar_id DESC
    `;
    console.log(JSON.stringify(refPhotos, null, 2));

  } catch (e) {
    console.error('Error:', e.message);
    console.error('Full error:', e);
  }
}

checkJobErrors();
