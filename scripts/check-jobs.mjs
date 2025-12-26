import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkJobs() {
  const jobs = await sql`
    SELECT id, status, error_message, completed_photos, total_photos,
           created_at, updated_at
    FROM generation_jobs
    ORDER BY id DESC
    LIMIT 5
  `;

  console.log('Recent jobs:');
  jobs.forEach(j => {
    const created = new Date(j.created_at);
    const updated = new Date(j.updated_at);
    const durationSec = (updated - created) / 1000;

    console.log(`Job ${j.id}: ${j.status} (${j.completed_photos}/${j.total_photos}) - ${durationSec.toFixed(0)}s`);
    console.log(`  Error: ${j.error_message || 'none'}`);
  });
}

checkJobs();
