import bcrypt from 'bcryptjs'
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

// Load from .env.local (Vercel standard)
config({ path: '.env.local' })

const TEST_EMAIL = 'test@admin.local'
const TEST_PASSWORD = 'TestAdmin123!'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(databaseUrl)

console.log('Creating test superadmin...')
console.log(`Email: ${TEST_EMAIL}`)
console.log(`Password: ${TEST_PASSWORD}`)

const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12)
console.log(`\nGenerated hash: ${passwordHash}`)

const [admin] = await sql`
  INSERT INTO admin_users (
    email,
    password_hash,
    first_name,
    last_name,
    role,
    is_active
  )
  VALUES (
    ${TEST_EMAIL},
    ${passwordHash},
    'Test',
    'Superadmin',
    'super_admin',
    true
  )
  ON CONFLICT (email) DO UPDATE
  SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = true,
    updated_at = NOW()
  RETURNING id, email, role, is_active, created_at
`

console.log('\n✅ Test superadmin created successfully!')
console.log('─'.repeat(40))
console.log(`ID: ${admin.id}`)
console.log(`Email: ${admin.email}`)
console.log(`Role: ${admin.role}`)
console.log(`Active: ${admin.is_active}`)
console.log(`Created: ${admin.created_at}`)
console.log('─'.repeat(40))
console.log('\nYou can now login at /admin with:')
console.log(`  Email: ${TEST_EMAIL}`)
console.log(`  Password: ${TEST_PASSWORD}`)
