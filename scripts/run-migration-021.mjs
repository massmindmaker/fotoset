#!/usr/bin/env node
/**
 * Migration 021: Admin Panel Authentication
 *
 * Creates tables for:
 * - admin_users: Admin accounts with email/password and Google OAuth
 * - admin_sessions: JWT session tokens
 * - admin_activity_log: Audit log for admin actions
 * - admin_settings: Dynamic settings including pricing tiers
 * - admin_notifications: Admin notification center
 *
 * Also adds ban columns to users table
 */

import { neon } from '@neondatabase/serverless'

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env.production' })

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED

if (!DATABASE_URL) {
  console.error('\x1b[31m%s\x1b[0m', 'DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

console.log('\x1b[36m%s\x1b[0m', '='.repeat(60))
console.log('\x1b[36m%s\x1b[0m', '  Migration 021: Admin Panel Authentication')
console.log('\x1b[36m%s\x1b[0m', '='.repeat(60))

try {
  // ============================================
  // 1. Create admin_users table
  // ============================================
  console.log('\n\x1b[33m[1/7]\x1b[0m Creating admin_users table...')

  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      google_id VARCHAR(255) UNIQUE,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      avatar_url TEXT,
      role VARCHAR(50) DEFAULT 'viewer',
      is_active BOOLEAN DEFAULT true,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)`
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_users_google ON admin_users(google_id)`

  console.log('\x1b[32m%s\x1b[0m', '   admin_users table created')

  // ============================================
  // 2. Create admin_sessions table
  // ============================================
  console.log('\n\x1b[33m[2/7]\x1b[0m Creating admin_sessions table...')

  await sql`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
      session_token VARCHAR(255) NOT NULL UNIQUE,
      ip_address VARCHAR(45),
      user_agent TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token)`
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at)`

  console.log('\x1b[32m%s\x1b[0m', '   admin_sessions table created')

  // ============================================
  // 3. Create admin_activity_log table
  // ============================================
  console.log('\n\x1b[33m[3/7]\x1b[0m Creating admin_activity_log table...')

  await sql`
    CREATE TABLE IF NOT EXISTS admin_activity_log (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES admin_users(id),
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(50),
      target_id INTEGER,
      metadata JSONB,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity_log(created_at DESC)`

  console.log('\x1b[32m%s\x1b[0m', '   admin_activity_log table created')

  // ============================================
  // 4. Create admin_settings table
  // ============================================
  console.log('\n\x1b[33m[4/7]\x1b[0m Creating admin_settings table...')

  await sql`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_by INTEGER REFERENCES admin_users(id),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Insert default pricing tiers
  await sql`
    INSERT INTO admin_settings (key, value) VALUES
    ('pricing_tiers', ${JSON.stringify({
      starter: { name: "Starter", price: 499, photoCount: 7, isActive: true },
      standard: { name: "Standard", price: 999, photoCount: 15, isActive: true, isPopular: true },
      premium: { name: "Premium", price: 1499, photoCount: 23, isActive: true }
    })})
    ON CONFLICT (key) DO NOTHING
  `

  await sql`
    INSERT INTO admin_settings (key, value) VALUES
    ('feature_flags', ${JSON.stringify({
      referral_enabled: true,
      telegram_notifications: true,
      maintenance_mode: false
    })})
    ON CONFLICT (key) DO NOTHING
  `

  await sql`
    INSERT INTO admin_settings (key, value) VALUES
    ('maintenance', ${JSON.stringify({
      enabled: false,
      message: "Сайт временно недоступен",
      estimatedEnd: null
    })})
    ON CONFLICT (key) DO NOTHING
  `

  console.log('\x1b[32m%s\x1b[0m', '   admin_settings table created with defaults')

  // ============================================
  // 5. Create admin_notifications table
  // ============================================
  console.log('\n\x1b[33m[5/7]\x1b[0m Creating admin_notifications table...')

  await sql`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      metadata JSONB,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_admin_notif_unread ON admin_notifications(is_read) WHERE is_read = false`
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_notif_created ON admin_notifications(created_at DESC)`

  console.log('\x1b[32m%s\x1b[0m', '   admin_notifications table created')

  // ============================================
  // 6. Add ban columns to users table
  // ============================================
  console.log('\n\x1b[33m[6/7]\x1b[0m Adding ban columns to users table...')

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by INTEGER`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT`

  console.log('\x1b[32m%s\x1b[0m', '   Ban columns added to users')

  // ============================================
  // 7. Create telegram_message_queue if not exists
  // ============================================
  console.log('\n\x1b[33m[7/7]\x1b[0m Creating telegram_message_queue table...')

  await sql`
    CREATE TABLE IF NOT EXISTS telegram_message_queue (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      message_type VARCHAR(50),
      payload JSONB,
      status VARCHAR(20) DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      sent_at TIMESTAMP
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_tg_queue_status ON telegram_message_queue(status)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tg_queue_user ON telegram_message_queue(user_id)`

  console.log('\x1b[32m%s\x1b[0m', '   telegram_message_queue table created')

  // ============================================
  // Verification
  // ============================================
  console.log('\n\x1b[36m%s\x1b[0m', '-'.repeat(60))
  console.log('\x1b[33m%s\x1b[0m', 'Verifying migration...')

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('admin_users', 'admin_sessions', 'admin_activity_log', 'admin_settings', 'admin_notifications', 'telegram_message_queue')
    ORDER BY table_name
  `

  console.log('\x1b[32m%s\x1b[0m', `   Created tables: ${tables.map(t => t.table_name).join(', ')}`)

  // Check users table columns
  const userColumns = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name IN ('is_banned', 'banned_at', 'banned_by', 'ban_reason')
  `
  console.log('\x1b[32m%s\x1b[0m', `   Users ban columns: ${userColumns.map(c => c.column_name).join(', ')}`)

  console.log('\n\x1b[36m%s\x1b[0m', '='.repeat(60))
  console.log('\x1b[32m%s\x1b[0m', '  Migration 021 completed successfully!')
  console.log('\x1b[36m%s\x1b[0m', '='.repeat(60))

  console.log('\n\x1b[33m%s\x1b[0m', 'Next steps:')
  console.log('1. Set ADMIN_SESSION_SECRET in environment')
  console.log('2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for OAuth')
  console.log('3. Set ADMIN_SUPER_EMAIL for first super admin')
  console.log('4. Deploy and access /admin/login')

} catch (error) {
  console.error('\n\x1b[31m%s\x1b[0m', 'Migration failed:', error.message)
  console.error(error)
  process.exit(1)
}
