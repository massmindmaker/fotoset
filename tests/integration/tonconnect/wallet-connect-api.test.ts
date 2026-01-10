/**
 * Integration tests for Wallet Connect API
 * Tests POST/GET/DELETE /api/wallet/connect endpoints
 */

import { NextRequest } from 'next/server'
import { GET, POST, DELETE } from '@/app/api/wallet/connect/route'
import { sql } from '@/lib/db'

// Mock the database
jest.mock('@/lib/db', () => ({
  sql: jest.fn(),
}))

// Mock telegram-auth
jest.mock('@/lib/telegram-auth', () => ({
  validateTelegramInitData: jest.fn(),
}))

import { validateTelegramInitData } from '@/lib/telegram-auth'

const mockSql = sql as jest.MockedFunction<typeof sql>
const mockValidate = validateTelegramInitData as jest.MockedFunction<typeof validateTelegramInitData>

// Test data
const validWalletAddress = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2'
const validRawAddress = '0:ed169130705004711b9998b561d8de82d31fbf84910ced6eb5fc92e7485ef8a7'
const invalidAddress = 'not-a-valid-address'
const testUserId = 12345
const testNeonUserId = 'neon_user_123'

// Helper to create request
function createRequest(method: string, body?: object, searchParams?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/wallet/connect')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('POST /api/wallet/connect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authentication', () => {
    it('should reject request without initData', async () => {
      const request = createRequest('POST', {
        walletAddress: validWalletAddress,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('initData')
    })

    it('should reject request with invalid initData', async () => {
      mockValidate.mockReturnValue(null)

      const request = createRequest('POST', {
        initData: 'invalid_data',
        walletAddress: validWalletAddress,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBeDefined()
    })
  })

  describe('Address validation', () => {
    beforeEach(() => {
      mockValidate.mockReturnValue({
        user: { id: testUserId, username: 'testuser' },
        auth_date: Date.now() / 1000,
        hash: 'test_hash',
      })
    })

    it('should accept valid EQ format address', async () => {
      mockSql.mockResolvedValueOnce([]) // No existing wallet
      mockSql.mockResolvedValueOnce([{ id: 1 }]) // User update

      const request = createRequest('POST', {
        initData: 'valid_init_data',
        walletAddress: validWalletAddress,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.walletAddress).toBe(validWalletAddress)
    })

    it('should accept valid raw format address', async () => {
      mockSql.mockResolvedValueOnce([]) // No existing wallet
      mockSql.mockResolvedValueOnce([{ id: 1 }]) // User update

      const request = createRequest('POST', {
        initData: 'valid_init_data',
        walletAddress: validRawAddress,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid address format', async () => {
      const request = createRequest('POST', {
        initData: 'valid_init_data',
        walletAddress: invalidAddress,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should reject empty address', async () => {
      const request = createRequest('POST', {
        initData: 'valid_init_data',
        walletAddress: '',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
    })
  })

  describe('Wallet conflict handling', () => {
    beforeEach(() => {
      mockValidate.mockReturnValue({
        user: { id: testUserId, username: 'testuser' },
        auth_date: Date.now() / 1000,
        hash: 'test_hash',
      })
    })

    it('should reject if wallet already connected to another user', async () => {
      mockSql.mockResolvedValueOnce([{ id: 999, telegram_user_id: 999 }]) // Different user

      const request = createRequest('POST', {
        initData: 'valid_init_data',
        walletAddress: validWalletAddress,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409) // Conflict
      expect(data.error).toContain('already')
    })

    it('should allow re-connecting same wallet for same user', async () => {
      mockSql.mockResolvedValueOnce([{ id: 1, telegram_user_id: testUserId }]) // Same user
      mockSql.mockResolvedValueOnce([{ id: 1 }]) // Update

      const request = createRequest('POST', {
        initData: 'valid_init_data',
        walletAddress: validWalletAddress,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})

describe('GET /api/wallet/connect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return wallet status for authenticated user', async () => {
    mockValidate.mockReturnValue({
      user: { id: testUserId, username: 'testuser' },
      auth_date: Date.now() / 1000,
      hash: 'test_hash',
    })

    mockSql.mockResolvedValueOnce([{
      ton_wallet_address: validWalletAddress,
      wallet_connected_at: new Date().toISOString(),
    }])

    const request = createRequest('GET', undefined, {
      initData: 'valid_init_data',
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.connected).toBe(true)
    expect(data.walletAddress).toBe(validWalletAddress)
    expect(data.connectedAt).toBeDefined()
  })

  it('should return connected=false when no wallet', async () => {
    mockValidate.mockReturnValue({
      user: { id: testUserId, username: 'testuser' },
      auth_date: Date.now() / 1000,
      hash: 'test_hash',
    })

    mockSql.mockResolvedValueOnce([{
      ton_wallet_address: null,
      wallet_connected_at: null,
    }])

    const request = createRequest('GET', undefined, {
      initData: 'valid_init_data',
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.connected).toBe(false)
    expect(data.walletAddress).toBeNull()
  })

  it('should reject unauthenticated request', async () => {
    const request = createRequest('GET')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
  })
})

describe('DELETE /api/wallet/connect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockValidate.mockReturnValue({
      user: { id: testUserId, username: 'testuser' },
      auth_date: Date.now() / 1000,
      hash: 'test_hash',
    })
  })

  it('should disconnect wallet for authenticated user', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1 }]) // User exists
    mockSql.mockResolvedValueOnce([]) // Update successful

    const request = createRequest('DELETE', {
      initData: 'valid_init_data',
    })

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toContain('disconnected')
  })

  it('should handle already disconnected wallet gracefully', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, ton_wallet_address: null }])
    mockSql.mockResolvedValueOnce([])

    const request = createRequest('DELETE', {
      initData: 'valid_init_data',
    })

    const response = await DELETE(request)
    const data = await response.json()

    // Should still succeed even if no wallet was connected
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should reject unauthenticated request', async () => {
    mockValidate.mockReturnValue(null)

    const request = createRequest('DELETE', {})

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(401)
  })
})

describe('Edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockValidate.mockReturnValue({
      user: { id: testUserId, username: 'testuser' },
      auth_date: Date.now() / 1000,
      hash: 'test_hash',
    })
  })

  it('should handle database errors gracefully', async () => {
    mockSql.mockRejectedValueOnce(new Error('Database connection failed'))

    const request = createRequest('POST', {
      initData: 'valid_init_data',
      walletAddress: validWalletAddress,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('should handle missing user in database', async () => {
    mockSql.mockResolvedValueOnce([]) // No existing wallet
    mockSql.mockResolvedValueOnce([]) // No user found

    const request = createRequest('GET', undefined, {
      initData: 'valid_init_data',
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(404)
  })
})
