import { neon } from '@neondatabase/serverless';

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    console.error('DATABASE_URL or DATABASE_URL_UNPOOLED is not set');
    process.exit(1);
  }

  const sql = neon(connectionString);

  console.log('Running migration 024: fix_kie_tasks_cascade\n');

  const statements = [
    {
      name: 'Drop kie_tasks.avatar_id FK',
      sql: 'ALTER TABLE kie_tasks DROP CONSTRAINT IF EXISTS kie_tasks_avatar_id_fkey'
    },
    {
      name: 'Add kie_tasks.avatar_id FK with CASCADE',
      sql: 'ALTER TABLE kie_tasks ADD CONSTRAINT kie_tasks_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE'
    },
    {
      name: 'Drop kie_tasks.job_id FK',
      sql: 'ALTER TABLE kie_tasks DROP CONSTRAINT IF EXISTS kie_tasks_job_id_fkey'
    },
    {
      name: 'Add kie_tasks.job_id FK with CASCADE',
      sql: 'ALTER TABLE kie_tasks ADD CONSTRAINT kie_tasks_job_id_fkey FOREIGN KEY (job_id) REFERENCES generation_jobs(id) ON DELETE CASCADE'
    },
  ];

  for (const stmt of statements) {
    console.log(`Executing: ${stmt.name}`);
    try {
      await sql.query(stmt.sql);
      console.log('  OK\n');
    } catch (error) {
      console.error(`  Error: ${error.message}\n`);
    }
  }

  console.log('Migration 024 completed!');
}

runMigration().catch(console.error);
