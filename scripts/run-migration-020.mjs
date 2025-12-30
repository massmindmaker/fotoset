#!/usr/bin/env node
/**
 * Run migration 020_admin_actions.sql on production database
 *
 * Usage: node scripts/run-migration-020.mjs
 */

import { neon } from "@neondatabase/serverless"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read migration SQL
const migrationPath = join(__dirname, "migrations", "020_admin_actions.sql")
const migrationSQL = readFileSync(migrationPath, "utf8")

// Get database URL from env
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!databaseUrl) {
  console.error("❌ DATABASE_URL not found in environment")
  process.exit(1)
}

console.log("🔌 Connecting to database...")

const sql = neon(databaseUrl)

try {
  console.log("📝 Running migration 020_admin_actions.sql...")

  // Execute migration using raw query (for multi-statement SQL)
  await sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS admin_actions (
      id SERIAL PRIMARY KEY,
      admin_telegram_id BIGINT NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INTEGER NOT NULL,
      details JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_telegram_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_admin_actions_entity ON admin_actions(entity_type, entity_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC)`,
  ])

  console.log("✅ Migration completed successfully!")

  // Verify table was created
  const result = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'admin_actions'
  `

  if (result.length > 0) {
    console.log("✅ Table 'admin_actions' exists")

    // Check indexes
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'admin_actions'
      ORDER BY indexname
    `

    console.log(`✅ Created ${indexes.length} indexes:`)
    indexes.forEach(idx => console.log(`   - ${idx.indexname}`))
  } else {
    console.error("❌ Table 'admin_actions' was not created")
    process.exit(1)
  }

} catch (error) {
  console.error("❌ Migration failed:", error.message)
  process.exit(1)
}
