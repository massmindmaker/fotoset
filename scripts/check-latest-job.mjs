import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const dbUrl = envContent.match(/DATABASE_URL="([^"]+)"/)[1];
const sql = neon(dbUrl);

const jobs = await sql`
  SELECT id, avatar_id, status, completed_photos, total_photos, 
         error_message, created_at, updated_at
  FROM generation_jobs 
  ORDER BY id DESC 
  LIMIT 5
`;

console.log('Latest 5 jobs:');
for (const job of jobs) {
  const updated = new Date(job.updated_at);
  const now = new Date();
  const minAgo = Math.round((now - updated) / 60000);
  console.log('Job ' + job.id + ': ' + job.status + ' (' + job.completed_photos + '/' + job.total_photos + ') - ' + minAgo + 'min ago');
  if (job.error_message) {
    console.log('  Error: ' + job.error_message.slice(0, 150));
  }
}
