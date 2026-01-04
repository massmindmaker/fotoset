import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

console.log('=== LAST 10 PAYMENTS ===');
const payments = await sql`
  SELECT id, user_id, tbank_payment_id, amount, status, generation_consumed, consumed_at,
         tier_id, photo_count, created_at, updated_at
  FROM payments
  ORDER BY created_at DESC
  LIMIT 10
`;
console.table(payments);

console.log('\n=== LAST 10 GENERATION JOBS ===');
const jobs = await sql`
  SELECT id, avatar_id, style_id, status, total_photos, completed_photos,
         payment_id, error_message, created_at, updated_at
  FROM generation_jobs
  ORDER BY created_at DESC
  LIMIT 10
`;
console.table(jobs);

console.log('\n=== KIE TASKS SUMMARY ===');
const kieSummary = await sql`
  SELECT status, COUNT(*) as count
  FROM kie_tasks
  GROUP BY status
  ORDER BY count DESC
`;
console.table(kieSummary);

console.log('\n=== RECENT FAILED KIE TASKS (last 15) ===');
const failedKie = await sql`
  SELECT id, job_id, kie_task_id, prompt_index, status, error_message, attempts, created_at
  FROM kie_tasks
  WHERE status = 'failed'
  ORDER BY created_at DESC
  LIMIT 15
`;
console.table(failedKie);

console.log('\n=== STUCK JOBS (processing > 10 min) ===');
const stuckJobs = await sql`
  SELECT id, avatar_id, status, total_photos, completed_photos,
         EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_since_update
  FROM generation_jobs
  WHERE status = 'processing'
    AND updated_at < NOW() - INTERVAL '10 minutes'
  ORDER BY updated_at ASC
`;
console.table(stuckJobs);

console.log('\n=== PENDING JOBS (pending > 15 min) ===');
const pendingJobs = await sql`
  SELECT id, avatar_id, status, payment_id,
         EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_since_created
  FROM generation_jobs
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '15 minutes'
  ORDER BY created_at ASC
`;
console.table(pendingJobs);

console.log('\n=== CONSUMED PAYMENTS WITHOUT JOBS ===');
const consumedNoJob = await sql`
  SELECT p.id, p.user_id, p.tbank_payment_id, p.amount, p.consumed_at, p.consumed_avatar_id,
         (SELECT COUNT(*) FROM generation_jobs WHERE payment_id = p.id) as job_count
  FROM payments p
  WHERE p.generation_consumed = TRUE
    AND p.consumed_at > NOW() - INTERVAL '24 hours'
  ORDER BY p.consumed_at DESC
  LIMIT 10
`;
console.table(consumedNoJob);
