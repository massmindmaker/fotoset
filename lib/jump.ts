/**
 * Jump.Finance API Client
 *
 * Provides integration with Jump.Finance for:
 * - SBP (Система Быстрых Платежей) payouts
 * - Self-employed (НПД) verification via FNS
 * - Automatic fiscal receipts for self-employed
 *
 * Fee structure:
 * - Self-employed (verified НПД): ~3%
 * - Regular individuals: ~6% (requires NDFL handling)
 *
 * API Documentation: https://docs.jump.finance/api
 */

const JUMP_API_URL = process.env.JUMP_BASE_URL || 'https://api.jump.finance/v1'
const JUMP_API_KEY = process.env.JUMP_API_KEY || ''
const JUMP_SECRET_KEY = process.env.JUMP_SECRET_KEY || ''

// ============================================================
// Types
// ============================================================

export interface JumpConfig {
  apiKey: string
  secretKey: string
  baseUrl: string
}

export interface PayoutRequest {
  orderId: string           // Our withdrawal.id
  recipientPhone: string    // Phone for SBP (format: +79991234567)
  amount: number            // Amount in rubles
  description: string       // Payment description
  inn?: string              // INN for self-employed (lower fees)
  recipientName?: string    // Full name for receipt
}

export interface PayoutResponse {
  success: boolean
  jumpPayoutId?: string
  receiptUrl?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  errorCode?: string
}

export interface PayoutStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  jumpPayoutId: string
  amount: number
  completedAt?: string
  receiptUrl?: string
  error?: string
}

export interface SelfEmployedVerification {
  verified: boolean
  status: 'active' | 'inactive' | 'not_found'
  inn?: string
  fullName?: string
  registrationDate?: string
  regionCode?: string
  error?: string
}

export interface FeeEstimate {
  grossAmount: number       // Amount before fees
  feeAmount: number         // Fee amount
  feePercent: number        // Fee percentage
  netAmount: number         // Amount recipient receives
  isSelfEmployed: boolean   // Whether self-employed rate applied
}

// ============================================================
// Helper Functions
// ============================================================

function isConfigured(): boolean {
  return Boolean(JUMP_API_KEY && JUMP_SECRET_KEY)
}

/**
 * Generate HMAC signature for Jump.Finance API requests
 */
function generateSignature(body: string, timestamp: string): string {
  // In production, use crypto to generate HMAC-SHA256 signature
  // For now, returning placeholder - implement based on Jump.Finance docs
  const crypto = require('crypto')
  const message = `${timestamp}.${body}`
  const signature = crypto
    .createHmac('sha256', JUMP_SECRET_KEY)
    .update(message)
    .digest('hex')
  return signature
}

/**
 * Make authenticated request to Jump.Finance API
 */
async function makeRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${JUMP_API_URL}${endpoint}`
  const timestamp = new Date().toISOString()
  const bodyString = body ? JSON.stringify(body) : ''

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': JUMP_API_KEY,
    'X-Timestamp': timestamp,
    'X-Signature': generateSignature(bodyString, timestamp),
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? bodyString : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Jump.Finance API error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ============================================================
// Jump.Finance Client Class
// ============================================================

export class JumpFinance {
  private apiKey: string
  private secretKey: string
  private baseUrl: string

  constructor(config?: Partial<JumpConfig>) {
    this.apiKey = config?.apiKey || JUMP_API_KEY
    this.secretKey = config?.secretKey || JUMP_SECRET_KEY
    this.baseUrl = config?.baseUrl || JUMP_API_URL

    if (!this.apiKey || !this.secretKey) {
      console.warn('[JumpFinance] API credentials not configured - payouts will fail')
    }
  }

  /**
   * Check if Jump.Finance is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.secretKey)
  }

  /**
   * Verify self-employed status via FNS (Federal Tax Service)
   *
   * @param inn - Individual Tax Number (ИНН) - 12 digits
   * @returns Verification result with status and registration info
   */
  async verifySelfEmployed(inn: string): Promise<SelfEmployedVerification> {
    if (!this.isConfigured()) {
      return {
        verified: false,
        status: 'not_found',
        error: 'Jump.Finance not configured',
      }
    }

    // Validate INN format (12 digits for individuals)
    if (!/^\d{12}$/.test(inn)) {
      return {
        verified: false,
        status: 'not_found',
        error: 'Invalid INN format. Must be 12 digits.',
      }
    }

    try {
      console.log('[JumpFinance] Verifying self-employed status', { inn: inn.slice(0, 4) + '****' })

      const response = await makeRequest<{
        success: boolean
        data?: {
          status: 'active' | 'inactive'
          fullName: string
          registrationDate: string
          regionCode: string
        }
        error?: string
      }>('/npd/verify', 'POST', { inn })

      if (!response.success || !response.data) {
        return {
          verified: false,
          status: 'not_found',
          error: response.error || 'Verification failed',
        }
      }

      const isActive = response.data.status === 'active'

      console.log('[JumpFinance] Self-employed verification result', {
        inn: inn.slice(0, 4) + '****',
        status: response.data.status,
        verified: isActive,
      })

      return {
        verified: isActive,
        status: response.data.status,
        inn,
        fullName: response.data.fullName,
        registrationDate: response.data.registrationDate,
        regionCode: response.data.regionCode,
      }
    } catch (error) {
      console.error('[JumpFinance] Self-employed verification error:', error)
      return {
        verified: false,
        status: 'not_found',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Create a payout via SBP (Fast Payment System)
   *
   * @param request - Payout request details
   * @returns Payout result with Jump payout ID and status
   */
  async createPayout(request: PayoutRequest): Promise<PayoutResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Jump.Finance not configured',
        errorCode: 'NOT_CONFIGURED',
      }
    }

    // Validate phone format
    const phoneRegex = /^\+7\d{10}$/
    if (!phoneRegex.test(request.recipientPhone)) {
      return {
        success: false,
        error: 'Invalid phone format. Use +7XXXXXXXXXX',
        errorCode: 'INVALID_PHONE',
      }
    }

    // Validate amount (minimum 100 RUB, maximum 600,000 RUB per transaction)
    if (request.amount < 100) {
      return {
        success: false,
        error: 'Minimum payout amount is 100 RUB',
        errorCode: 'AMOUNT_TOO_LOW',
      }
    }

    if (request.amount > 600000) {
      return {
        success: false,
        error: 'Maximum payout amount is 600,000 RUB',
        errorCode: 'AMOUNT_TOO_HIGH',
      }
    }

    try {
      console.log('[JumpFinance] Creating payout', {
        orderId: request.orderId,
        amount: request.amount,
        phone: request.recipientPhone.slice(0, 4) + '****',
        hasSelfEmployed: Boolean(request.inn),
      })

      const response = await makeRequest<{
        success: boolean
        data?: {
          payoutId: string
          status: 'pending' | 'processing'
          receiptUrl?: string
        }
        error?: {
          code: string
          message: string
        }
      }>('/payouts/sbp', 'POST', {
        orderId: request.orderId,
        phone: request.recipientPhone,
        amount: Math.round(request.amount * 100), // Amount in kopeks
        description: request.description,
        inn: request.inn,
        recipientName: request.recipientName,
      })

      if (!response.success || !response.data) {
        console.error('[JumpFinance] Payout creation failed:', response.error)
        return {
          success: false,
          error: response.error?.message || 'Payout creation failed',
          errorCode: response.error?.code,
        }
      }

      console.log('[JumpFinance] Payout created successfully', {
        orderId: request.orderId,
        jumpPayoutId: response.data.payoutId,
        status: response.data.status,
      })

      return {
        success: true,
        jumpPayoutId: response.data.payoutId,
        status: response.data.status,
        receiptUrl: response.data.receiptUrl,
      }
    } catch (error) {
      console.error('[JumpFinance] Payout creation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'API_ERROR',
      }
    }
  }

  /**
   * Get payout status
   *
   * @param jumpPayoutId - Jump.Finance payout ID
   * @returns Current payout status
   */
  async getPayoutStatus(jumpPayoutId: string): Promise<PayoutStatusResponse> {
    if (!this.isConfigured()) {
      throw new Error('Jump.Finance not configured')
    }

    try {
      console.log('[JumpFinance] Getting payout status', { jumpPayoutId })

      const response = await makeRequest<{
        success: boolean
        data?: {
          payoutId: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          amount: number
          completedAt?: string
          receiptUrl?: string
          error?: string
        }
      }>(`/payouts/${jumpPayoutId}`)

      if (!response.success || !response.data) {
        throw new Error('Failed to get payout status')
      }

      return {
        jumpPayoutId: response.data.payoutId,
        status: response.data.status,
        amount: response.data.amount / 100, // Convert from kopeks
        completedAt: response.data.completedAt,
        receiptUrl: response.data.receiptUrl,
        error: response.data.error,
      }
    } catch (error) {
      console.error('[JumpFinance] Get payout status error:', error)
      throw error
    }
  }

  /**
   * Estimate payout fees
   *
   * @param amount - Gross amount in rubles
   * @param isSelfEmployed - Whether recipient is verified self-employed
   * @returns Fee breakdown
   */
  estimateFees(amount: number, isSelfEmployed: boolean): FeeEstimate {
    // Fee rates (approximations - actual rates from Jump.Finance may vary)
    const feePercent = isSelfEmployed ? 0.03 : 0.06 // 3% or 6%

    const feeAmount = Math.round(amount * feePercent * 100) / 100
    const netAmount = amount - feeAmount

    return {
      grossAmount: amount,
      feeAmount,
      feePercent: feePercent * 100, // Return as percentage (3 or 6)
      netAmount,
      isSelfEmployed,
    }
  }

  /**
   * Verify webhook signature
   *
   * @param payload - Raw webhook payload
   * @param signature - Signature from X-Signature header
   * @param timestamp - Timestamp from X-Timestamp header
   * @returns Whether signature is valid
   */
  verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    if (!this.secretKey) {
      console.warn('[JumpFinance] Cannot verify webhook - secret key not configured')
      return false
    }

    const crypto = require('crypto')
    const message = `${timestamp}.${payload}`
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex')

    return signature === expectedSignature
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let jumpInstance: JumpFinance | null = null

export function getJumpClient(): JumpFinance {
  if (!jumpInstance) {
    jumpInstance = new JumpFinance()
  }
  return jumpInstance
}

// ============================================================
// Convenience Exports
// ============================================================

export const jumpFinance = {
  isConfigured,

  /**
   * Quick check if someone is self-employed
   */
  async verifySelfEmployed(inn: string): Promise<SelfEmployedVerification> {
    return getJumpClient().verifySelfEmployed(inn)
  },

  /**
   * Create SBP payout
   */
  async createPayout(request: PayoutRequest): Promise<PayoutResponse> {
    return getJumpClient().createPayout(request)
  },

  /**
   * Get payout status
   */
  async getPayoutStatus(jumpPayoutId: string): Promise<PayoutStatusResponse> {
    return getJumpClient().getPayoutStatus(jumpPayoutId)
  },

  /**
   * Estimate fees for a payout
   */
  estimateFees(amount: number, isSelfEmployed: boolean): FeeEstimate {
    return getJumpClient().estimateFees(amount, isSelfEmployed)
  },

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    return getJumpClient().verifyWebhookSignature(payload, signature, timestamp)
  },
}

export default jumpFinance
