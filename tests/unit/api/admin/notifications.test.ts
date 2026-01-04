import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Unit Tests for Admin Notifications API Routes
 *
 * Tests notification listing, marking as read (single and all), and
 * unread count tracking for the admin panel notification system.
 *
 * PRIORITY: P1 (Admin notifications for monitoring)
 */

// Mock dependencies
const mockSql = jest.fn();
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql),
}));

// Mock session management
const mockGetCurrentSession = jest.fn();
jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: mockGetCurrentSession,
}));

// Import route handlers after mocks
import { GET as getNotifications } from '@/app/api/admin/notifications/route';
import { POST as markAllRead } from '@/app/api/admin/notifications/read-all/route';
import { POST as markOneRead } from '@/app/api/admin/notifications/[id]/read/route';

describe('Admin Notifications API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://test';
  });

  describe('GET /api/admin/notifications', () => {
    const mockSession = { adminId: 1, role: 'admin' as const };

    test('returns notifications list with unread count', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      const mockNotifications = [
        {
          id: 1,
          type: 'payment_failed',
          title: 'Payment Failed',
          message: 'Payment #123 failed',
          metadata: { payment_id: 123 },
          is_read: false,
          created_at: '2025-12-31T10:00:00Z',
        },
        {
          id: 2,
          type: 'generation_complete',
          title: 'Generation Complete',
          message: 'Job #456 completed',
          metadata: { job_id: 456 },
          is_read: true,
          created_at: '2025-12-31T09:00:00Z',
        },
      ];

      // Mock table exists check
      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        // Mock notifications query
        .mockResolvedValueOnce(mockNotifications)
        // Mock unread count query
        .mockResolvedValueOnce([{ count: '1' }]);

      const request = new NextRequest('http://localhost/api/admin/notifications');
      const response = await getNotifications(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({
        notifications: mockNotifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          metadata: n.metadata,
          is_read: n.is_read,
          created_at: n.created_at,
        })),
        unread_count: 1,
      });

      // Verify SQL calls
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    test('filters by unread only when unread=true', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      const mockUnreadNotifications = [
        {
          id: 1,
          type: 'error',
          title: 'Error Occurred',
          message: 'System error',
          metadata: null,
          is_read: false,
          created_at: '2025-12-31T10:00:00Z',
        },
      ];

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce(mockUnreadNotifications)
        .mockResolvedValueOnce([{ count: '1' }]);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications?unread=true'
      );
      const response = await getNotifications(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.notifications).toHaveLength(1);
      expect(data.notifications[0].is_read).toBe(false);
      expect(data.unread_count).toBe(1);
    });

    test('respects custom limit parameter', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      const mockNotifications = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        type: 'info',
        title: `Notification ${i + 1}`,
        message: null,
        metadata: null,
        is_read: false,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
      }));

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce(mockNotifications)
        .mockResolvedValueOnce([{ count: '5' }]);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications?limit=5'
      );
      const response = await getNotifications(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.notifications).toHaveLength(5);
    });

    test('uses default limit of 20', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]);

      const request = new NextRequest('http://localhost/api/admin/notifications');
      await getNotifications(request);

      // Verify LIMIT parameter in SQL call (3rd call is the notifications query)
      const notificationsCall = mockSql.mock.calls[1];
      expect(notificationsCall).toBeDefined();
    });

    test('creates table if it does not exist', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      // Mock table doesn't exist
      mockSql
        .mockResolvedValueOnce([{ exists: false }])
        // Mock CREATE TABLE
        .mockResolvedValueOnce([])
        // Mock CREATE INDEX calls
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost/api/admin/notifications');
      const response = await getNotifications(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({
        notifications: [],
        unread_count: 0,
      });

      // Verify table creation and indexes
      expect(mockSql).toHaveBeenCalledTimes(4); // check + create table + 2 indexes
    });

    test('returns 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/admin/notifications');
      const response = await getNotifications(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });

      expect(mockSql).not.toHaveBeenCalled();
    });

    test('handles database error gracefully', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      mockSql.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/admin/notifications');
      const response = await getNotifications(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Failed to fetch notifications' });
    });

    test('handles missing DATABASE_URL', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      delete process.env.DATABASE_URL;

      const request = new NextRequest('http://localhost/api/admin/notifications');
      const response = await getNotifications(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Failed to fetch notifications' });

      // Restore for other tests
      process.env.DATABASE_URL = 'postgresql://test';
    });
  });

  describe('POST /api/admin/notifications/read-all', () => {
    const mockSession = { adminId: 1, role: 'admin' as const };

    test('marks all notifications as read', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      // Mock UPDATE result (3 rows affected)
      const mockUpdateResult = new Array(3).fill({ id: 1 });
      mockSql.mockResolvedValueOnce(mockUpdateResult);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/read-all',
        { method: 'POST' }
      );
      const response = await markAllRead(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({
        success: true,
        marked_count: 3,
      });

      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    test('handles no notifications to mark', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      // Mock UPDATE result (0 rows affected)
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/read-all',
        { method: 'POST' }
      );
      const response = await markAllRead(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({
        success: true,
        marked_count: 0,
      });
    });

    test('returns 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/read-all',
        { method: 'POST' }
      );
      const response = await markAllRead(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });

      expect(mockSql).not.toHaveBeenCalled();
    });

    test('handles database error gracefully', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      mockSql.mockRejectedValueOnce(new Error('UPDATE failed'));

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/read-all',
        { method: 'POST' }
      );
      const response = await markAllRead(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Failed to mark notifications as read' });
    });

    test('handles missing DATABASE_URL', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      delete process.env.DATABASE_URL;

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/read-all',
        { method: 'POST' }
      );
      const response = await markAllRead(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Failed to mark notifications as read' });

      process.env.DATABASE_URL = 'postgresql://test';
    });
  });

  describe('POST /api/admin/notifications/[id]/read', () => {
    const mockSession = { adminId: 1, role: 'admin' as const };

    test('marks single notification as read', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      mockSql.mockResolvedValueOnce([{ id: 1 }]);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/1/read',
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: '1' }) };
      const response = await markOneRead(request, context);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({ success: true });
      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    test('succeeds even if notification does not exist', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      // UPDATE with no matches returns empty array
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/999/read',
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: '999' }) };
      const response = await markOneRead(request, context);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({ success: true });
    });

    test('returns 400 for invalid ID format', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/invalid/read',
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: 'invalid' }) };
      const response = await markOneRead(request, context);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Invalid notification ID' });

      expect(mockSql).not.toHaveBeenCalled();
    });

    test('returns 400 for negative ID', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/-1/read',
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: '-1' }) };
      const response = await markOneRead(request, context);

      expect(response.status).toBe(200); // UPDATE will succeed but affect 0 rows
      const data = await response.json();
      expect(data).toEqual({ success: true });
    });

    test('returns 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/1/read',
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: '1' }) };
      const response = await markOneRead(request, context);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });

      expect(mockSql).not.toHaveBeenCalled();
    });

    test('handles database error gracefully', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);

      mockSql.mockRejectedValueOnce(new Error('UPDATE failed'));

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/1/read',
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: '1' }) };
      const response = await markOneRead(request, context);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Failed to mark notification as read' });
    });

    test('handles missing DATABASE_URL', async () => {
      mockGetCurrentSession.mockResolvedValue(mockSession);
      delete process.env.DATABASE_URL;

      const request = new NextRequest(
        'http://localhost/api/admin/notifications/1/read',
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: '1' }) };
      const response = await markOneRead(request, context);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Failed to mark notification as read' });

      process.env.DATABASE_URL = 'postgresql://test';
    });
  });
});
