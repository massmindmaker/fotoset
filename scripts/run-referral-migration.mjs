import { neon } from "@neondatabase/serverless"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)

  const migrationPath = join(__dirname, "migrations", "004_add_referrals.sql")
  const migration = readFileSync(migrationPath, "utf-8")

  console.log("Running referral migration...")

  try {
    // Split migration into separate statements and run each
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const stmt of statements) {
      await sql.query(stmt)
      console.log("✓ Executed:", stmt.substring(0, 50) + "...")
    }

    console.log("✅ Referral tables created successfully!")
  } catch (error) {
    console.error("❌ Migration failed:", error.message)
    process.exit(1)
  }
}

runMigration()
