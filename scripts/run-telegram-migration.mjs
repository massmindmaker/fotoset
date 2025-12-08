import { neon } from "@neondatabase/serverless"

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

const sql = neon(DATABASE_URL)

async function runTelegramMigration() {
  console.log("Running migration 003_add_telegram...")

  try {
    // Create telegram_sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        telegram_chat_id BIGINT UNIQUE NOT NULL,
        telegram_username VARCHAR(255),
        linked_at TIMESTAMP DEFAULT NOW(),
        last_activity TIMESTAMP DEFAULT NOW()
      )
    `
    console.log("✓ Created telegram_sessions table")

    // Create indexes for telegram_sessions
    await sql`CREATE INDEX IF NOT EXISTS idx_telegram_sessions_chat_id ON telegram_sessions(telegram_chat_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_telegram_sessions_user_id ON telegram_sessions(user_id)`
    console.log("✓ Created indexes for telegram_sessions")

    // Create telegram_link_codes table
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_link_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(8) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log("✓ Created telegram_link_codes table")

    // Create indexes for telegram_link_codes
    await sql`CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code ON telegram_link_codes(code)`
    await sql`CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires ON telegram_link_codes(expires_at)`
    console.log("✓ Created indexes for telegram_link_codes")

    // Create telegram_message_queue table
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_message_queue (
        id SERIAL PRIMARY KEY,
        telegram_chat_id BIGINT NOT NULL,
        message_type VARCHAR(20) NOT NULL DEFAULT 'photo',
        photo_url TEXT,
        caption TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        sent_at TIMESTAMP
      )
    `
    console.log("✓ Created telegram_message_queue table")

    // Create indexes for telegram_message_queue
    await sql`CREATE INDEX IF NOT EXISTS idx_telegram_queue_status ON telegram_message_queue(status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_telegram_queue_chat_id ON telegram_message_queue(telegram_chat_id)`
    console.log("✓ Created indexes for telegram_message_queue")

    console.log("\n✅ Telegram migration completed successfully!")

  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  }
}

runTelegramMigration()
