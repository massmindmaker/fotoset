import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
  // Last 2 jobs
  const jobs = await sql`
    SELECT gj.id, gj.avatar_id, gj.style_id, gj.status, gj.total_photos, gj.completed_photos, gj.error_message, gj.created_at, gj.updated_at
    FROM generation_jobs gj
    ORDER BY gj.created_at DESC
    LIMIT 2
  `;

  console.log('=== ПОСЛЕДНИЕ 2 ГЕНЕРАЦИИ ===\n');

  for (const job of jobs) {
    console.log('--- JOB #' + job.id + ' ---');
    console.log('Avatar ID:', job.avatar_id);
    console.log('Style:', job.style_id);
    console.log('Status:', job.status);
    console.log('Photos:', job.completed_photos + '/' + job.total_photos);
    console.log('Error:', job.error_message || 'none');
    console.log('Created:', job.created_at);
    console.log('Updated:', job.updated_at);

    // Kie tasks stats
    const tasks = await sql`
      SELECT status, COUNT(*)::int as count
      FROM kie_tasks
      WHERE job_id = ${job.id}
      GROUP BY status
    `;
    console.log('\nKie tasks по статусам:');
    for (const t of tasks) {
      console.log('  ' + t.status + ':', t.count);
    }

    // Failed tasks details
    const failed = await sql`
      SELECT prompt_index, error_message FROM kie_tasks
      WHERE job_id = ${job.id} AND status = 'failed'
      ORDER BY prompt_index
    `;
    if (failed.length > 0) {
      console.log('\nОшибки:');
      for (const f of failed) {
        console.log('  Prompt #' + f.prompt_index + ':', f.error_message);
      }
    }

    // Generated photos count for this avatar
    const photos = await sql`
      SELECT COUNT(*)::int as count FROM generated_photos
      WHERE avatar_id = ${job.avatar_id}
    `;
    console.log('\nВсего фото для аватара:', photos[0].count);
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

main().catch(console.error);
