import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

async function runMigration() {
  console.log('Running migration 036_add_telegram_broadcasts...');

  try {
    // Create broadcasts table
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_broadcasts (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        photo_url TEXT,
        parse_mode VARCHAR(20) DEFAULT 'HTML',
        target_type VARCHAR(20) NOT NULL,
        target_count INTEGER DEFAULT 0,
        queued_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `;
    console.log('✓ Created telegram_broadcasts table');

    // Add broadcast_id column to telegram_message_queue
    await sql`
      ALTER TABLE telegram_message_queue
      ADD COLUMN IF NOT EXISTS broadcast_id INTEGER REFERENCES telegram_broadcasts(id)
    `;
    console.log('✓ Added broadcast_id column to telegram_message_queue');

    // Create index for broadcast lookup
    await sql`
      CREATE INDEX IF NOT EXISTS idx_telegram_message_queue_broadcast
      ON telegram_message_queue(broadcast_id) WHERE broadcast_id IS NOT NULL
    `;
    console.log('✓ Created idx_telegram_message_queue_broadcast index');

    // Create index for broadcasts by status
    await sql`
      CREATE INDEX IF NOT EXISTS idx_telegram_broadcasts_status
      ON telegram_broadcasts(status, created_at DESC)
    `;
    console.log('✓ Created idx_telegram_broadcasts_status index');

    console.log('\n✅ Migration 036 completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
