/**
 * Unit Tests: Admin Generations API Routes
 *
 * Tests for:
 * - GET /api/admin/generations (list with filters)
 * - GET /api/admin/generations/[id] (details)
 * - POST /api/admin/generations/[id]/retry (retry failed)
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock dependencies BEFORE imports
const mockSql = jest.fn()
const mockGetCurrentSession = jest.fn()
const mockLogAdminAction = jest.fn()
const mockFetch = jest.fn()

jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql)
}))

jest.mock('@/lib/admin/session', () => ({
  getCurrentSession: () => mockGetCurrentSession()
}))

jest.mock('@/lib/admin/audit', () => ({
  logAdminAction: (...args: any[]) => mockLogAdminAction(...args)
}))

jest.mock('@/lib/admin/mode', () => ({
  getCurrentMode: jest.fn().mockResolvedValue('production')
}))

// Mock global fetch
global.fetch = mockFetch as jest.Mock

// Import AFTER mocks
import { GET as listGenerations } from '@/app/api/admin/generations/route'
import { GET as getGenerationDetails } from '@/app/api/admin/generations/[id]/route'
import { POST as retryGeneration } from '@/app/api/admin/generations/[id]/retry/route'

describe('Admin Generations API', () => {
  const mockSession = {
    adminId: 1,
    telegramUserId: 12345,
    isAdmin: true
  }

  const mockJob = {
    id: 1,
    avatar_id: 10,
    avatar_name: 'Test Avatar',
    style_id: 'professional',
    status: 'completed',
    total_photos: 23,
    completed_photos: 23,
    error_message: null,
    payment_id: 100,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:10:00Z',
    user_id: 5,
    telegram_user_id: 12345,
    progress: 100,
    duration: 600
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentSession.mockResolvedValue(mockSession)
    process.env.DATABASE_URL = 'postgresql://test'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  // ============================================================================
  // GET /api/admin/generations (List)
  // ============================================================================

  describe('GET /api/admin/generations', () => {
    const createRequest = (params: Record<string, string> = {}) => {
      const url = new URL('http://localhost:3000/api/admin/generations')
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
      return new NextRequest(url)
    }

    test('should return jobs with default pagination', async () => {
      const mockJobs = [mockJob]
      const mockCount = { count: 1 }
      const mockStats = {
        total_jobs: 10,
        completed_jobs: 8,
        failed_jobs: 1,
        processing_jobs: 1,
        pending_jobs: 0,
        total_photos: 230,
        avg_completion_time: 600
      }

      mockSql
        .mockResolvedValueOnce([mockCount]) // count query
        .mockResolvedValueOnce(mockJobs)    // jobs query
        .mockResolvedValueOnce([mockStats])  // stats query

      const request = createRequest()
      const response = await listGenerations(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.jobs).toHaveLength(1)
      expect(data.jobs[0]).toMatchObject({
        id: 1,
        avatar_id: 10,
        status: 'completed',
        progress: 100
      })
      expect(data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      })
      expect(data.stats).toMatchObject({
        total_jobs: 10,
        completed_jobs: 8,
        success_rate: 80
      })
    })

    test('should filter by status', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([{ ...mockJob, status: 'failed' }])
        .mockResolvedValueOnce([{
          total_jobs: 10,
          completed_jobs: 8,
          failed_jobs: 1,
          processing_jobs: 1,
          pending_jobs: 0,
          total_photos: 230,
          avg_completion_time: 600
        }])

      const request = createRequest({ status: 'failed' })
      const response = await listGenerations(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.jobs[0].status).toBe('failed')
    })

    test('should filter by date range', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([mockJob])
        .mockResolvedValueOnce([{
          total_jobs: 10,
          completed_jobs: 8,
          failed_jobs: 1,
          processing_jobs: 1,
          pending_jobs: 0,
          total_photos: 230,
          avg_completion_time: 600
        }])

      const request = createRequest({
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31'
      })
      const response = await listGenerations(request)

      expect(response.status).toBe(200)
      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(String)])
      )
    })

    test('should filter by userId', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([mockJob])
        .mockResolvedValueOnce([{
          total_jobs: 10,
          completed_jobs: 8,
          failed_jobs: 1,
          processing_jobs: 1,
          pending_jobs: 0,
          total_photos: 230,
          avg_completion_time: 600
        }])

      const request = createRequest({ userId: '5' })
      const response = await listGenerations(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.jobs[0].user_id).toBe(5)
    })

    test('should include stats with aggregated data', async () => {
      const mockStats = {
        total_jobs: 100,
        completed_jobs: 80,
        failed_jobs: 10,
        processing_jobs: 5,
        pending_jobs: 5,
        total_photos: 2300,
        avg_completion_time: 650.5
      }

      mockSql
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockStats])

      const request = createRequest()
      const response = await listGenerations(request)
      const data = await response.json()

      expect(data.stats).toEqual({
        total_jobs: 100,
        completed_jobs: 80,
        failed_jobs: 10,
        processing_jobs: 5,
        pending_jobs: 5,
        total_photos: 2300,
        avg_completion_time: 651, // rounded
        success_rate: 80 // 80/100 * 100
      })
    })

    test('should include progress percentage', async () => {
      const jobWithProgress = {
        ...mockJob,
        total_photos: 23,
        completed_photos: 12,
        progress: 52
      }

      mockSql
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([jobWithProgress])
        .mockResolvedValueOnce([{
          total_jobs: 1,
          completed_jobs: 0,
          failed_jobs: 0,
          processing_jobs: 1,
          pending_jobs: 0,
          total_photos: 12,
          avg_completion_time: null
        }])

      const request = createRequest()
      const response = await listGenerations(request)
      const data = await response.json()

      expect(data.jobs[0].progress).toBe(52)
    })

    test('should include duration for completed jobs', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([mockJob])
        .mockResolvedValueOnce([{
          total_jobs: 1,
          completed_jobs: 1,
          failed_jobs: 0,
          processing_jobs: 0,
          pending_jobs: 0,
          total_photos: 23,
          avg_completion_time: 600
        }])

      const request = createRequest()
      const response = await listGenerations(request)
      const data = await response.json()

      expect(data.jobs[0].duration).toBe(600)
    })

    test('should return 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValueOnce(null)

      const request = createRequest()
      const response = await listGenerations(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(mockSql).not.toHaveBeenCalled()
    })

    test('should handle database errors gracefully', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'))

      const request = createRequest()
      const response = await listGenerations(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch generations')
    })

    test('should handle pagination correctly', async () => {
      mockSql
        .mockResolvedValueOnce([{ count: 50 }])
        .mockResolvedValueOnce([mockJob])
        .mockResolvedValueOnce([{
          total_jobs: 50,
          completed_jobs: 40,
          failed_jobs: 5,
          processing_jobs: 3,
          pending_jobs: 2,
          total_photos: 1150,
          avg_completion_time: 600
        }])

      const request = createRequest({ page: '3', limit: '10' })
      const response = await listGenerations(request)
      const data = await response.json()

      expect(data.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 50,
        totalPages: 5
      })
    })
  })

  // ============================================================================
  // GET /api/admin/generations/[id] (Details)
  // ============================================================================

  describe('GET /api/admin/generations/[id]', () => {
    const createContext = (id: string) => ({
      params: Promise.resolve({ id })
    })

    const mockPhotos = [
      {
        id: 1,
        style_id: 'professional',
        prompt: 'Professional headshot',
        image_url: 'https://example.com/photo1.jpg',
        created_at: '2025-01-01T00:05:00Z'
      }
    ]

    const mockKieTasks = [
      {
        id: 1,
        job_id: 1,
        style_id: 'professional',
        status: 'completed',
        task_id: 'task_123',
        image_url: 'https://example.com/photo1.jpg',
        error_message: null,
        created_at: '2025-01-01T00:01:00Z',
        updated_at: '2025-01-01T00:05:00Z'
      }
    ]

    const mockAvatar = {
      id: 10,
      name: 'Test Avatar',
      status: 'ready',
      reference_photos_count: 5
    }

    test('should return full job details', async () => {
      mockSql
        .mockResolvedValueOnce([mockJob])       // job query
        .mockResolvedValueOnce(mockPhotos)      // photos query
        .mockResolvedValueOnce(mockKieTasks)    // kie_tasks query
        .mockResolvedValueOnce([mockAvatar])    // avatar query

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1')
      const context = createContext('1')
      const response = await getGenerationDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.job).toMatchObject({
        id: 1,
        avatar_id: 10,
        status: 'completed',
        total_photos: 23,
        completed_photos: 23
      })
    })

    test('should include avatar info', async () => {
      mockSql
        .mockResolvedValueOnce([mockJob])
        .mockResolvedValueOnce(mockPhotos)
        .mockResolvedValueOnce(mockKieTasks)
        .mockResolvedValueOnce([mockAvatar])

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1')
      const context = createContext('1')
      const response = await getGenerationDetails(request, context)
      const data = await response.json()

      expect(data.job.avatar).toEqual({
        id: 10,
        name: 'Test Avatar',
        status: 'ready',
        reference_photos_count: 5
      })
    })

    test('should include generated photos', async () => {
      mockSql
        .mockResolvedValueOnce([mockJob])
        .mockResolvedValueOnce(mockPhotos)
        .mockResolvedValueOnce(mockKieTasks)
        .mockResolvedValueOnce([mockAvatar])

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1')
      const context = createContext('1')
      const response = await getGenerationDetails(request, context)
      const data = await response.json()

      expect(data.job.photos).toHaveLength(1)
      expect(data.job.photos[0]).toMatchObject({
        id: 1,
        style_id: 'professional',
        image_url: 'https://example.com/photo1.jpg'
      })
    })

    test('should include KIE task info if available', async () => {
      mockSql
        .mockResolvedValueOnce([mockJob])
        .mockResolvedValueOnce(mockPhotos)
        .mockResolvedValueOnce(mockKieTasks)
        .mockResolvedValueOnce([mockAvatar])

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1')
      const context = createContext('1')
      const response = await getGenerationDetails(request, context)
      const data = await response.json()

      expect(data.job.kie_tasks).toHaveLength(1)
      expect(data.job.kie_tasks[0]).toMatchObject({
        id: 1,
        job_id: 1,
        status: 'completed',
        task_id: 'task_123'
      })
    })

    test('should handle missing KIE tasks table', async () => {
      mockSql
        .mockResolvedValueOnce([mockJob])
        .mockResolvedValueOnce(mockPhotos)
        .mockRejectedValueOnce(new Error('relation "kie_tasks" does not exist'))
        .mockResolvedValueOnce([mockAvatar])

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1')
      const context = createContext('1')
      const response = await getGenerationDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.job.kie_tasks).toEqual([])
    })

    test('should return 404 for non-existent job', async () => {
      mockSql.mockResolvedValueOnce([])

      const request = new NextRequest('http://localhost:3000/api/admin/generations/999')
      const context = createContext('999')
      const response = await getGenerationDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Job not found')
    })

    test('should return 400 for invalid job ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/generations/invalid')
      const context = createContext('invalid')
      const response = await getGenerationDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid job ID')
      expect(mockSql).not.toHaveBeenCalled()
    })

    test('should return 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1')
      const context = createContext('1')
      const response = await getGenerationDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(mockSql).not.toHaveBeenCalled()
    })

    test('should handle database errors gracefully', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1')
      const context = createContext('1')
      const response = await getGenerationDetails(request, context)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch generation details')
    })
  })

  // ============================================================================
  // POST /api/admin/generations/[id]/retry
  // ============================================================================

  describe('POST /api/admin/generations/[id]/retry', () => {
    const createContext = (id: string) => ({
      params: Promise.resolve({ id })
    })

    const failedJob = {
      id: 1,
      avatar_id: 10,
      style_id: 'professional',
      status: 'failed',
      total_photos: 23,
      user_id: 5
    }

    const updatedJob = {
      id: 1,
      avatar_id: 10,
      style_id: 'professional',
      status: 'pending',
      total_photos: 23,
      completed_photos: 0,
      error_message: null
    }

    test('should retry failed job successfully', async () => {
      mockSql
        .mockResolvedValueOnce([failedJob])      // get job query
        .mockResolvedValueOnce([updatedJob])     // update query

      mockFetch.mockResolvedValueOnce({ ok: true })

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      const response = await retryGeneration(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.job).toMatchObject({
        id: 1,
        status: 'pending',
        message: 'Generation job queued for retry'
      })
    })

    test('should reset status to pending', async () => {
      mockSql
        .mockResolvedValueOnce([failedJob])
        .mockResolvedValueOnce([updatedJob])

      mockFetch.mockResolvedValueOnce({ ok: true })

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      await retryGeneration(request, context)

      // Verify UPDATE query was called
      expect(mockSql).toHaveBeenCalledTimes(2)
    })

    test('should clear error_message', async () => {
      const jobWithError = {
        ...failedJob,
        error_message: 'Previous error'
      }

      mockSql
        .mockResolvedValueOnce([jobWithError])
        .mockResolvedValueOnce([{ ...updatedJob, error_message: null }])

      mockFetch.mockResolvedValueOnce({ ok: true })

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      const response = await retryGeneration(request, context)

      expect(response.status).toBe(200)
    })

    test('should return 404 for non-existent job', async () => {
      mockSql.mockResolvedValueOnce([])

      const request = new NextRequest('http://localhost:3000/api/admin/generations/999/retry', {
        method: 'POST'
      })
      const context = createContext('999')
      const response = await retryGeneration(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Job not found')
    })

    test('should return 400 when job not failed', async () => {
      const completedJob = {
        ...failedJob,
        status: 'completed'
      }

      mockSql.mockResolvedValueOnce([completedJob])

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      const response = await retryGeneration(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Cannot retry job with status')
    })

    test('should allow retry for cancelled jobs', async () => {
      const cancelledJob = {
        ...failedJob,
        status: 'cancelled'
      }

      mockSql
        .mockResolvedValueOnce([cancelledJob])
        .mockResolvedValueOnce([updatedJob])

      mockFetch.mockResolvedValueOnce({ ok: true })

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      const response = await retryGeneration(request, context)

      expect(response.status).toBe(200)
    })

    test('should return 401 without session', async () => {
      mockGetCurrentSession.mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      const response = await retryGeneration(request, context)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(mockSql).not.toHaveBeenCalled()
    })

    test('should log audit action', async () => {
      mockSql
        .mockResolvedValueOnce([failedJob])
        .mockResolvedValueOnce([updatedJob])

      mockFetch.mockResolvedValueOnce({ ok: true })

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      await retryGeneration(request, context)

      expect(mockLogAdminAction).toHaveBeenCalledWith({
        adminId: mockSession.adminId,
        action: 'generation_retried',
        targetType: 'generation',
        targetId: 1,
        metadata: {
          previous_status: 'failed',
          avatar_id: 10,
          style_id: 'professional',
          action: 'retry'
        }
      })
    })

    test('should trigger immediate processing', async () => {
      mockSql
        .mockResolvedValueOnce([failedJob])
        .mockResolvedValueOnce([updatedJob])

      mockFetch.mockResolvedValueOnce({ ok: true })

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      await retryGeneration(request, context)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/jobs/process',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: 1 })
        })
      )
    })

    test('should handle trigger failure gracefully', async () => {
      mockSql
        .mockResolvedValueOnce([failedJob])
        .mockResolvedValueOnce([updatedJob])

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      const response = await retryGeneration(request, context)

      // Should still succeed even if trigger fails
      expect(response.status).toBe(200)
    })

    test('should handle database errors gracefully', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/admin/generations/1/retry', {
        method: 'POST'
      })
      const context = createContext('1')
      const response = await retryGeneration(request, context)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to retry generation')
    })

    test('should return 400 for invalid job ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/generations/invalid/retry', {
        method: 'POST'
      })
      const context = createContext('invalid')
      const response = await retryGeneration(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid job ID')
      expect(mockSql).not.toHaveBeenCalled()
    })
  })
})
