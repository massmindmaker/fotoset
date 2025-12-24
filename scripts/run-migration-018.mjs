#!/usr/bin/env node
import { neon } from '@neondatabase/serverless'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

console.log('🚀 Running migration: 018_pending_generation.sql')
console.log('━'.repeat(60))

try {
  // Read SQL file
  const sqlFile = fs.readFileSync(
    path.join(__dirname, 'migrations', '018_pending_generation.sql'),
    'utf-8'
  )

  // Split by semicolon and filter out empty/comment lines
  const statements = sqlFile
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))

  for (const stmt of statements) {
    if (stmt.length > 0) {
      console.log('Executing:', stmt.substring(0, 60) + '...')
      await sql.query(stmt)
      console.log('✓ Done')
    }
  }

  // Verify columns exist
  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name LIKE 'pending_generation%'
  `

  console.log('━'.repeat(60))
  console.log('✅ Migration completed! New columns:', cols.map(c => c.column_name).join(', '))
} catch (error) {
  console.error('\n❌ Migration failed:', error.message)
  process.exit(1)
}
