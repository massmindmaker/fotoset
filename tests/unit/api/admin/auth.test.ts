import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Unit Tests for Admin Authentication API Routes
 *
 * Tests login, logout, and current user endpoints for the admin panel
 * session-based authentication system.
 *
 * PRIORITY: P0 (Authentication security is critical)
 */

// Mock dependencies
const mockSql = jest.fn();
jest.mock('@/lib/db', () => ({
  sql: Object.assign((...args: any[]) => mockSql(...args), {
    unsafe: (str: string) => str,
  }),
}));

// Mock session management
const mockGetCurrentSession = jest.fn();
const mockCreateSession = jest.fn();
const mockSetSessionCookie = jest.fn();
const mockClearSessionCookie = jest.fn();
const mockDeleteSession = jest.fn();

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: mockGetCurrentSession,
  createSession: mockCreateSession,
  setSessionCookie: mockSetSessionCookie,
  clearSessionCookie: mockClearSessionCookie,
  deleteSession: mockDeleteSession,
}));

// Mock authentication
const mockVerifyPassword = jest.fn();
const mockFindAdminByEmail = jest.fn();
const mockFindAdminById = jest.fn();
const mockCreateAdmin = jest.fn();
const mockGetSuperAdminEmail = jest.fn();

jest.mock('@/lib/admin/auth', () => ({
  verifyPassword: mockVerifyPassword,
  findAdminByEmail: mockFindAdminByEmail,
  findAdminById: mockFindAdminById,
  createAdmin: mockCreateAdmin,
  getSuperAdminEmail: mockGetSuperAdminEmail,
}));

// Mock audit logging
const mockLogAdminAction = jest.fn();
jest.mock('@/lib/admin/audit', () => ({
  logAdminAction: mockLogAdminAction,
}));

// Mock permissions
const mockGetPermissions = jest.fn();
jest.mock('@/lib/admin/permissions', () => ({
  getPermissions: mockGetPermissions,
}));

// Import route handlers after mocks
import { POST as loginHandler } from '@/app/api/admin/auth/login/route';
import { GET as meHandler } from '@/app/api/admin/auth/me/route';
import { POST as logoutHandler } from '@/app/api/admin/auth/logout/route';

describe('Admin Auth API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSuperAdminEmail.mockReturnValue(null);
  });

  describe('POST /api/admin/auth/login', () => {
    const mockAdmin = {
      id: 1,
      email: 'admin@example.com',
      role: 'admin' as const,
      firstName: 'John',
      lastName: 'Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
      isActive: true,
    };

    test('should login successfully with valid credentials', async () => {
      mockVerifyPassword.mockResolvedValue(mockAdmin);
      mockFindAdminByEmail.mockResolvedValue(mockAdmin);
      mockCreateSession.mockResolvedValue('mock-session-token');
      mockSetSessionCookie.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'SecurePassword123!',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        admin: {
          id: mockAdmin.id,
          email: mockAdmin.email,
          role: mockAdmin.role,
          firstName: mockAdmin.firstName,
          lastName: mockAdmin.lastName,
          avatarUrl: mockAdmin.avatarUrl,
        },
      });

      expect(mockVerifyPassword).toHaveBeenCalledWith('admin@example.com', 'SecurePassword123!');
      expect(mockCreateSession).toHaveBeenCalledWith(
        mockAdmin.id,
        mockAdmin.email,
        mockAdmin.role,
        '192.168.1.1',
        'Mozilla/5.0'
      );
      expect(mockSetSessionCookie).toHaveBeenCalledWith('mock-session-token');
      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: mockAdmin.id,
        action: 'login',
        metadata: { method: 'email' },
        ipAddress: '192.168.1.1',
      });
    });

    test('should return 401 with invalid password', async () => {
      const existingAdmin = { ...mockAdmin };
      mockFindAdminByEmail.mockResolvedValue(existingAdmin);
      mockVerifyPassword.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'WrongPassword',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Invalid email or password',
      });

      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: existingAdmin.id,
        action: 'login_failed',
        metadata: { reason: 'invalid_password' },
        ipAddress: 'unknown',
      });
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockSetSessionCookie).not.toHaveBeenCalled();
    });

    test('should return 401 with non-existent email', async () => {
      mockFindAdminByEmail.mockResolvedValue(null);
      mockVerifyPassword.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Invalid email or password',
      });

      expect(mockLogAdminAction).not.toHaveBeenCalled();
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    test('should return 400 when email is missing', async () => {
      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          password: 'SomePassword123!',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Email and password are required',
      });

      expect(mockVerifyPassword).not.toHaveBeenCalled();
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    test('should return 400 when password is missing', async () => {
      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Email and password are required',
      });

      expect(mockVerifyPassword).not.toHaveBeenCalled();
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    test('should return 401 when admin is inactive', async () => {
      const inactiveAdmin = { ...mockAdmin, isActive: false };
      mockFindAdminByEmail.mockResolvedValue(inactiveAdmin);
      mockVerifyPassword.mockResolvedValue(null); // verifyPassword returns null for inactive users

      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'SecurePassword123!',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Invalid email or password',
      });

      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    test('should handle database error with 500', async () => {
      mockFindAdminByEmail.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'SecurePassword123!',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Internal server error',
      });

      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    test('should create session on successful login', async () => {
      mockVerifyPassword.mockResolvedValue(mockAdmin);
      mockFindAdminByEmail.mockResolvedValue(mockAdmin);
      mockCreateSession.mockResolvedValue('session-token-xyz');
      mockSetSessionCookie.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '10.0.0.1',
          'user-agent': 'Chrome',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'SecurePassword123!',
        }),
      });

      await loginHandler(request);

      expect(mockCreateSession).toHaveBeenCalledWith(
        mockAdmin.id,
        mockAdmin.email,
        mockAdmin.role,
        '10.0.0.1',
        'Chrome'
      );
    });

    test('should set session cookie on successful login', async () => {
      mockVerifyPassword.mockResolvedValue(mockAdmin);
      mockFindAdminByEmail.mockResolvedValue(mockAdmin);
      mockCreateSession.mockResolvedValue('session-token-abc');
      mockSetSessionCookie.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'SecurePassword123!',
        }),
      });

      await loginHandler(request);

      expect(mockSetSessionCookie).toHaveBeenCalledWith('session-token-abc');
    });

    test('should auto-create super admin on first login', async () => {
      const superEmail = 'super@example.com';
      const newSuperAdmin = {
        id: 1,
        email: superEmail,
        role: 'super_admin' as const,
        firstName: null,
        lastName: null,
        avatarUrl: null,
        isActive: true,
      };

      mockGetSuperAdminEmail.mockReturnValue(superEmail);
      mockFindAdminByEmail.mockResolvedValue(null); // No existing admin
      mockCreateAdmin.mockResolvedValue(newSuperAdmin);
      mockCreateSession.mockResolvedValue('super-session-token');
      mockSetSessionCookie.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify({
          email: superEmail,
          password: 'InitialPassword123!',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.admin.role).toBe('super_admin');

      expect(mockCreateAdmin).toHaveBeenCalledWith({
        email: superEmail.toLowerCase(),
        password: 'InitialPassword123!',
        role: 'super_admin',
      });

      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: newSuperAdmin.id,
        action: 'login',
        metadata: { method: 'email', firstLogin: true },
        ipAddress: '127.0.0.1',
      });
    });

    test('should use x-real-ip header when x-forwarded-for is not present', async () => {
      mockVerifyPassword.mockResolvedValue(mockAdmin);
      mockFindAdminByEmail.mockResolvedValue(mockAdmin);
      mockCreateSession.mockResolvedValue('token');
      mockSetSessionCookie.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '203.0.113.1',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'SecurePassword123!',
        }),
      });

      await loginHandler(request);

      expect(mockCreateSession).toHaveBeenCalledWith(
        mockAdmin.id,
        mockAdmin.email,
        mockAdmin.role,
        '203.0.113.1',
        undefined
      );

      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: mockAdmin.id,
        action: 'login',
        metadata: { method: 'email' },
        ipAddress: '203.0.113.1',
      });
    });
  });

  describe('GET /api/admin/auth/me', () => {
    const mockSession = {
      adminId: 1,
      email: 'admin@example.com',
      role: 'admin' as const,
      sessionId: 123,
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockAdmin = {
      id: 1,
      email: 'admin@example.com',
      role: 'admin' as const,
      firstName: 'John',
      lastName: 'Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
      isActive: true,
      lastLoginAt: new Date('2025-01-01T12:00:00Z'),
    };

    const mockPermissions = ['users.view', 'payments.view'];

    test('should return current user when authenticated', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockFindAdminById.mockResolvedValue(mockAdmin);
      mockGetPermissions.mockReturnValue(mockPermissions);

      const response = await meHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        admin: {
          id: mockAdmin.id,
          email: mockAdmin.email,
          role: mockAdmin.role,
          firstName: mockAdmin.firstName,
          lastName: mockAdmin.lastName,
          avatarUrl: mockAdmin.avatarUrl,
          lastLoginAt: mockAdmin.lastLoginAt.toISOString(),
        },
        permissions: mockPermissions,
      });

      expect(mockGetCurrentSession).toHaveBeenCalled();
      expect(mockFindAdminById).toHaveBeenCalledWith(mockSession.adminId);
      expect(mockGetPermissions).toHaveBeenCalledWith(mockAdmin.role);
    });

    test('should return 401 when no session', async () => {
      mockGetCurrentSession.mockResolvedValue(null);

      const response = await meHandler();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Not authenticated',
      });

      expect(mockFindAdminById).not.toHaveBeenCalled();
      expect(mockGetPermissions).not.toHaveBeenCalled();
    });

    test('should include permissions in response', async () => {
      const viewerPermissions = ['users.view', 'payments.view', 'logs.view'];
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockFindAdminById.mockResolvedValue(mockAdmin);
      mockGetPermissions.mockReturnValue(viewerPermissions);

      const response = await meHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.permissions).toEqual(viewerPermissions);
      expect(mockGetPermissions).toHaveBeenCalledWith(mockAdmin.role);
    });

    test('should return 401 when admin not found', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockFindAdminById.mockResolvedValue(null);

      const response = await meHandler();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Admin not found or inactive',
      });

      expect(mockGetPermissions).not.toHaveBeenCalled();
    });

    test('should return 401 when admin is inactive', async () => {
      const inactiveAdmin = { ...mockAdmin, isActive: false };
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockFindAdminById.mockResolvedValue(inactiveAdmin);

      const response = await meHandler();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Admin not found or inactive',
      });

      expect(mockGetPermissions).not.toHaveBeenCalled();
    });

    test('should handle database error with 500', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockFindAdminById.mockRejectedValue(new Error('Database query failed'));

      const response = await meHandler();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Internal server error',
      });
    });
  });

  describe('POST /api/admin/auth/logout', () => {
    const mockSession = {
      adminId: 1,
      email: 'admin@example.com',
      role: 'admin' as const,
      sessionId: 123,
    };

    test('should clear session successfully', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockDeleteSession.mockResolvedValue(undefined);
      mockClearSessionCookie.mockResolvedValue(undefined);

      const response = await logoutHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      expect(mockDeleteSession).toHaveBeenCalledWith(mockSession.sessionId);
      expect(mockClearSessionCookie).toHaveBeenCalled();
      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: mockSession.adminId,
        action: 'logout',
      });
    });

    test('should delete session from database', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockDeleteSession.mockResolvedValue(undefined);
      mockClearSessionCookie.mockResolvedValue(undefined);

      await logoutHandler();

      expect(mockDeleteSession).toHaveBeenCalledWith(mockSession.sessionId);
    });

    test('should clear session cookie', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockDeleteSession.mockResolvedValue(undefined);
      mockClearSessionCookie.mockResolvedValue(undefined);

      await logoutHandler();

      expect(mockClearSessionCookie).toHaveBeenCalled();
    });

    test('should succeed even when no session exists', async () => {
      mockGetCurrentSession.mockResolvedValue(null);
      mockClearSessionCookie.mockResolvedValue(undefined);

      const response = await logoutHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      expect(mockDeleteSession).not.toHaveBeenCalled();
      expect(mockLogAdminAction).not.toHaveBeenCalled();
      expect(mockClearSessionCookie).toHaveBeenCalled();
    });

    test('should clear cookie even on error', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockLogAdminAction.mockRejectedValue(new Error('Audit log error'));
      mockDeleteSession.mockResolvedValue(undefined);
      mockClearSessionCookie.mockResolvedValue(undefined);

      const response = await logoutHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      // Cookie should be cleared in both try block and catch block
      expect(mockClearSessionCookie).toHaveBeenCalled();
    });

    test('should log logout action', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      mockDeleteSession.mockResolvedValue(undefined);
      mockClearSessionCookie.mockResolvedValue(undefined);

      await logoutHandler();

      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: mockSession.adminId,
        action: 'logout',
      });
    });

    test('should not log when session does not exist', async () => {
      mockGetCurrentSession.mockResolvedValue(null);
      mockClearSessionCookie.mockResolvedValue(undefined);

      await logoutHandler();

      expect(mockLogAdminAction).not.toHaveBeenCalled();
    });
  });
});
