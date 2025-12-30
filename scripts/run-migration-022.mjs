/**
 * Run migration 022: Admin Panel Features
 * Usage: node scripts/run-migration-022.mjs
 */

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set')
    process.exit(1)
  }

  const sql = neon(databaseUrl)

  console.log('Starting migration 022: Admin Panel Features...')

  try {
    // Read migration SQL
    const migrationPath = join(__dirname, 'migrations', '022_admin_features.sql')
    const migrationSql = readFileSync(migrationPath, 'utf-8')

    // Split by statements and execute
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 60) + '...')
        await sql.unsafe(statement)
      }
    }

    console.log('Migration 022 completed successfully!')

    // Verify tables created
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('saved_prompts', 'photo_packs', 'pack_items', 'promo_codes', 'promo_code_usages', 'admin_settings')
    `

    console.log('Created/verified tables:', tables.map(t => t.table_name).join(', '))

    // Check if telegram_username column exists
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'telegram_username'
    `

    if (columns.length > 0) {
      console.log('telegram_username column added to users table')
    }

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
