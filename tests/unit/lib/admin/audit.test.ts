import { describe, test, expect, beforeEach, jest } from '@jest/globals';

/**
 * Unit Tests for Admin Audit Library
 *
 * Tests audit logging, activity retrieval, and action name display
 * for admin panel operations.
 *
 * PRIORITY: P0 (Security and compliance critical)
 */

// Mock @neondatabase/serverless
const mockSql = jest.fn();
jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql),
}));

// Import after mocking
import {
  logAdminAction,
  getRecentActivity,
  getActionDisplayName,
  type AuditAction,
  type AuditTargetType,
} from '../../../../lib/admin/audit';

describe('Admin Audit Library', () => {
  const originalEnv = process.env;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, DATABASE_URL: 'postgresql://test-db-url' };
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('logAdminAction', () => {
    test('should log action successfully with all required fields', async () => {
      mockSql.mockResolvedValueOnce([]);

      await logAdminAction({
        adminId: 1,
        action: 'user_banned',
      });

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('INSERT INTO admin_activity_log'),
        ]),
        1,
        'user_banned',
        null,
        null,
        null,
        null
      );
      expect(console.log).toHaveBeenCalledWith(
        '[Audit] user_banned by admin 1'
      );
    });

    test('should include all optional fields when provided', async () => {
      mockSql.mockResolvedValueOnce([]);

      const metadata = { userId: 123, reason: 'Violated terms' };

      await logAdminAction({
        adminId: 2,
        action: 'user_banned',
        targetType: 'user',
        targetId: 123,
        metadata,
        ipAddress: '192.168.1.1',
      });

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('INSERT INTO admin_activity_log'),
        ]),
        2,
        'user_banned',
        'user',
        123,
        JSON.stringify(metadata),
        '192.168.1.1'
      );
    });

    test('should handle null values for optional fields', async () => {
      mockSql.mockResolvedValueOnce([]);

      await logAdminAction({
        adminId: 3,
        action: 'login',
        targetType: undefined,
        targetId: undefined,
        metadata: undefined,
        ipAddress: undefined,
      });

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('INSERT INTO admin_activity_log'),
        ]),
        3,
        'login',
        null,
        null,
        null,
        null
      );
    });

    test('should handle database errors silently without throwing', async () => {
      const dbError = new Error('Database connection failed');
      mockSql.mockRejectedValueOnce(dbError);

      // Should not throw
      await expect(
        logAdminAction({
          adminId: 4,
          action: 'payment_refunded',
        })
      ).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        '[Audit] Failed to log admin action:',
        dbError
      );
    });

    test('should serialize complex metadata objects', async () => {
      mockSql.mockResolvedValueOnce([]);

      const complexMetadata = {
        paymentId: 456,
        amount: 500,
        currency: 'RUB',
        refundReason: 'Failed generation',
        timestamp: new Date().toISOString(),
        nested: {
          detail: 'value',
          array: [1, 2, 3],
        },
      };

      await logAdminAction({
        adminId: 5,
        action: 'payment_refunded',
        targetType: 'payment',
        targetId: 456,
        metadata: complexMetadata,
      });

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('INSERT INTO admin_activity_log'),
        ]),
        5,
        'payment_refunded',
        'payment',
        456,
        JSON.stringify(complexMetadata),
        null
      );
    });

    test('should log different action types correctly', async () => {
      mockSql.mockResolvedValue([]);

      const actions: AuditAction[] = [
        'login',
        'logout',
        'user_banned',
        'payment_refunded',
        'settings_updated',
        'admin_created',
      ];

      for (const action of actions) {
        await logAdminAction({
          adminId: 1,
          action,
        });
      }

      expect(mockSql).toHaveBeenCalledTimes(actions.length);
    });

    test('should log different target types correctly', async () => {
      mockSql.mockResolvedValue([]);

      const targetTypes: AuditTargetType[] = [
        'user',
        'payment',
        'avatar',
        'generation',
        'referral',
        'withdrawal',
        'setting',
        'admin',
      ];

      for (const targetType of targetTypes) {
        await logAdminAction({
          adminId: 1,
          action: 'user_viewed',
          targetType,
          targetId: 1,
        });
      }

      expect(mockSql).toHaveBeenCalledTimes(targetTypes.length);
    });

    test('should handle empty metadata object', async () => {
      mockSql.mockResolvedValueOnce([]);

      await logAdminAction({
        adminId: 1,
        action: 'logout',
        metadata: {},
      });

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('INSERT INTO admin_activity_log'),
        ]),
        1,
        'logout',
        null,
        null,
        JSON.stringify({}),
        null
      );
    });
  });

  describe('getRecentActivity', () => {
    test('should return entries with default pagination', async () => {
      const mockEntries = [
        {
          id: 1,
          admin_id: 1,
          admin_email: 'admin@example.com',
          admin_name: 'Admin User',
          action: 'login',
          target_type: null,
          target_id: null,
          metadata: null,
          ip_address: '127.0.0.1',
          created_at: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: 2,
          admin_id: 2,
          admin_email: 'admin2@example.com',
          admin_name: 'Admin Two',
          action: 'user_banned',
          target_type: 'user',
          target_id: 123,
          metadata: { reason: 'Spam' },
          ip_address: '192.168.1.1',
          created_at: new Date('2025-01-01T11:00:00Z'),
        },
      ];

      const mockCount = [{ total: 50 }];

      mockSql.mockResolvedValueOnce(mockEntries);
      mockSql.mockResolvedValueOnce(mockCount);

      const result = await getRecentActivity();

      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(result.entries[0]).toEqual({
        id: 1,
        adminId: 1,
        adminEmail: 'admin@example.com',
        adminName: 'Admin User',
        action: 'login',
        targetType: null,
        targetId: null,
        metadata: null,
        ipAddress: '127.0.0.1',
        createdAt: new Date('2025-01-01T10:00:00Z'),
      });
    });

    test('should use default limit of 50 and offset of 0', async () => {
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValueOnce([{ total: 0 }]);

      await getRecentActivity();

      expect(mockSql).toHaveBeenNthCalledWith(
        1,
        expect.arrayContaining([expect.stringContaining('LIMIT')]),
        50,
        0
      );
    });

    test('should apply custom limit and offset', async () => {
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValueOnce([{ total: 0 }]);

      await getRecentActivity(100, 25);

      expect(mockSql).toHaveBeenNthCalledWith(
        1,
        expect.arrayContaining([expect.stringContaining('LIMIT')]),
        100,
        25
      );
    });

    test('should return total count', async () => {
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValueOnce([{ total: 250 }]);

      const result = await getRecentActivity();

      expect(result.total).toBe(250);
    });

    test('should include admin name in entries', async () => {
      const mockEntries = [
        {
          id: 1,
          admin_id: 1,
          admin_email: 'john.doe@example.com',
          admin_name: 'John Doe',
          action: 'login',
          target_type: null,
          target_id: null,
          metadata: null,
          ip_address: null,
          created_at: new Date('2025-01-01T10:00:00Z'),
        },
      ];

      mockSql.mockResolvedValueOnce(mockEntries);
      mockSql.mockResolvedValueOnce([{ total: 1 }]);

      const result = await getRecentActivity();

      expect(result.entries[0].adminName).toBe('John Doe');
      expect(result.entries[0].adminEmail).toBe('john.doe@example.com');
    });

    test('should handle missing admin information gracefully', async () => {
      const mockEntries = [
        {
          id: 1,
          admin_id: 999,
          admin_email: null,
          admin_name: null,
          action: 'login',
          target_type: null,
          target_id: null,
          metadata: null,
          ip_address: null,
          created_at: new Date('2025-01-01T10:00:00Z'),
        },
      ];

      mockSql.mockResolvedValueOnce(mockEntries);
      mockSql.mockResolvedValueOnce([{ total: 1 }]);

      const result = await getRecentActivity();

      expect(result.entries[0].adminEmail).toBe('unknown');
      expect(result.entries[0].adminName).toBe('Unknown');
    });

    test('should handle empty result set', async () => {
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValueOnce([{ total: 0 }]);

      const result = await getRecentActivity();

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    test('should parse JSON metadata correctly', async () => {
      const metadata = { userId: 123, reason: 'Spam', timestamp: '2025-01-01' };
      const mockEntries = [
        {
          id: 1,
          admin_id: 1,
          admin_email: 'admin@example.com',
          admin_name: 'Admin User',
          action: 'user_banned',
          target_type: 'user',
          target_id: 123,
          metadata: metadata,
          ip_address: null,
          created_at: new Date('2025-01-01T10:00:00Z'),
        },
      ];

      mockSql.mockResolvedValueOnce(mockEntries);
      mockSql.mockResolvedValueOnce([{ total: 1 }]);

      const result = await getRecentActivity();

      expect(result.entries[0].metadata).toEqual(metadata);
    });

    test('should convert created_at to Date object', async () => {
      const dateString = '2025-01-01T12:34:56.000Z';
      const mockEntries = [
        {
          id: 1,
          admin_id: 1,
          admin_email: 'admin@example.com',
          admin_name: 'Admin User',
          action: 'login',
          target_type: null,
          target_id: null,
          metadata: null,
          ip_address: null,
          created_at: dateString,
        },
      ];

      mockSql.mockResolvedValueOnce(mockEntries);
      mockSql.mockResolvedValueOnce([{ total: 1 }]);

      const result = await getRecentActivity();

      expect(result.entries[0].createdAt).toBeInstanceOf(Date);
      expect(result.entries[0].createdAt.toISOString()).toBe(dateString);
    });

    test('should handle database errors by throwing', async () => {
      const dbError = new Error('Database query failed');
      mockSql.mockRejectedValueOnce(dbError);

      await expect(getRecentActivity()).rejects.toThrow('Database query failed');
    });

    test('should handle large result sets with pagination', async () => {
      const mockEntries = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        admin_id: 1,
        admin_email: 'admin@example.com',
        admin_name: 'Admin User',
        action: 'login',
        target_type: null,
        target_id: null,
        metadata: null,
        ip_address: null,
        created_at: new Date('2025-01-01T10:00:00Z'),
      }));

      mockSql.mockResolvedValueOnce(mockEntries);
      mockSql.mockResolvedValueOnce([{ total: 1000 }]);

      const result = await getRecentActivity(100, 200);

      expect(result.entries).toHaveLength(100);
      expect(result.total).toBe(1000);
    });
  });

  describe('getActionDisplayName', () => {
    test('should return Russian name for login', () => {
      expect(getActionDisplayName('login')).toBe('Вход в систему');
    });

    test('should return Russian name for logout', () => {
      expect(getActionDisplayName('logout')).toBe('Выход из системы');
    });

    test('should return Russian name for user_banned', () => {
      expect(getActionDisplayName('user_banned')).toBe('Блокировка пользователя');
    });

    test('should return Russian name for user_unbanned', () => {
      expect(getActionDisplayName('user_unbanned')).toBe(
        'Разблокировка пользователя'
      );
    });

    test('should return Russian name for payment_refunded', () => {
      expect(getActionDisplayName('payment_refunded')).toBe('Возврат платежа');
    });

    test('should return Russian name for settings_updated', () => {
      expect(getActionDisplayName('settings_updated')).toBe('Обновление настроек');
    });

    test('should return action key for unknown action', () => {
      expect(getActionDisplayName('unknown_action' as AuditAction)).toBe(
        'unknown_action'
      );
    });

    test('should return Russian names for all auth actions', () => {
      expect(getActionDisplayName('login')).toBe('Вход в систему');
      expect(getActionDisplayName('logout')).toBe('Выход из системы');
      expect(getActionDisplayName('login_failed')).toBe('Неудачная попытка входа');
    });

    test('should return Russian names for user actions', () => {
      expect(getActionDisplayName('user_viewed')).toBe('Просмотр пользователя');
      expect(getActionDisplayName('user_granted_pro')).toBe('Выдача Pro статуса');
      expect(getActionDisplayName('user_revoked_pro')).toBe('Отзыв Pro статуса');
      expect(getActionDisplayName('user_message_sent')).toBe('Отправка сообщения');
    });

    test('should return Russian names for payment actions', () => {
      expect(getActionDisplayName('payment_viewed')).toBe('Просмотр платежа');
      expect(getActionDisplayName('payment_refunded')).toBe('Возврат платежа');
      expect(getActionDisplayName('payments_exported')).toBe('Экспорт платежей');
    });

    test('should return Russian names for legacy actions', () => {
      expect(getActionDisplayName('REFUND_CREATED')).toBe('Возврат создан');
      expect(getActionDisplayName('PAYMENT_VIEWED')).toBe('Платёж просмотрен');
      expect(getActionDisplayName('USER_VIEWED')).toBe('Пользователь просмотрен');
      expect(getActionDisplayName('LOGS_VIEWED')).toBe('Логи просмотрены');
      expect(getActionDisplayName('STATS_VIEWED')).toBe('Статистика просмотрена');
    });

    test('should return Russian names for generation actions', () => {
      expect(getActionDisplayName('generation_viewed')).toBe('Просмотр генерации');
      expect(getActionDisplayName('generation_retried')).toBe('Повтор генерации');
      expect(getActionDisplayName('generation_triggered')).toBe('Запуск генерации');
    });

    test('should return Russian names for referral actions', () => {
      expect(getActionDisplayName('withdrawal_approved')).toBe(
        'Одобрение выплаты'
      );
      expect(getActionDisplayName('withdrawal_rejected')).toBe(
        'Отклонение выплаты'
      );
    });

    test('should return Russian names for telegram actions', () => {
      expect(getActionDisplayName('telegram_message_retried')).toBe(
        'Повтор TG сообщения'
      );
      expect(getActionDisplayName('telegram_test_sent')).toBe(
        'Тестовое TG сообщение'
      );
    });

    test('should return Russian names for settings actions', () => {
      expect(getActionDisplayName('pricing_updated')).toBe('Обновление тарифов');
      expect(getActionDisplayName('feature_flag_toggled')).toBe(
        'Переключение функции'
      );
      expect(getActionDisplayName('maintenance_mode_changed')).toBe(
        'Изменение режима обслуживания'
      );
    });

    test('should return Russian names for admin management actions', () => {
      expect(getActionDisplayName('admin_created')).toBe(
        'Создание администратора'
      );
      expect(getActionDisplayName('admin_updated')).toBe(
        'Обновление администратора'
      );
      expect(getActionDisplayName('admin_deleted')).toBe(
        'Удаление администратора'
      );
      expect(getActionDisplayName('admin_role_changed')).toBe('Изменение роли');
    });

    test('should return Russian names for experiment actions', () => {
      expect(getActionDisplayName('experiment_created')).toBe(
        'Создание эксперимента'
      );
      expect(getActionDisplayName('experiment_started')).toBe(
        'Запуск эксперимента'
      );
      expect(getActionDisplayName('experiment_stopped')).toBe(
        'Остановка эксперимента'
      );
      expect(getActionDisplayName('experiment_updated')).toBe(
        'Обновление эксперимента'
      );
    });

    test('should handle empty string gracefully', () => {
      expect(getActionDisplayName('' as AuditAction)).toBe('');
    });
  });

  describe('Integration scenarios', () => {
    test('should log and retrieve admin action in sequence', async () => {
      // Log action
      mockSql.mockResolvedValueOnce([]);

      await logAdminAction({
        adminId: 1,
        action: 'user_banned',
        targetType: 'user',
        targetId: 123,
        metadata: { reason: 'Spam' },
      });

      // Retrieve recent activity
      const mockEntries = [
        {
          id: 1,
          admin_id: 1,
          admin_email: 'admin@example.com',
          admin_name: 'Admin User',
          action: 'user_banned',
          target_type: 'user',
          target_id: 123,
          metadata: { reason: 'Spam' },
          ip_address: null,
          created_at: new Date(),
        },
      ];

      mockSql.mockResolvedValueOnce(mockEntries);
      mockSql.mockResolvedValueOnce([{ total: 1 }]);

      const activity = await getRecentActivity(1);

      expect(activity.entries).toHaveLength(1);
      expect(activity.entries[0].action).toBe('user_banned');
      expect(activity.entries[0].targetId).toBe(123);
      expect(getActionDisplayName(activity.entries[0].action)).toBe(
        'Блокировка пользователя'
      );
    });

    test('should handle multiple actions with different display names', () => {
      const actions: AuditAction[] = [
        'login',
        'user_banned',
        'payment_refunded',
        'settings_updated',
      ];

      const displayNames = actions.map(getActionDisplayName);

      expect(displayNames).toEqual([
        'Вход в систему',
        'Блокировка пользователя',
        'Возврат платежа',
        'Обновление настроек',
      ]);
    });
  });
});
