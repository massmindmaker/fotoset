/**
 * Create Admin User Script
 *
 * Creates a super_admin user with email/password auth
 *
 * Usage: node scripts/create-admin.mjs
 */

import { neon } from '@neondatabase/serverless'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env.production' })

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

// Admin credentials
const ADMIN_EMAIL = 'massmindmaker@gmail.com'
// Pre-hashed password for 'Recycleb11235n'
const PASSWORD_HASH = '$2b$10$NZzni/IwkYG5J21xq4HCmuYiJECPv3CKhbqG8.m2sjPk7vKDaNub.'
const ROLE = 'super_admin'

async function createAdmin() {
  console.log('🔧 Creating admin user...\n')

  try {
    // Check if admin already exists
    const existing = await sql`
      SELECT id, email, role FROM admin_users WHERE email = ${ADMIN_EMAIL}
    `

    if (existing.length > 0) {
      console.log(`⚠️  Admin already exists:`)
      console.log(`   ID: ${existing[0].id}`)
      console.log(`   Email: ${existing[0].email}`)
      console.log(`   Role: ${existing[0].role}`)

      // Update password and role if needed
      await sql`
        UPDATE admin_users
        SET
          password_hash = ${PASSWORD_HASH},
          role = ${ROLE},
          is_active = true,
          updated_at = NOW()
        WHERE email = ${ADMIN_EMAIL}
      `
      console.log(`\n✅ Updated password and role to ${ROLE}`)
      return
    }

    // Create new admin
    const [newAdmin] = await sql`
      INSERT INTO admin_users (
        email,
        password_hash,
        role,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        ${ADMIN_EMAIL},
        ${PASSWORD_HASH},
        ${ROLE},
        true,
        NOW(),
        NOW()
      )
      RETURNING id, email, role
    `

    console.log(`✅ Admin created successfully:`)
    console.log(`   ID: ${newAdmin.id}`)
    console.log(`   Email: ${newAdmin.email}`)
    console.log(`   Role: ${newAdmin.role}`)

  } catch (error) {
    console.error('❌ Error creating admin:', error)
    process.exit(1)
  }
}

createAdmin()
