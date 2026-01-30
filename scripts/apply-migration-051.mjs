// Apply migration 051: Add endpoint column to qstash_processed_messages
import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function applyMigration() {
  console.log('Applying migration 051_qstash_add_endpoint.sql...\n')

  try {
    // 1. Add endpoint column
    console.log('Adding endpoint column...')
    await sql`
      ALTER TABLE qstash_processed_messages
      ADD COLUMN IF NOT EXISTS endpoint VARCHAR(255)
    `
    console.log('  ✓ endpoint column added')

    // 2. Add job_id column
    console.log('Adding job_id column...')
    await sql`
      ALTER TABLE qstash_processed_messages
      ADD COLUMN IF NOT EXISTS job_id INTEGER
    `
    console.log('  ✓ job_id column added')

    // 3. Add response_status column
    console.log('Adding response_status column...')
    await sql`
      ALTER TABLE qstash_processed_messages
      ADD COLUMN IF NOT EXISTS response_status INTEGER
    `
    console.log('  ✓ response_status column added')

    // 4. Add metadata column
    console.log('Adding metadata column...')
    await sql`
      ALTER TABLE qstash_processed_messages
      ADD COLUMN IF NOT EXISTS metadata JSONB
    `
    console.log('  ✓ metadata column added')

    // 5. Add indexes
    console.log('Adding indexes...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_qstash_endpoint ON qstash_processed_messages(endpoint)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_qstash_job_id ON qstash_processed_messages(job_id)
    `
    console.log('  ✓ indexes created')

    // Verify columns exist
    console.log('\nVerifying columns...')
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'qstash_processed_messages'
      ORDER BY ordinal_position
    `
    console.log('Columns in qstash_processed_messages:')
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
    })

    console.log('\n✓ Migration 051 applied successfully!')
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message)
    process.exit(1)
  }
}

applyMigration()
