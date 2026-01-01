import { neon } from '@neondatabase/serverless';

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    console.error('DATABASE_URL or DATABASE_URL_UNPOOLED is not set');
    process.exit(1);
  }

  const sql = neon(connectionString);

  console.log('Running migration 025: create_preview_tasks_table\n');

  const statements = [
    {
      name: 'Create preview_tasks table',
      sql: `
        CREATE TABLE IF NOT EXISTS preview_tasks (
          id SERIAL PRIMARY KEY,
          prompt_id INTEGER UNIQUE NOT NULL REFERENCES saved_prompts(id) ON DELETE CASCADE,
          kie_task_id VARCHAR(255) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP
        )
      `
    },
    {
      name: 'Create index on status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_preview_tasks_status ON preview_tasks(status)'
    },
    {
      name: 'Create index on kie_task_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_preview_tasks_kie_task_id ON preview_tasks(kie_task_id)'
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

  console.log('Migration 025 completed!');
}

runMigration().catch(console.error);
