import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const dbUrl = envContent.match(/DATABASE_URL="([^"]+)"/)[1];
const sql = neon(dbUrl);

const jobId = process.argv[2] || 21;

const jobs = await sql`SELECT * FROM generation_jobs WHERE id = ${jobId}`;

if (jobs.length === 0) {
  console.log(`Job ${jobId} not found`);
  process.exit(1);
}

const job = jobs[0];
console.log(`Job ${job.id}:`);
console.log(`  Status: ${job.status}`);
console.log(`  Photos: ${job.completed_photos}/${job.total_photos}`);
console.log(`  Created: ${job.created_at}`);
console.log(`  Updated: ${job.updated_at}`);
if (job.error_message) {
  console.log(`  Error: ${job.error_message.substring(0, 200)}...`);
}

// Also check generated photos
const photos = await sql`SELECT id, style_id, image_url FROM generated_photos WHERE avatar_id = ${job.avatar_id} ORDER BY id DESC LIMIT 5`;
console.log(`\nRecent generated photos for avatar ${job.avatar_id}:`);
photos.forEach(p => console.log(`  ID:${p.id} url:${p.image_url?.substring(0, 60)}...`));
