import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

async function runMigration() {
  console.log('Running migration 037_qstash_idempotency...');

  try {
    // Create qstash_processed_messages table
    await sql`
      CREATE TABLE IF NOT EXISTS qstash_processed_messages (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(255) NOT NULL UNIQUE,
        endpoint VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        response_status INTEGER,
        metadata JSONB
      )
    `;
    console.log('✓ Created qstash_processed_messages table');

    // Index for fast lookups by message_id
    await sql`
      CREATE INDEX IF NOT EXISTS idx_qstash_message_id
      ON qstash_processed_messages(message_id)
    `;
    console.log('✓ Created idx_qstash_message_id index');

    // Index for cleanup of old records
    await sql`
      CREATE INDEX IF NOT EXISTS idx_qstash_processed_at
      ON qstash_processed_messages(processed_at)
    `;
    console.log('✓ Created idx_qstash_processed_at index');

    // Add comment
    await sql`
      COMMENT ON TABLE qstash_processed_messages IS 'Idempotency tracking for QStash webhook processing'
    `;
    console.log('✓ Added table comment');

    console.log('\n✅ Migration 037 completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
