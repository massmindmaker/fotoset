#!/usr/bin/env node
import { neon } from '@neondatabase/serverless'
import fs from 'fs'
import path from 'path'

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

const migrations = [
  '033_hybrid_auth.sql',
  '034_user_identities.sql',
  '035_withdrawals_cards.sql'
]

async function runMigration(filename) {
  const filepath = path.join(process.cwd(), 'scripts', 'migrations', filename)

  if (!fs.existsSync(filepath)) {
    console.error(`File not found: ${filepath}`)
    return false
  }

  console.log(`\nRunning: ${filename}`)
  console.log('='.repeat(60))

  const content = fs.readFileSync(filepath, 'utf8')

  // Remove comments and split by semicolons
  const cleanContent = content
    .replace(/--[^\n]*\n/g, '\n') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments

  // Split by semicolons, handling DO blocks specially
  const statements = []
  let buffer = ''
  let inDoBlock = false

  for (const line of cleanContent.split('\n')) {
    const trimmed = line.trim()

    if (trimmed.toUpperCase().startsWith('DO $$') || trimmed.toUpperCase().startsWith('DO $')) {
      inDoBlock = true
    }

    buffer += line + '\n'

    if (inDoBlock && trimmed.includes('$$;')) {
      inDoBlock = false
      statements.push(buffer.trim())
      buffer = ''
    } else if (!inDoBlock && trimmed.endsWith(';')) {
      const stmt = buffer.trim()
      if (stmt.length > 1) {
        statements.push(stmt)
      }
      buffer = ''
    }
  }

  // Handle remaining buffer
  if (buffer.trim().length > 0) {
    statements.push(buffer.trim())
  }

  for (const statement of statements) {
    const trimmed = statement.trim()

    // Skip empty, BEGIN, COMMIT, and pure whitespace
    if (!trimmed ||
        trimmed === ';' ||
        trimmed.toUpperCase() === 'BEGIN;' ||
        trimmed.toUpperCase() === 'COMMIT;' ||
        trimmed.toUpperCase() === 'BEGIN' ||
        trimmed.toUpperCase() === 'COMMIT') {
      continue
    }

    try {
      await sql.query(trimmed)

      // Show first 70 chars of statement
      const preview = trimmed.replace(/\s+/g, ' ').substring(0, 70)
      console.log(`OK: ${preview}...`)
    } catch (error) {
      // Ignore "already exists" errors
      if (error.message.includes('already exists') ||
          error.message.includes('duplicate key') ||
          error.message.includes('column') && error.message.includes('does not exist') ||
          error.message.includes('constraint') && error.message.includes('does not exist') ||
          error.message.includes('relation') && error.message.includes('does not exist')) {
        const preview = trimmed.replace(/\s+/g, ' ').substring(0, 50)
        console.log(`SKIP: ${preview}... (${error.message.substring(0, 40)})`)
      } else {
        console.error(`\nERROR: ${error.message}`)
        console.error(`Statement:\n${trimmed.substring(0, 300)}`)
        return false
      }
    }
  }

  console.log(`Completed: ${filename}`)
  return true
}

async function main() {
  console.log('Starting migrations 033-035')
  console.log('Database:', DATABASE_URL.split('@')[1]?.split('/')[0] || 'connected')

  for (const migration of migrations) {
    const success = await runMigration(migration)
    if (!success) {
      console.error(`\nMigration failed at: ${migration}`)
      process.exit(1)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('All migrations completed!')

  // Verification
  console.log('\nVerification:')

  try {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('link_tokens', 'user_identities', 'partner_applications', 'user_cards', 'withdrawals', 'withdrawal_logs')
      ORDER BY table_name
    `
    console.log('New tables:', tables.map(t => t.table_name).join(', ') || 'none')

    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('email', 'neon_auth_id', 'auth_provider', 'name', 'avatar_url')
      ORDER BY column_name
    `
    console.log('New user columns:', columns.map(c => c.column_name).join(', ') || 'none')

    const userCount = await sql`SELECT COUNT(*) as count FROM users`
    const identityCount = await sql`SELECT COUNT(*) as count FROM user_identities`

    console.log(`\nUsers: ${userCount[0].count}, Identities: ${identityCount[0].count}`)
  } catch (e) {
    console.log('Verification error:', e.message)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
