import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const dbUrl = envContent.match(/DATABASE_URL="([^"]+)"/)[1];
const sql = neon(dbUrl);

console.log('=== Cleaning up stuck generation jobs ===\n');

// Find stuck jobs (status='processing' and not updated in 30+ minutes)
const stuckJobs = await sql`
  SELECT gj.id, gj.avatar_id, gj.status, gj.completed_photos, gj.total_photos, gj.updated_at,
         a.name as avatar_name, a.status as avatar_status
  FROM generation_jobs gj
  LEFT JOIN avatars a ON a.id = gj.avatar_id
  WHERE gj.status = 'processing'
    AND gj.updated_at < NOW() - INTERVAL '30 minutes'
`;

console.log(`Found ${stuckJobs.length} stuck jobs\n`);

if (stuckJobs.length === 0) {
  console.log('No stuck jobs to clean up.');
  process.exit(0);
}

// Display stuck jobs before cleanup
console.log('Stuck jobs to clean up:');
stuckJobs.forEach(job => {
  console.log(`  Job #${job.id}: avatar_id=${job.avatar_id} (${job.avatar_name || 'unnamed'})`);
  console.log(`    Status: ${job.status}, Photos: ${job.completed_photos}/${job.total_photos}`);
  console.log(`    Last updated: ${job.updated_at}`);
  console.log(`    Avatar status: ${job.avatar_status}`);
});

console.log('\n--- Running cleanup ---\n');

// Update generation_jobs to failed
const updatedJobs = await sql`
  UPDATE generation_jobs
  SET status = 'failed',
      error_message = 'Timeout - cleaned up',
      updated_at = NOW()
  WHERE status = 'processing'
    AND updated_at < NOW() - INTERVAL '30 minutes'
  RETURNING id, avatar_id
`;

console.log(`Updated ${updatedJobs.length} generation jobs to 'failed'`);

// Get avatar IDs from stuck jobs
const avatarIds = stuckJobs.map(j => j.avatar_id).filter(Boolean);

if (avatarIds.length > 0) {
  // Update corresponding avatars from 'processing' to 'draft'
  const updatedAvatars = await sql`
    UPDATE avatars
    SET status = 'draft',
        updated_at = NOW()
    WHERE id = ANY(${avatarIds})
      AND status = 'processing'
    RETURNING id, name
  `;

  console.log(`Updated ${updatedAvatars.length} avatars to 'draft'`);
  updatedAvatars.forEach(a => {
    console.log(`  Avatar #${a.id}: ${a.name || 'unnamed'}`);
  });
}

console.log('\n=== Cleanup complete ===');
console.log(`Summary: ${updatedJobs.length} jobs cleaned up`);
