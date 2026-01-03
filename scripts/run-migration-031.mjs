#!/usr/bin/env node

/**
 * Migration 031: QStash Idempotency Table
 * - Creates table for tracking processed QStash messages
 * - Prevents duplicate execution of generation jobs
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('Running migration 031: QStash Idempotency Table...\n');

  try {
    // Step 1: Create qstash_processed_messages table
    console.log('1. Creating qstash_processed_messages table...');
    await sql`
      CREATE TABLE IF NOT EXISTS qstash_processed_messages (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(255) UNIQUE NOT NULL,
        job_id INTEGER,
        processed_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   ✓ Table created\n');

    // Step 2: Add index for cleanup (auto-delete old messages)
    console.log('2. Adding cleanup index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_qstash_processed_cleanup
      ON qstash_processed_messages (created_at)
    `;
    console.log('   ✓ Index created\n');

    // Step 3: Add comment
    console.log('3. Adding table comment...');
    await sql`COMMENT ON TABLE qstash_processed_messages IS 'Stores processed QStash message IDs for idempotency (prevent duplicate job execution)'`;
    console.log('   ✓ Comment added\n');

    // Step 4: Create Dead Letter Queue table for failed tasks
    console.log('4. Creating generation_dead_letter_queue table...');
    await sql`
      CREATE TABLE IF NOT EXISTS generation_dead_letter_queue (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES generation_jobs(id),
        avatar_id INTEGER REFERENCES avatars(id),
        kie_task_id VARCHAR(255),
        prompt_index INTEGER,
        prompt TEXT,
        result_url TEXT,
        error_message TEXT,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        last_attempt_at TIMESTAMP DEFAULT NOW(),
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP,
        resolved_by VARCHAR(255)
      )
    `;
    console.log('   ✓ DLQ table created\n');

    // Step 5: Add DLQ indexes
    console.log('5. Adding DLQ indexes...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_dlq_unresolved
      ON generation_dead_letter_queue (created_at DESC)
      WHERE resolved = FALSE
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_dlq_job
      ON generation_dead_letter_queue (job_id)
    `;
    console.log('   ✓ Indexes created\n');

    // Verify migration
    console.log('6. Verifying migration...');

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('qstash_processed_messages', 'generation_dead_letter_queue')
    `;

    console.log('   Tables created:', tables.map(t => t.table_name).join(', '));

    console.log('\n✅ Migration 031 completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
