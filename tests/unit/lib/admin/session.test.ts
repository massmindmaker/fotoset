import { describe, test, expect, beforeEach, jest } from '@jest/globals';

/**
 * Unit Tests for Admin Session Library
 *
 * Tests JWT-based session management including creation, verification,
 * cookie handling, and cleanup operations.
 *
 * PRIORITY: P0 (Authentication security is critical)
 */

// Mock dependencies
const mockSql = jest.fn();
const mockCookieStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock jose library
const mockSign = jest.fn();
const mockJwtVerify = jest.fn();

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: mockSign,
  })),
  jwtVerify: mockJwtVerify,
}));

// Mock crypto
const mockRandomUUID = jest.fn(() => 'mock-uuid-1234');
global.crypto = {
  randomUUID: mockRandomUUID,
} as any;

// Set environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ADMIN_SESSION_SECRET = 'test-secret-key-min-32-chars-long';
process.env.ADMIN_SESSION_TTL = '86400'; // 24 hours

// Import after mocks
import {
  createSession,
  verifySession,
  getCurrentSession,
  setSessionCookie,
  deleteSession,
  clearSessionCookie,
  cleanupExpiredSessions,
  type AdminSession,
} from '../../../../lib/admin/session';

describe('Admin Session Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSql.mockReset();
    mockSign.mockReset();
    mockJwtVerify.mockReset();
    mockCookieStore.get.mockReset();
    mockCookieStore.set.mockReset();
    mockCookieStore.delete.mockReset();
    mockRandomUUID.mockReturnValue('mock-uuid-1234');
  });

  describe('createSession', () => {
    test('should create session successfully with all parameters', async () => {
      const adminId = 1;
      const email = 'admin@test.com';
      const role = 'super_admin';
      const ipAddress = '127.0.0.1';
      const userAgent = 'Mozilla/5.0';
      const mockToken = 'mock.jwt.token';

      // Mock database responses
      mockSql.mockResolvedValueOnce([{ id: 100 }]); // INSERT session
      mockSql.mockResolvedValueOnce([]); // UPDATE last_login_at

      // Mock JWT sign
      mockSign.mockResolvedValue(mockToken);

      const token = await createSession(adminId, email, role, ipAddress, userAgent);

      // Verify session inserted into database
      expect(mockSql).toHaveBeenCalledTimes(2);
      const insertQuery = mockSql.mock.calls[0][0].join('');
      expect(insertQuery).toContain('INSERT INTO admin_sessions');
      expect(mockSql.mock.calls[0][1]).toBe(adminId);
      expect(mockSql.mock.calls[0][2]).toBe('mock-uuid-1234');
      expect(mockSql.mock.calls[0][3]).toBe(ipAddress);
      expect(mockSql.mock.calls[0][4]).toBe(userAgent);

      // Verify JWT created with correct payload
      expect(mockSign).toHaveBeenCalledTimes(1);

      // Verify last login updated
      const updateQuery = mockSql.mock.calls[1][0].join('');
      expect(updateQuery).toContain('UPDATE admin_users');
      expect(mockSql.mock.calls[1][1]).toBe(adminId);

      // Verify token returned
      expect(token).toBe(mockToken);
    });

    test('should create session without optional parameters', async () => {
      const adminId = 2;
      const email = 'user@test.com';
      const role = 'admin';
      const mockToken = 'mock.jwt.token';

      mockSql.mockResolvedValueOnce([{ id: 101 }]);
      mockSql.mockResolvedValueOnce([]);
      mockSign.mockResolvedValue(mockToken);

      const token = await createSession(adminId, email, role);

      // Verify null passed for ipAddress and userAgent
      expect(mockSql.mock.calls[0][3]).toBeNull();
      expect(mockSql.mock.calls[0][4]).toBeNull();
      expect(token).toBe(mockToken);
    });

    test('should generate unique session token', async () => {
      mockSql.mockResolvedValueOnce([{ id: 102 }]);
      mockSql.mockResolvedValueOnce([]);
      mockSign.mockResolvedValue('token');

      await createSession(1, 'test@test.com', 'admin');

      // Verify crypto.randomUUID was called
      expect(mockRandomUUID).toHaveBeenCalledTimes(1);
    });

    test('should set correct JWT expiration time', async () => {
      const mockJWTInstance = {
        setProtectedHeader: jest.fn().mockReturnThis(),
        setIssuedAt: jest.fn().mockReturnThis(),
        setExpirationTime: jest.fn().mockReturnThis(),
        sign: jest.fn().mockResolvedValue('token'),
      };

      const { SignJWT } = require('jose');
      SignJWT.mockImplementationOnce(() => mockJWTInstance);

      mockSql.mockResolvedValueOnce([{ id: 103 }]);
      mockSql.mockResolvedValueOnce([]);

      await createSession(1, 'test@test.com', 'admin');

      // Verify expiration set
      expect(mockJWTInstance.setExpirationTime).toHaveBeenCalled();
      const expirationArg = mockJWTInstance.setExpirationTime.mock.calls[0][0];
      expect(expirationArg).toBeInstanceOf(Date);
    });

    test('should handle database error on session insert', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        createSession(1, 'test@test.com', 'admin')
      ).rejects.toThrow('Database error');
    });

    test('should handle database error on last_login update', async () => {
      mockSql.mockResolvedValueOnce([{ id: 104 }]);
      mockSql.mockRejectedValueOnce(new Error('Update failed'));
      mockSign.mockResolvedValue('token');

      await expect(
        createSession(1, 'test@test.com', 'admin')
      ).rejects.toThrow('Update failed');
    });
  });

  describe('verifySession', () => {
    test('should return session for valid token', async () => {
      const token = 'valid.jwt.token';
      const payload = {
        adminId: 1,
        email: 'admin@test.com',
        role: 'super_admin',
        sessionId: 100,
      };

      mockJwtVerify.mockResolvedValue({ payload });

      mockSql.mockResolvedValueOnce([
        {
          id: 100,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          email: 'admin@test.com',
          role: 'super_admin',
          first_name: 'John',
          last_name: 'Doe',
          avatar_url: 'https://example.com/avatar.jpg',
          is_active: true,
        },
      ]);

      const session = await verifySession(token);

      expect(mockJwtVerify).toHaveBeenCalledTimes(1);
      expect(mockSql).toHaveBeenCalledTimes(1);
      expect(session).toEqual({
        adminId: 1,
        email: 'admin@test.com',
        role: 'super_admin',
        sessionId: 100,
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
    });

    test('should return null for invalid token', async () => {
      const token = 'invalid.jwt.token';

      mockJwtVerify.mockRejectedValue(new Error('Invalid token'));

      const session = await verifySession(token);

      expect(session).toBeNull();
    });

    test('should return null for expired session in database', async () => {
      const token = 'valid.jwt.token';
      const payload = {
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 200,
      };

      mockJwtVerify.mockResolvedValue({ payload });
      mockSql.mockResolvedValueOnce([]); // No session found (expired)

      const session = await verifySession(token);

      expect(session).toBeNull();
    });

    test('should return null for non-existent session', async () => {
      const token = 'valid.jwt.token';
      const payload = {
        adminId: 999,
        email: 'unknown@test.com',
        role: 'admin',
        sessionId: 999,
      };

      mockJwtVerify.mockResolvedValue({ payload });
      mockSql.mockResolvedValueOnce([]); // Session not found

      const session = await verifySession(token);

      expect(session).toBeNull();
    });

    test('should check session exists in database', async () => {
      const token = 'valid.jwt.token';
      const payload = {
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 100,
      };

      mockJwtVerify.mockResolvedValue({ payload });
      mockSql.mockResolvedValueOnce([
        {
          id: 100,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          email: 'admin@test.com',
          role: 'admin',
          first_name: null,
          last_name: null,
          avatar_url: null,
          is_active: true,
        },
      ]);

      await verifySession(token);

      // Verify database query checks session ID and expiration
      const selectQuery = mockSql.mock.calls[0][0].join('');
      expect(selectQuery).toContain('admin_sessions');
      expect(selectQuery).toContain('expires_at > NOW()');
      expect(mockSql.mock.calls[0][1]).toBe(payload.sessionId);
    });

    test('should return null for inactive user', async () => {
      const token = 'valid.jwt.token';
      const payload = {
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 100,
      };

      mockJwtVerify.mockResolvedValue({ payload });
      mockSql.mockResolvedValueOnce([]); // is_active filter excludes result

      const session = await verifySession(token);

      expect(session).toBeNull();
    });

    test('should handle JWT verification errors gracefully', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Token malformed'));

      const session = await verifySession('bad.token');

      expect(session).toBeNull();
    });
  });

  describe('getCurrentSession', () => {
    test('should return session from cookie', async () => {
      const token = 'cookie.jwt.token';
      const payload = {
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 100,
      };

      mockCookieStore.get.mockReturnValue({ value: token });
      mockJwtVerify.mockResolvedValue({ payload });
      mockSql.mockResolvedValueOnce([
        {
          id: 100,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          email: 'admin@test.com',
          role: 'admin',
          first_name: 'Jane',
          last_name: 'Smith',
          avatar_url: null,
          is_active: true,
        },
      ]);

      const session = await getCurrentSession();

      expect(mockCookieStore.get).toHaveBeenCalledWith('admin_session');
      expect(session).toEqual({
        adminId: 1,
        email: 'admin@test.com',
        role: 'admin',
        sessionId: 100,
        firstName: 'Jane',
        lastName: 'Smith',
        avatarUrl: null,
      });
    });

    test('should return null when no cookie', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const session = await getCurrentSession();

      expect(session).toBeNull();
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    test('should handle invalid cookie value', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid.token' });
      mockJwtVerify.mockRejectedValue(new Error('Invalid token'));

      const session = await getCurrentSession();

      expect(session).toBeNull();
    });
  });

  describe('setSessionCookie', () => {
    test('should set httpOnly cookie with correct options', async () => {
      const token = 'session.jwt.token';
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await setSessionCookie(token);

      expect(mockCookieStore.set).toHaveBeenCalledWith('admin_session', token, {
        httpOnly: true,
        secure: false, // Development mode
        sameSite: 'lax',
        maxAge: 86400,
        path: '/',
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should set secure cookie in production', async () => {
      const token = 'session.jwt.token';
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await setSessionCookie(token);

      expect(mockCookieStore.set).toHaveBeenCalledWith('admin_session', token, {
        httpOnly: true,
        secure: true, // Production mode
        sameSite: 'lax',
        maxAge: 86400,
        path: '/',
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should set sameSite to lax', async () => {
      const token = 'session.jwt.token';

      await setSessionCookie(token);

      const setCall = mockCookieStore.set.mock.calls[0];
      expect(setCall[2].sameSite).toBe('lax');
    });

    test('should use SESSION_TTL for maxAge', async () => {
      const token = 'session.jwt.token';

      await setSessionCookie(token);

      const setCall = mockCookieStore.set.mock.calls[0];
      expect(setCall[2].maxAge).toBe(86400);
    });
  });

  describe('deleteSession', () => {
    test('should delete session from database', async () => {
      const sessionId = 100;
      mockSql.mockResolvedValueOnce([]);

      await deleteSession(sessionId);

      expect(mockSql).toHaveBeenCalledTimes(1);
      const deleteQuery = mockSql.mock.calls[0][0].join('');
      expect(deleteQuery).toContain('DELETE FROM admin_sessions');
      expect(mockSql.mock.calls[0][1]).toBe(sessionId);
    });

    test('should handle non-existent session gracefully', async () => {
      const sessionId = 999;
      mockSql.mockResolvedValueOnce([]);

      await expect(deleteSession(sessionId)).resolves.not.toThrow();
    });

    test('should handle database errors', async () => {
      const sessionId = 100;
      mockSql.mockRejectedValueOnce(new Error('Database error'));

      await expect(deleteSession(sessionId)).rejects.toThrow('Database error');
    });
  });

  describe('clearSessionCookie', () => {
    test('should delete session cookie', async () => {
      await clearSessionCookie();

      expect(mockCookieStore.delete).toHaveBeenCalledWith('admin_session');
      expect(mockCookieStore.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupExpiredSessions', () => {
    test('should delete expired sessions and return count', async () => {
      const mockExpiredSessions = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ];
      mockSql.mockResolvedValueOnce(mockExpiredSessions);

      const count = await cleanupExpiredSessions();

      expect(mockSql).toHaveBeenCalledTimes(1);
      const cleanupQuery = mockSql.mock.calls[0][0].join('');
      expect(cleanupQuery).toContain('DELETE FROM admin_sessions');
      expect(cleanupQuery).toContain('WHERE expires_at < NOW()');
      expect(count).toBe(3);
    });

    test('should return 0 when no expired sessions', async () => {
      mockSql.mockResolvedValueOnce([]);

      const count = await cleanupExpiredSessions();

      expect(count).toBe(0);
    });

    test('should handle database errors', async () => {
      mockSql.mockRejectedValueOnce(new Error('Cleanup failed'));

      await expect(cleanupExpiredSessions()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('Environment Variables', () => {
    test('should throw error when ADMIN_SESSION_SECRET not set', async () => {
      const originalSecret = process.env.ADMIN_SESSION_SECRET;
      delete process.env.ADMIN_SESSION_SECRET;

      mockSql.mockResolvedValueOnce([{ id: 100 }]);

      await expect(
        createSession(1, 'test@test.com', 'admin')
      ).rejects.toThrow('ADMIN_SESSION_SECRET is not set');

      process.env.ADMIN_SESSION_SECRET = originalSecret;
    });

    test('should throw error when DATABASE_URL not set', async () => {
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      await expect(
        createSession(1, 'test@test.com', 'admin')
      ).rejects.toThrow('DATABASE_URL not set');

      process.env.DATABASE_URL = originalUrl;
    });
  });
});
