import { neon } from '@neondatabase/serverless';

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    console.error('DATABASE_URL or DATABASE_URL_UNPOOLED is not set');
    process.exit(1);
  }

  const sql = neon(connectionString);

  console.log('Running migration 023: pack_items_prompt_link\n');

  const statements = [
    { name: 'Add prompt_id column', sql: 'ALTER TABLE pack_items ADD COLUMN IF NOT EXISTS prompt_id INTEGER REFERENCES saved_prompts(id) ON DELETE SET NULL' },
    { name: 'Add display_order column', sql: 'ALTER TABLE pack_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0' },
    { name: 'Create prompt index', sql: 'CREATE INDEX IF NOT EXISTS idx_pack_items_prompt ON pack_items(prompt_id)' },
    { name: 'Make photo_url nullable', sql: 'ALTER TABLE pack_items ALTER COLUMN photo_url DROP NOT NULL' },
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

  console.log('Migration 023 completed!');
}

runMigration().catch(console.error);
