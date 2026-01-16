import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function check() {
  // Check failed kie_tasks details
  console.log('=== FAILED KIE TASKS (job 55) ===');
  const failed = await sql`
    SELECT
      kt.id,
      kt.kie_task_id,
      kt.status,
      kt.prompt_index,
      kt.error_message,
      kt.created_at::text as created
    FROM kie_tasks kt
    WHERE kt.job_id = 55
    ORDER BY kt.prompt_index
  `;
  console.table(failed);

  // Check generated_photos for job 55
  console.log('\n=== GENERATED PHOTOS (job 55) ===');
  const photos = await sql`
    SELECT
      gp.id,
      gp.style_id,
      gp.prompt_index,
      gp.status,
      CASE WHEN gp.image_url IS NOT NULL THEN LEFT(gp.image_url, 50) || '...' ELSE 'NULL' END as image_url,
      gp.created_at::text as created
    FROM generated_photos gp
    JOIN avatars a ON gp.avatar_id = a.id
    JOIN generation_jobs gj ON gj.avatar_id = a.id
    WHERE gj.id = 55
    ORDER BY gp.prompt_index
    LIMIT 10
  `;
  console.table(photos);

  // Check avatar and payment status for job 55
  console.log('\n=== JOB 55 CONTEXT ===');
  const context = await sql`
    SELECT
      gj.id as job_id,
      gj.status as job_status,
      a.id as avatar_id,
      a.name as avatar_name,
      a.status as avatar_status,
      u.id as user_id,
      u.telegram_user_id
    FROM generation_jobs gj
    JOIN avatars a ON gj.avatar_id = a.id
    JOIN users u ON a.user_id = u.id
    WHERE gj.id = 55
  `;
  console.table(context);
}

check().catch(console.error);
