/**
 * Unit Tests for Admin Permissions Library
 *
 * Tests role-based permission checking functions
 */

import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getPermissions,
  isRoleHigherOrEqual,
  getRoleDisplayName,
  type AdminRole,
  type AdminAction
} from '@/lib/admin/permissions'

describe('Admin Permissions Library', () => {

  describe('hasPermission', () => {
    describe('super_admin permissions', () => {
      it('has user view permission', () => {
        expect(hasPermission('super_admin', 'users.view')).toBe(true)
      })

      it('has user ban permission', () => {
        expect(hasPermission('super_admin', 'users.ban')).toBe(true)
      })

      it('has payment refund permission', () => {
        expect(hasPermission('super_admin', 'payments.refund')).toBe(true)
      })

      it('has admin create permission', () => {
        expect(hasPermission('super_admin', 'admins.create')).toBe(true)
      })

      it('has admin delete permission', () => {
        expect(hasPermission('super_admin', 'admins.delete')).toBe(true)
      })

      it('has settings edit permission', () => {
        expect(hasPermission('super_admin', 'settings.edit')).toBe(true)
      })

      it('has experiments create permission', () => {
        expect(hasPermission('super_admin', 'experiments.create')).toBe(true)
      })
    })

    describe('admin permissions', () => {
      it('has user view permission', () => {
        expect(hasPermission('admin', 'users.view')).toBe(true)
      })

      it('has user ban permission', () => {
        expect(hasPermission('admin', 'users.ban')).toBe(true)
      })

      it('has payment refund permission', () => {
        expect(hasPermission('admin', 'payments.refund')).toBe(true)
      })

      it('does NOT have admin create permission', () => {
        expect(hasPermission('admin', 'admins.create')).toBe(false)
      })

      it('does NOT have admin delete permission', () => {
        expect(hasPermission('admin', 'admins.delete')).toBe(false)
      })

      it('does NOT have settings edit permission', () => {
        expect(hasPermission('admin', 'settings.edit')).toBe(false)
      })

      it('does NOT have experiments create permission', () => {
        expect(hasPermission('admin', 'experiments.create')).toBe(false)
      })
    })

    describe('viewer permissions', () => {
      it('has user view permission', () => {
        expect(hasPermission('viewer', 'users.view')).toBe(true)
      })

      it('has payments view permission', () => {
        expect(hasPermission('viewer', 'payments.view')).toBe(true)
      })

      it('has generations view permission', () => {
        expect(hasPermission('viewer', 'generations.view')).toBe(true)
      })

      it('does NOT have user ban permission', () => {
        expect(hasPermission('viewer', 'users.ban')).toBe(false)
      })

      it('does NOT have payment refund permission', () => {
        expect(hasPermission('viewer', 'payments.refund')).toBe(false)
      })

      it('does NOT have user edit permission', () => {
        expect(hasPermission('viewer', 'users.edit')).toBe(false)
      })

      it('does NOT have telegram send permission', () => {
        expect(hasPermission('viewer', 'telegram.send')).toBe(false)
      })

      it('does NOT have admin create permission', () => {
        expect(hasPermission('viewer', 'admins.create')).toBe(false)
      })
    })
  })

  describe('hasAllPermissions', () => {
    it('returns true when super_admin has all requested permissions', () => {
      const actions: AdminAction[] = ['users.view', 'users.ban', 'admins.create']
      expect(hasAllPermissions('super_admin', actions)).toBe(true)
    })

    it('returns true when admin has all requested permissions', () => {
      const actions: AdminAction[] = ['users.view', 'users.ban', 'payments.refund']
      expect(hasAllPermissions('admin', actions)).toBe(true)
    })

    it('returns true when viewer has all requested permissions', () => {
      const actions: AdminAction[] = ['users.view', 'payments.view', 'generations.view']
      expect(hasAllPermissions('viewer', actions)).toBe(true)
    })

    it('returns false when admin is missing one permission', () => {
      const actions: AdminAction[] = ['users.view', 'users.ban', 'admins.create']
      expect(hasAllPermissions('admin', actions)).toBe(false)
    })

    it('returns false when viewer is missing all permissions', () => {
      const actions: AdminAction[] = ['users.ban', 'payments.refund', 'admins.create']
      expect(hasAllPermissions('viewer', actions)).toBe(false)
    })

    it('returns false when viewer is missing one permission', () => {
      const actions: AdminAction[] = ['users.view', 'users.edit']
      expect(hasAllPermissions('viewer', actions)).toBe(false)
    })

    it('returns true with empty array', () => {
      expect(hasAllPermissions('super_admin', [])).toBe(true)
      expect(hasAllPermissions('admin', [])).toBe(true)
      expect(hasAllPermissions('viewer', [])).toBe(true)
    })
  })

  describe('hasAnyPermission', () => {
    it('returns true when super_admin has at least one permission', () => {
      const actions: AdminAction[] = ['users.view', 'users.ban']
      expect(hasAnyPermission('super_admin', actions)).toBe(true)
    })

    it('returns true when admin has at least one permission', () => {
      const actions: AdminAction[] = ['admins.create', 'users.view']
      expect(hasAnyPermission('admin', actions)).toBe(true)
    })

    it('returns true when viewer has at least one permission', () => {
      const actions: AdminAction[] = ['users.ban', 'users.view']
      expect(hasAnyPermission('viewer', actions)).toBe(true)
    })

    it('returns false when viewer has none of the permissions', () => {
      const actions: AdminAction[] = ['users.ban', 'payments.refund', 'admins.create']
      expect(hasAnyPermission('viewer', actions)).toBe(false)
    })

    it('returns false when admin has none of the permissions', () => {
      const actions: AdminAction[] = ['admins.create', 'admins.delete', 'settings.edit']
      expect(hasAnyPermission('admin', actions)).toBe(false)
    })

    it('works with single permission (has permission)', () => {
      expect(hasAnyPermission('admin', ['users.view'])).toBe(true)
    })

    it('works with single permission (lacks permission)', () => {
      expect(hasAnyPermission('viewer', ['users.ban'])).toBe(false)
    })

    it('returns false with empty array', () => {
      expect(hasAnyPermission('super_admin', [])).toBe(false)
      expect(hasAnyPermission('admin', [])).toBe(false)
      expect(hasAnyPermission('viewer', [])).toBe(false)
    })
  })

  describe('getPermissions', () => {
    it('returns all permissions for super_admin', () => {
      const permissions = getPermissions('super_admin')
      expect(permissions).toContain('users.view')
      expect(permissions).toContain('users.ban')
      expect(permissions).toContain('payments.refund')
      expect(permissions).toContain('admins.create')
      expect(permissions).toContain('admins.delete')
      expect(permissions).toContain('settings.edit')
      expect(permissions).toContain('experiments.create')
      expect(permissions.length).toBeGreaterThan(20)
    })

    it('returns limited permissions for admin', () => {
      const permissions = getPermissions('admin')
      expect(permissions).toContain('users.view')
      expect(permissions).toContain('users.ban')
      expect(permissions).toContain('payments.refund')
      expect(permissions).not.toContain('admins.create')
      expect(permissions).not.toContain('admins.delete')
      expect(permissions).not.toContain('settings.edit')
      expect(permissions.length).toBeGreaterThan(10)
      expect(permissions.length).toBeLessThan(getPermissions('super_admin').length)
    })

    it('returns limited permissions for viewer', () => {
      const permissions = getPermissions('viewer')
      expect(permissions).toContain('users.view')
      expect(permissions).toContain('payments.view')
      expect(permissions).toContain('generations.view')
      expect(permissions).not.toContain('users.ban')
      expect(permissions).not.toContain('payments.refund')
      expect(permissions.length).toBeGreaterThan(0)
      expect(permissions.length).toBeLessThan(getPermissions('admin').length)
    })

    it('returns permissions array (not empty) for all roles', () => {
      expect(getPermissions('super_admin').length).toBeGreaterThan(0)
      expect(getPermissions('admin').length).toBeGreaterThan(0)
      expect(getPermissions('viewer').length).toBeGreaterThan(0)
    })
  })

  describe('isRoleHigherOrEqual', () => {
    describe('super_admin comparisons', () => {
      it('super_admin >= super_admin', () => {
        expect(isRoleHigherOrEqual('super_admin', 'super_admin')).toBe(true)
      })

      it('super_admin >= admin', () => {
        expect(isRoleHigherOrEqual('super_admin', 'admin')).toBe(true)
      })

      it('super_admin >= viewer', () => {
        expect(isRoleHigherOrEqual('super_admin', 'viewer')).toBe(true)
      })
    })

    describe('admin comparisons', () => {
      it('admin >= admin', () => {
        expect(isRoleHigherOrEqual('admin', 'admin')).toBe(true)
      })

      it('admin >= viewer', () => {
        expect(isRoleHigherOrEqual('admin', 'viewer')).toBe(true)
      })

      it('admin < super_admin', () => {
        expect(isRoleHigherOrEqual('admin', 'super_admin')).toBe(false)
      })
    })

    describe('viewer comparisons', () => {
      it('viewer >= viewer', () => {
        expect(isRoleHigherOrEqual('viewer', 'viewer')).toBe(true)
      })

      it('viewer < admin', () => {
        expect(isRoleHigherOrEqual('viewer', 'admin')).toBe(false)
      })

      it('viewer < super_admin', () => {
        expect(isRoleHigherOrEqual('viewer', 'super_admin')).toBe(false)
      })
    })
  })

  describe('getRoleDisplayName', () => {
    it('returns "Супер-админ" for super_admin', () => {
      expect(getRoleDisplayName('super_admin')).toBe('Супер-админ')
    })

    it('returns "Администратор" for admin', () => {
      expect(getRoleDisplayName('admin')).toBe('Администратор')
    })

    it('returns "Просмотр" for viewer', () => {
      expect(getRoleDisplayName('viewer')).toBe('Просмотр')
    })
  })

  describe('edge cases and cross-validation', () => {
    it('viewer permissions are a subset of admin permissions', () => {
      const viewerPerms = getPermissions('viewer')
      const adminPerms = getPermissions('admin')

      viewerPerms.forEach(perm => {
        expect(adminPerms).toContain(perm)
      })
    })

    it('admin permissions are a subset of super_admin permissions', () => {
      const adminPerms = getPermissions('admin')
      const superAdminPerms = getPermissions('super_admin')

      adminPerms.forEach(perm => {
        expect(superAdminPerms).toContain(perm)
      })
    })

    it('hasAllPermissions and hasAnyPermission are consistent', () => {
      const actions: AdminAction[] = ['users.view', 'payments.view']

      // If hasAll is true, hasAny must also be true
      if (hasAllPermissions('viewer', actions)) {
        expect(hasAnyPermission('viewer', actions)).toBe(true)
      }
    })

    it('single permission check matches hasAllPermissions', () => {
      const action: AdminAction = 'users.ban'

      expect(hasPermission('admin', action)).toBe(hasAllPermissions('admin', [action]))
      expect(hasPermission('viewer', action)).toBe(hasAllPermissions('viewer', [action]))
    })

    it('getPermissions returns unique permissions', () => {
      const roles: AdminRole[] = ['super_admin', 'admin', 'viewer']

      roles.forEach(role => {
        const perms = getPermissions(role)
        const uniquePerms = Array.from(new Set(perms))
        expect(perms.length).toBe(uniquePerms.length)
      })
    })
  })
})
