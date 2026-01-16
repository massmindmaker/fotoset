import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function check() {
  console.log('=== RECENT GENERATION JOBS ===');
  const jobs = await sql`
    SELECT
      gj.id,
      gj.status,
      gj.created_at::text as created,
      gj.updated_at::text as updated
    FROM generation_jobs gj
    ORDER BY gj.created_at DESC
    LIMIT 10
  `;
  console.table(jobs);

  console.log('\n=== KIE TASKS STATUS (7 days) ===');
  const kieTasks = await sql`
    SELECT
      kt.status,
      COUNT(*)::int as count
    FROM kie_tasks kt
    WHERE kt.created_at > NOW() - INTERVAL '7 days'
    GROUP BY kt.status
  `;
  console.table(kieTasks);

  console.log('\n=== LATEST KIE TASKS ===');
  const recent = await sql`
    SELECT
      kt.id,
      kt.job_id,
      kt.status,
      kt.prompt_index,
      kt.attempts,
      CASE WHEN kt.result_url IS NOT NULL THEN 'YES' ELSE 'NO' END as has_result,
      kt.created_at::text as created
    FROM kie_tasks kt
    ORDER BY kt.created_at DESC
    LIMIT 15
  `;
  console.table(recent);

  // Check if there are stuck tasks
  console.log('\n=== STUCK PENDING TASKS (>1 hour) ===');
  const stuck = await sql`
    SELECT
      kt.id,
      kt.kie_task_id,
      kt.status,
      kt.attempts,
      kt.created_at::text as created
    FROM kie_tasks kt
    WHERE kt.status = 'pending'
      AND kt.created_at < NOW() - INTERVAL '1 hour'
    ORDER BY kt.created_at DESC
    LIMIT 10
  `;
  console.table(stuck);
}

check().catch(console.error);
