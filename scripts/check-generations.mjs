import { neon } from '@neondatabase/serverless';

// Direct connection string (from neonctl)
const DATABASE_URL = 'postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

async function check() {
  console.log('Connecting to database...');

  // Last 10 generation jobs
  const jobs = await sql`
    SELECT
      gj.id,
      gj.status,
      gj.total_photos,
      gj.completed_photos,
      gj.error_message,
      gj.created_at,
      EXTRACT(EPOCH FROM (gj.updated_at - gj.created_at))::int as duration_seconds
    FROM generation_jobs gj
    ORDER BY gj.created_at DESC
    LIMIT 10
  `;

  console.log('\n=== LAST 10 GENERATION JOBS ===');
  jobs.forEach(j => {
    console.log(`ID: ${j.id} | Status: ${j.status} | Photos: ${j.completed_photos}/${j.total_photos} | Duration: ${j.duration_seconds}s | Error: ${j.error_message || 'none'}`);
  });

  // Kie tasks by status
  const kieTasks = await sql`
    SELECT status, COUNT(*) as count FROM kie_tasks GROUP BY status
  `;
  console.log('\n=== KIE TASKS BY STATUS ===');
  kieTasks.forEach(t => console.log(`${t.status}: ${t.count}`));

  // Stuck tasks
  const stuck = await sql`
    SELECT COUNT(*) as count FROM kie_tasks WHERE status = 'pending' AND created_at < NOW() - interval '10 minutes'
  `;
  console.log(`\nStuck tasks (>10min pending): ${stuck[0].count}`);

  // Recent telegram messages
  const tgMessages = await sql`
    SELECT status, COUNT(*) as count FROM telegram_message_queue GROUP BY status
  `;
  console.log('\n=== TELEGRAM QUEUE STATUS ===');
  tgMessages.forEach(t => console.log(`${t.status}: ${t.count}`));

  // Last payment
  const lastPayment = await sql`
    SELECT id, status, amount, provider, created_at
    FROM payments
    ORDER BY created_at DESC
    LIMIT 5
  `;
  console.log('\n=== LAST 5 PAYMENTS ===');
  lastPayment.forEach(p => {
    console.log(`ID: ${p.id} | Status: ${p.status} | Amount: ${p.amount} | Provider: ${p.provider}`);
  });
}

async function checkJobDetails(jobId) {
  console.log(`\n=== JOB ${jobId} DETAILS ===`);

  const kieTasks = await sql`
    SELECT id, kie_task_id, prompt_index, status, result_url, error_message, attempts, created_at, updated_at
    FROM kie_tasks
    WHERE job_id = ${jobId}
    ORDER BY prompt_index
  `;

  kieTasks.forEach(t => {
    console.log(`Prompt ${t.prompt_index}: ${t.status} | Attempts: ${t.attempts} | Error: ${t.error_message || 'none'}`);
  });
}

check().then(() => checkJobDetails(55)).catch(console.error);
