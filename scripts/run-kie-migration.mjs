#!/usr/bin/env node

// Run SQL migration for kie_tasks table
// Usage: node scripts/run-kie-migration.mjs

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function runMigration() {
  console.log('Creating kie_tasks table...');

  try {
    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS kie_tasks (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES generation_jobs(id),
        avatar_id INTEGER REFERENCES avatars(id),
        kie_task_id VARCHAR(255) NOT NULL,
        prompt_index INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        result_url TEXT,
        error_message TEXT,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✓ Table created');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_kie_tasks_status ON kie_tasks(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_kie_tasks_job_id ON kie_tasks(job_id)`;
    console.log('✓ Indexes created');

    // Verify
    const result = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'kie_tasks'
    `;
    console.log('✓ Columns:', result.map(r => r.column_name).join(', '));

    console.log('\nMigration complete!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
