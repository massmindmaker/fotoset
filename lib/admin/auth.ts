/**
 * Admin Authentication
 *
 * Email/Password + Google OAuth authentication system
 * Replaces old Telegram whitelist-based auth
 */

import bcrypt from 'bcryptjs'
import { neon } from '@neondatabase/serverless'
import type { AdminRole } from './permissions'

export interface AdminUser {
  id: number
  email: string
  passwordHash: string | null
  googleId: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  role: AdminRole
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAdminInput {
  email: string
  password?: string
  googleId?: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
  role?: AdminRole
}

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

/**
 * Get super admin email from environment
 */
export function getSuperAdminEmail(): string | null {
  return process.env.ADMIN_SUPER_EMAIL || null
}

/**
 * Find admin by email
 */
export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const sql = getSql()

  const [admin] = await sql`
    SELECT
      id,
      email,
      password_hash,
      google_id,
      first_name,
      last_name,
      avatar_url,
      role,
      is_active,
      last_login_at,
      created_at,
      updated_at
    FROM admin_users
    WHERE email = ${email.toLowerCase()}
    LIMIT 1
  `

  if (!admin) return null

  return mapAdminFromDb(admin)
}

/**
 * Find admin by Google ID
 */
export async function findAdminByGoogleId(googleId: string): Promise<AdminUser | null> {
  const sql = getSql()

  const [admin] = await sql`
    SELECT
      id,
      email,
      password_hash,
      google_id,
      first_name,
      last_name,
      avatar_url,
      role,
      is_active,
      last_login_at,
      created_at,
      updated_at
    FROM admin_users
    WHERE google_id = ${googleId}
    LIMIT 1
  `

  if (!admin) return null

  return mapAdminFromDb(admin)
}

/**
 * Find admin by ID
 */
export async function findAdminById(id: number): Promise<AdminUser | null> {
  const sql = getSql()

  const [admin] = await sql`
    SELECT
      id,
      email,
      password_hash,
      google_id,
      first_name,
      last_name,
      avatar_url,
      role,
      is_active,
      last_login_at,
      created_at,
      updated_at
    FROM admin_users
    WHERE id = ${id}
    LIMIT 1
  `

  if (!admin) return null

  return mapAdminFromDb(admin)
}

/**
 * Create a new admin user
 */
export async function createAdmin(input: CreateAdminInput): Promise<AdminUser> {
  const sql = getSql()

  const email = input.email.toLowerCase()
  const superEmail = getSuperAdminEmail()?.toLowerCase()

  // First user with super admin email gets super_admin role
  const isSuperAdmin = superEmail && email === superEmail
  const role = isSuperAdmin ? 'super_admin' : (input.role || 'viewer')

  let passwordHash: string | null = null
  if (input.password) {
    passwordHash = await bcrypt.hash(input.password, 12)
  }

  const [admin] = await sql`
    INSERT INTO admin_users (
      email,
      password_hash,
      google_id,
      first_name,
      last_name,
      avatar_url,
      role
    )
    VALUES (
      ${email},
      ${passwordHash},
      ${input.googleId || null},
      ${input.firstName || null},
      ${input.lastName || null},
      ${input.avatarUrl || null},
      ${role}
    )
    RETURNING
      id,
      email,
      password_hash,
      google_id,
      first_name,
      last_name,
      avatar_url,
      role,
      is_active,
      last_login_at,
      created_at,
      updated_at
  `

  return mapAdminFromDb(admin)
}

/**
 * Update admin user
 */
export async function updateAdmin(
  id: number,
  updates: {
    firstName?: string
    lastName?: string
    avatarUrl?: string
    googleId?: string
    role?: AdminRole
    isActive?: boolean
    password?: string
  }
): Promise<AdminUser | null> {
  const sql = getSql()

  let passwordHash: string | undefined
  if (updates.password) {
    passwordHash = await bcrypt.hash(updates.password, 12)
  }

  const [admin] = await sql`
    UPDATE admin_users
    SET
      first_name = COALESCE(${updates.firstName ?? null}, first_name),
      last_name = COALESCE(${updates.lastName ?? null}, last_name),
      avatar_url = COALESCE(${updates.avatarUrl ?? null}, avatar_url),
      google_id = COALESCE(${updates.googleId ?? null}, google_id),
      role = COALESCE(${updates.role ?? null}, role),
      is_active = COALESCE(${updates.isActive ?? null}, is_active),
      password_hash = COALESCE(${passwordHash ?? null}, password_hash),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id,
      email,
      password_hash,
      google_id,
      first_name,
      last_name,
      avatar_url,
      role,
      is_active,
      last_login_at,
      created_at,
      updated_at
  `

  if (!admin) return null

  return mapAdminFromDb(admin)
}

/**
 * Verify password for email login
 */
export async function verifyPassword(email: string, password: string): Promise<AdminUser | null> {
  const admin = await findAdminByEmail(email)

  if (!admin) {
    return null
  }

  if (!admin.passwordHash) {
    // Admin uses OAuth only
    return null
  }

  if (!admin.isActive) {
    return null
  }

  const isValid = await bcrypt.compare(password, admin.passwordHash)

  if (!isValid) {
    return null
  }

  return admin
}

/**
 * Find or create admin from Google OAuth
 */
export async function findOrCreateGoogleAdmin(profile: {
  googleId: string
  email: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
}): Promise<{ admin: AdminUser; isNew: boolean }> {
  // First check by Google ID
  let admin = await findAdminByGoogleId(profile.googleId)
  if (admin) {
    // Update profile info if changed
    if (profile.avatarUrl && profile.avatarUrl !== admin.avatarUrl) {
      admin = await updateAdmin(admin.id, { avatarUrl: profile.avatarUrl }) || admin
    }
    return { admin, isNew: false }
  }

  // Check by email
  admin = await findAdminByEmail(profile.email)
  if (admin) {
    // Link Google account
    admin = await updateAdmin(admin.id, {
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl
    }) || admin
    return { admin, isNew: false }
  }

  // Check if email is allowed (super admin or needs manual creation)
  const superEmail = getSuperAdminEmail()?.toLowerCase()
  if (!superEmail || profile.email.toLowerCase() !== superEmail) {
    // For non-super-admin, check if registration is allowed
    // Default: only allow if ADMIN_ALLOW_GOOGLE_REGISTRATION is true
    const allowRegistration = process.env.ADMIN_ALLOW_GOOGLE_REGISTRATION === 'true'
    if (!allowRegistration) {
      throw new Error('ADMIN_NOT_ALLOWED')
    }
  }

  // Create new admin
  admin = await createAdmin({
    email: profile.email,
    googleId: profile.googleId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    avatarUrl: profile.avatarUrl
  })

  return { admin, isNew: true }
}

/**
 * Get all admin users
 */
export async function getAllAdmins(): Promise<AdminUser[]> {
  const sql = getSql()

  const admins = await sql`
    SELECT
      id,
      email,
      password_hash,
      google_id,
      first_name,
      last_name,
      avatar_url,
      role,
      is_active,
      last_login_at,
      created_at,
      updated_at
    FROM admin_users
    ORDER BY created_at ASC
  `

  return admins.map(mapAdminFromDb)
}

/**
 * Delete admin user (soft delete - set is_active = false)
 */
export async function deactivateAdmin(id: number): Promise<void> {
  const sql = getSql()

  await sql`
    UPDATE admin_users
    SET is_active = false, updated_at = NOW()
    WHERE id = ${id}
  `
}

/**
 * Map database row to AdminUser
 */
function mapAdminFromDb(row: Record<string, unknown>): AdminUser {
  return {
    id: row.id as number,
    email: row.email as string,
    passwordHash: row.password_hash as string | null,
    googleId: row.google_id as string | null,
    firstName: row.first_name as string | null,
    lastName: row.last_name as string | null,
    avatarUrl: row.avatar_url as string | null,
    role: row.role as AdminRole,
    isActive: row.is_active as boolean,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string)
  }
}
