/**
 * Unit Tests: Admin Telegram Queue API Routes
 *
 * Tests for:
 * - GET /api/admin/telegram (queue stats and messages)
 * - POST /api/admin/telegram/send (send manual message)
 * - POST /api/admin/telegram/[id]/retry (retry failed message)
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock dependencies BEFORE imports
const mockSql = jest.fn()
const mockGetCurrentSession = jest.fn()
const mockLogAdminAction = jest.fn()

jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql)
}))

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: () => mockGetCurrentSession()
}))

jest.mock('@/lib/admin/audit', () => ({
  logAdminAction: (...args: any[]) => mockLogAdminAction(...args)
}))

// Import AFTER mocks
import { GET as getTelegramQueue } from '@/app/api/admin/telegram/route'
import { POST as sendTelegramMessage } from '@/app/api/admin/telegram/send/route'
import { POST as retryTelegramMessage } from '@/app/api/admin/telegram/[id]/retry/route'

describe('Admin Telegram Queue API', () => {
  const mockSession = {
    adminId: 1,
    telegramUserId: 12345,
    isAdmin: true
  }

  const mockMessage = {
    id: 1,
    telegram_chat_id: '12345',
    message_type: 'admin_notification',
    photo_url: null,
    caption: 'Test message',
    status: 'pending',
    attempts: 0,
    error_message: null,
    created_at: '2025-01-01T00:00:00Z',
    sent_at: null,
    user_id: 5,
    telegram_user_id: '12345'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentSession.mockResolvedValue(mockSession)
    process.env.DATABASE_URL = 'postgresql://test'
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
  })

  // ============================================================================
  // GET /api/admin/telegram (Queue Stats & List)
  // ============================================================================

  describe('GET /api/admin/telegram', () => {
    const createRequest = (params: Record<string, string> = {}) => {
      const url = new URL('http://localhost:3000/api/admin/telegram')
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
      return new NextRequest(url)
    }

    test('should return queue stats and messages with default pagination', async () => {
      const mockStats = {
        pending: 5,
        sent: 20,
        failed: 2,
        retry: 1,
        total: 28
      }
      const mockCount = { count: 28 }
      const mockMessages = [mockMessage]

      mockSql
        .mockResolvedValueOnce([{ exists: true }]) // table check
        .mockResolvedValueOnce([mockStats])        // stats query
        .mockResolvedValueOnce([mockCount])        // count query
        .mockResolvedValueOnce(mockMessages)       // messages query

      const request = createRequest()
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.stats).toMatchObject({
        pending: 5,
        sent: 20,
        failed: 2,
        retry: 1,
        total: 28,
        success_rate: (20 / 28) * 100
      })
      expect(data.messages).toHaveLength(1)
      expect(data.messages[0]).toMatchObject({
        id: 1,
        telegram_user_id: '12345',
        message_type: 'admin_notification',
        status: 'pending',
        retry_count: 0
      })
      expect(data.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 28,
        totalPages: 1
      })
    })

    test('should filter messages by status', async () => {
      const mockStats = { pending: 5, sent: 20, failed: 2, retry: 1, total: 28 }
      const mockCount = { count: 2 }
      const mockFailedMessages = [
        { ...mockMessage, status: 'failed', error_message: 'Network error' }
      ]

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([mockStats])
        .mockResolvedValueOnce([mockCount])
        .mockResolvedValueOnce(mockFailedMessages)

      const request = createRequest({ status: 'failed' })
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.messages).toHaveLength(1)
      expect(data.messages[0].status).toBe('failed')
      expect(data.pagination.total).toBe(2)
    })

    test('should paginate results correctly', async () => {
      const mockStats = { pending: 5, sent: 20, failed: 2, retry: 1, total: 28 }
      const mockCount = { count: 100 }
      const mockMessages = Array(20).fill(mockMessage)

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([mockStats])
        .mockResolvedValueOnce([mockCount])
        .mockResolvedValueOnce(mockMessages)

      const request = createRequest({ page: '2', limit: '20' })
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 100,
        totalPages: 5
      })
    })

    test('should calculate success_rate correctly', async () => {
      const mockStats = { pending: 0, sent: 15, failed: 5, retry: 0, total: 20 }
      const mockCount = { count: 20 }

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([mockStats])
        .mockResolvedValueOnce([mockCount])
        .mockResolvedValueOnce([])

      const request = createRequest()
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(data.stats.success_rate).toBe(75) // 15 sent / 20 total = 75%
    })

    test('should handle zero total with success_rate', async () => {
      const mockStats = { pending: 0, sent: 0, failed: 0, retry: 0, total: 0 }
      const mockCount = { count: 0 }

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([mockStats])
        .mockResolvedValueOnce([mockCount])
        .mockResolvedValueOnce([])

      const request = createRequest()
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(data.stats.success_rate).toBe(0)
      expect(data.stats.total).toBe(0)
    })

    test('should include user info in messages', async () => {
      const mockStats = { pending: 1, sent: 0, failed: 0, retry: 0, total: 1 }
      const mockCount = { count: 1 }
      const mockMessagesWithUser = [
        {
          ...mockMessage,
          user_id: 5,
          telegram_user_id: '98765'
        }
      ]

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([mockStats])
        .mockResolvedValueOnce([mockCount])
        .mockResolvedValueOnce(mockMessagesWithUser)

      const request = createRequest()
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(data.messages[0].user_id).toBe(5)
      expect(data.messages[0].telegram_user_id).toBe('98765')
    })

    test('should return empty data when table does not exist', async () => {
      mockSql.mockResolvedValueOnce([{ exists: false }])

      const request = createRequest()
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.stats).toEqual({
        pending: 0,
        sent: 0,
        failed: 0,
        retry: 0,
        total: 0,
        success_rate: 0
      })
      expect(data.messages).toEqual([])
      expect(data.pagination.total).toBe(0)
    })

    test('should return 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValueOnce(null)

      const request = createRequest()
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should handle database errors', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database error'))

      const request = createRequest()
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch telegram queue')
    })

    test('should validate and sanitize status parameter', async () => {
      const mockStats = { pending: 1, sent: 0, failed: 0, retry: 0, total: 1 }
      const mockCount = { count: 1 }

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([mockStats])
        .mockResolvedValueOnce([mockCount])
        .mockResolvedValueOnce([mockMessage])

      // Invalid status should be ignored
      const request = createRequest({ status: 'invalid_status' })
      const response = await getTelegramQueue(request)

      expect(response.status).toBe(200)
      // Should query without status filter
    })

    test('should enforce pagination limits', async () => {
      const mockStats = { pending: 1, sent: 0, failed: 0, retry: 0, total: 1 }
      const mockCount = { count: 1 }

      mockSql
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([mockStats])
        .mockResolvedValueOnce([mockCount])
        .mockResolvedValueOnce([mockMessage])

      // Request more than max limit (100)
      const request = createRequest({ limit: '200' })
      const response = await getTelegramQueue(request)
      const data = await response.json()

      expect(data.pagination.limit).toBe(100) // Capped at max
    })
  })

  // ============================================================================
  // POST /api/admin/telegram/send (Send Manual Message)
  // ============================================================================

  describe('POST /api/admin/telegram/send', () => {
    const createRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/admin/telegram/send', {
        method: 'POST',
        body: JSON.stringify(body)
      })
    }

    test('should send test message successfully', async () => {
      const mockUser = { id: 5 }
      const mockNewMessage = { id: 10 }

      mockSql
        .mockResolvedValueOnce([mockUser])           // find user
        .mockResolvedValueOnce([{ exists: true }])   // table check
        .mockResolvedValueOnce([mockNewMessage])     // insert message

      const request = createRequest({
        telegramUserId: '12345',
        message: 'Hello, this is a test message'
      })
      const response = await sendTelegramMessage(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.messageId).toBe(10)

      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: 1,
        action: 'telegram_test_sent',
        targetId: 10,
        metadata: expect.objectContaining({
          user_id: 5,
          telegram_user_id: '12345',
          message_type: 'admin_notification',
          message_preview: 'Hello, this is a test message'
        })
      })
    })

    test('should create table if it does not exist', async () => {
      const mockUser = { id: 5 }
      const mockNewMessage = { id: 10 }

      mockSql
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ exists: false }])  // table doesn't exist
        .mockResolvedValueOnce([])                   // CREATE TABLE
        .mockResolvedValueOnce([mockNewMessage])

      const request = createRequest({
        telegramUserId: '12345',
        message: 'Test'
      })
      const response = await sendTelegramMessage(request)

      expect(response.status).toBe(200)
      expect(mockSql).toHaveBeenCalledTimes(4)
    })

    test('should support custom message type', async () => {
      const mockUser = { id: 5 }
      const mockNewMessage = { id: 10 }

      mockSql
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([mockNewMessage])

      const request = createRequest({
        telegramUserId: '12345',
        message: 'Custom notification',
        messageType: 'custom_alert'
      })
      const response = await sendTelegramMessage(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            message_type: 'custom_alert'
          })
        })
      )
    })

    test('should truncate long messages in audit log preview', async () => {
      const mockUser = { id: 5 }
      const mockNewMessage = { id: 10 }
      const longMessage = 'A'.repeat(150)

      mockSql
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([mockNewMessage])

      const request = createRequest({
        telegramUserId: '12345',
        message: longMessage
      })
      const response = await sendTelegramMessage(request)

      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            message_preview: longMessage.substring(0, 100)
          })
        })
      )
    })

    test('should return 400 when telegramUserId is missing', async () => {
      const request = createRequest({
        message: 'Test message'
      })
      const response = await sendTelegramMessage(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('telegramUserId and message are required')
    })

    test('should return 400 when message is missing', async () => {
      const request = createRequest({
        telegramUserId: '12345'
      })
      const response = await sendTelegramMessage(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('telegramUserId and message are required')
    })

    test('should return 404 when user not found', async () => {
      mockSql.mockResolvedValueOnce([]) // no user found

      const request = createRequest({
        telegramUserId: '99999',
        message: 'Test'
      })
      const response = await sendTelegramMessage(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('User not found')
    })

    test('should return 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValueOnce(null)

      const request = createRequest({
        telegramUserId: '12345',
        message: 'Test'
      })
      const response = await sendTelegramMessage(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should handle database errors', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database error'))

      const request = createRequest({
        telegramUserId: '12345',
        message: 'Test'
      })
      const response = await sendTelegramMessage(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to send message')
    })
  })

  // ============================================================================
  // POST /api/admin/telegram/[id]/retry (Retry Failed Message)
  // ============================================================================

  describe('POST /api/admin/telegram/[id]/retry', () => {
    const createRequest = (id: string) => {
      return new NextRequest(`http://localhost:3000/api/admin/telegram/${id}/retry`, {
        method: 'POST'
      })
    }

    test('should retry failed message successfully', async () => {
      const mockFailedMessage = {
        ...mockMessage,
        status: 'failed',
        retry_count: 2,
        error_message: 'Network timeout'
      }

      mockSql
        .mockResolvedValueOnce([mockFailedMessage]) // get message
        .mockResolvedValueOnce([])                   // update message

      const request = createRequest('1')
      const response = await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '1' })
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.messageId).toBe(1)

      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: 1,
        action: 'telegram_message_retried',
        targetId: 1,
        metadata: {
          user_id: mockFailedMessage.user_id,
          message_type: mockFailedMessage.message_type,
          previous_retry_count: 2
        }
      })
    })

    test('should increment retry_count', async () => {
      const mockFailedMessage = {
        ...mockMessage,
        status: 'failed',
        retry_count: 0
      }

      mockSql
        .mockResolvedValueOnce([mockFailedMessage])
        .mockResolvedValueOnce([])

      const request = createRequest('1')
      await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '1' })
      })

      // Check that update SQL was called (second call)
      const updateCall = mockSql.mock.calls[1]
      const sqlQuery = updateCall[0].join('')
      expect(sqlQuery).toContain('retry_count = retry_count + 1')
    })

    test('should reset status to pending', async () => {
      const mockFailedMessage = {
        ...mockMessage,
        status: 'failed'
      }

      mockSql
        .mockResolvedValueOnce([mockFailedMessage])
        .mockResolvedValueOnce([])

      const request = createRequest('1')
      await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '1' })
      })

      // Check that update SQL was called (second call)
      const updateCall = mockSql.mock.calls[1]
      const sqlQuery = updateCall[0].join('')
      expect(sqlQuery).toContain("status = 'pending'")
    })

    test('should clear error_message', async () => {
      const mockFailedMessage = {
        ...mockMessage,
        status: 'failed',
        error_message: 'Previous error'
      }

      mockSql
        .mockResolvedValueOnce([mockFailedMessage])
        .mockResolvedValueOnce([])

      const request = createRequest('1')
      await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '1' })
      })

      // Check that update SQL was called (second call)
      const updateCall = mockSql.mock.calls[1]
      const sqlQuery = updateCall[0].join('')
      expect(sqlQuery).toContain('error_message = NULL')
    })

    test('should return 404 for non-existent message', async () => {
      mockSql.mockResolvedValueOnce([]) // no message found

      const request = createRequest('999')
      const response = await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '999' })
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Message not found')
    })

    test('should return 400 when message status is not failed', async () => {
      const mockPendingMessage = {
        ...mockMessage,
        status: 'pending'
      }

      mockSql.mockResolvedValueOnce([mockPendingMessage])

      const request = createRequest('1')
      const response = await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '1' })
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Cannot retry message with status: pending')
    })

    test('should return 400 when retry count exceeds maximum', async () => {
      const mockMaxRetriesMessage = {
        ...mockMessage,
        status: 'failed',
        retry_count: 5 // MAX_RETRIES
      }

      mockSql.mockResolvedValueOnce([mockMaxRetriesMessage])

      const request = createRequest('1')
      const response = await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '1' })
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Maximum retry count (5) exceeded for this message')
    })

    test('should return 400 for invalid message ID', async () => {
      const request = createRequest('invalid')
      const response = await retryTelegramMessage(request, {
        params: Promise.resolve({ id: 'invalid' })
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid message ID')
    })

    test('should return 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValueOnce(null)

      const request = createRequest('1')
      const response = await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '1' })
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should log audit action on successful retry', async () => {
      const mockFailedMessage = {
        ...mockMessage,
        id: 42,
        user_id: 10,
        message_type: 'photo',
        status: 'failed',
        retry_count: 1
      }

      mockSql
        .mockResolvedValueOnce([mockFailedMessage])
        .mockResolvedValueOnce([])

      const request = createRequest('42')
      await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '42' })
      })

      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: 1,
        action: 'telegram_message_retried',
        targetId: 42,
        metadata: {
          user_id: 10,
          message_type: 'photo',
          previous_retry_count: 1
        }
      })
    })

    test('should handle database errors', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database error'))

      const request = createRequest('1')
      const response = await retryTelegramMessage(request, {
        params: Promise.resolve({ id: '1' })
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to retry message')
    })
  })
})
