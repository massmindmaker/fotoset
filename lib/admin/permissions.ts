/**
 * Admin Role-Based Permissions
 */

export type AdminRole = 'super_admin' | 'admin' | 'viewer'

export type AdminAction =
  // User actions
  | 'users.view'
  | 'users.edit'
  | 'users.ban'
  | 'users.grant_pro'
  | 'users.message'
  | 'users.regenerate'
  // Payment actions
  | 'payments.view'
  | 'payments.refund'
  | 'payments.export'
  // Generation actions
  | 'generations.view'
  | 'generations.retry'
  // Referral actions
  | 'referrals.view'
  | 'referrals.approve_withdrawal'
  // Telegram actions
  | 'telegram.view'
  | 'telegram.retry'
  | 'telegram.send'
  // Settings actions
  | 'settings.view'
  | 'settings.edit'
  | 'settings.pricing'
  // Admin management
  | 'admins.view'
  | 'admins.create'
  | 'admins.edit'
  | 'admins.delete'
  // Logs
  | 'logs.view'
  // Experiments
  | 'experiments.view'
  | 'experiments.create'
  | 'experiments.edit'

/**
 * Permission matrix by role
 */
const PERMISSIONS: Record<AdminRole, AdminAction[]> = {
  super_admin: [
    // All permissions
    'users.view', 'users.edit', 'users.ban', 'users.grant_pro', 'users.message', 'users.regenerate',
    'payments.view', 'payments.refund', 'payments.export',
    'generations.view', 'generations.retry',
    'referrals.view', 'referrals.approve_withdrawal',
    'telegram.view', 'telegram.retry', 'telegram.send',
    'settings.view', 'settings.edit', 'settings.pricing',
    'admins.view', 'admins.create', 'admins.edit', 'admins.delete',
    'logs.view',
    'experiments.view', 'experiments.create', 'experiments.edit'
  ],
  admin: [
    // Most permissions except admin management
    'users.view', 'users.edit', 'users.ban', 'users.grant_pro', 'users.message', 'users.regenerate',
    'payments.view', 'payments.refund', 'payments.export',
    'generations.view', 'generations.retry',
    'referrals.view', 'referrals.approve_withdrawal',
    'telegram.view', 'telegram.retry', 'telegram.send',
    'settings.view',
    'logs.view',
    'experiments.view'
  ],
  viewer: [
    // Read-only permissions
    'users.view',
    'payments.view',
    'generations.view',
    'referrals.view',
    'telegram.view',
    'settings.view',
    'logs.view',
    'experiments.view'
  ]
}

/**
 * Check if role has permission for action
 */
export function hasPermission(role: AdminRole, action: AdminAction): boolean {
  const permissions = PERMISSIONS[role]
  return permissions?.includes(action) ?? false
}

/**
 * Check multiple permissions (returns true if ALL are granted)
 */
export function hasAllPermissions(role: AdminRole, actions: AdminAction[]): boolean {
  return actions.every(action => hasPermission(role, action))
}

/**
 * Check multiple permissions (returns true if ANY is granted)
 */
export function hasAnyPermission(role: AdminRole, actions: AdminAction[]): boolean {
  return actions.some(action => hasPermission(role, action))
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: AdminRole): AdminAction[] {
  return PERMISSIONS[role] || []
}

/**
 * Role hierarchy (higher index = more powerful)
 */
const ROLE_HIERARCHY: AdminRole[] = ['viewer', 'admin', 'super_admin']

/**
 * Check if role1 is higher or equal to role2
 */
export function isRoleHigherOrEqual(role1: AdminRole, role2: AdminRole): boolean {
  const index1 = ROLE_HIERARCHY.indexOf(role1)
  const index2 = ROLE_HIERARCHY.indexOf(role2)
  return index1 >= index2
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: AdminRole): string {
  const names: Record<AdminRole, string> = {
    super_admin: 'Супер-админ',
    admin: 'Администратор',
    viewer: 'Просмотр'
  }
  return names[role] || role
}
