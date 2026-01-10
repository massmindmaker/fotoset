// T-Bank (Tinkoff) Payment Integration
import crypto from "crypto"
import { paymentLogger as log } from "./logger"
import { getTBankCredentials, type TBankCredentials } from "./admin/mode"

// CRITICAL: .trim() prevents error 501 from whitespace/newlines in env vars
const TBANK_TERMINAL_KEY = (process.env.TBANK_TERMINAL_KEY || "").trim()
const TBANK_PASSWORD = (process.env.TBANK_PASSWORD || "").trim()
const TBANK_API_URL = "https://securepay.tinkoff.ru/v2"

// Check if credentials are configured (static check for backwards compatibility)
export const HAS_CREDENTIALS = !!(TBANK_TERMINAL_KEY && TBANK_PASSWORD)

// Test mode - when terminal key contains "DEMO" (uses real API but with test cards)
// NOTE: This is static. Use getTBankCredentials() for dynamic mode switching
export const IS_TEST_MODE = TBANK_TERMINAL_KEY.includes("DEMO") ||
  TBANK_TERMINAL_KEY.toLowerCase().includes("test")

// Config logged via conditional logger (suppressed in production)

export type PaymentMethod = "card" | "sbp" | "tpay"

export interface TBankPayment {
  Success: boolean
  ErrorCode?: string
  Message?: string
  TerminalKey?: string
  Status?: "NEW" | "CONFIRMED" | "REJECTED" | "AUTHORIZED" | "PARTIAL_REFUNDED" | "REFUNDED" | "CANCELED" | "DEADLINE_EXPIRED"
  PaymentId?: string
  OrderId?: string
  Amount?: number
  PaymentURL?: string
}

export interface TBankCancelResponse {
  Success: boolean
  ErrorCode?: string
  Message?: string
  TerminalKey?: string
  Status?: string
  PaymentId?: string
  OrderId?: string
  OriginalAmount?: number
  NewAmount?: number
}

export interface ReceiptItem {
  Name: string
  Price: number
  Quantity: number
  Amount: number
  Tax: "none" | "vat0" | "vat10" | "vat20" | "vat110" | "vat120"
  PaymentMethod: "full_payment" | "full_prepayment" | "prepayment" | "advance" | "partial_payment" | "credit" | "credit_payment"
  PaymentObject: "commodity" | "excise" | "job" | "service" | "gambling_bet" | "gambling_prize" | "lottery" | "lottery_prize" | "intellectual_activity" | "payment" | "agent_commission" | "composite" | "another"
}

export interface Receipt {
  Email?: string
  Phone?: string
  Taxation: "osn" | "usn_income" | "usn_income_outcome" | "envd" | "esn" | "patent"
  Items: ReceiptItem[]
}

// Generate token for T-Bank API requests
// Now accepts password as parameter for dynamic credential switching
function generateToken(params: Record<string, string | number>, password?: string): string {
  const pwd = password || TBANK_PASSWORD

  // SECURITY: Require password - never use fallback
  if (!pwd) {
    throw new Error("TBANK_PASSWORD not configured - cannot generate payment token")
  }

  // Создаем объект с паролем
  const values: Record<string, string | number> = {
    ...params,
    Password: pwd,
  }

  // Сортируем ключи и создаем строку для подписи
  const sortedKeys = Object.keys(values).sort()
  const concatenated = sortedKeys.map((key) => values[key]).join("")

  // Генерируем SHA-256 хеш
  return crypto.createHash("sha256").update(concatenated).digest("hex")
}


export async function initPayment(
  amount: number,
  orderId: string,
  description: string,
  successUrl: string,
  failUrl: string,
  notificationUrl?: string,
  customerEmail?: string,
  paymentMethod?: PaymentMethod,
  receipt?: Receipt,
): Promise<TBankPayment & { isTestMode?: boolean }> {
  // Get dynamic credentials based on admin mode setting
  const credentials = await getTBankCredentials()

  // Check if credentials are configured
  if (!credentials.terminalKey || !credentials.password) {
    throw new Error("T-Bank credentials not configured. Set TBANK_TERMINAL_KEY and TBANK_PASSWORD environment variables.")
  }

  const amountInKopeks = Math.round(amount * 100)

  // DIAGNOSTIC: Log configuration state for error 501 debugging
  log.debug("Init payment - config check", {
    terminalKeySet: !!credentials.terminalKey,
    terminalKeyLength: credentials.terminalKey?.length,
    terminalKeyPrefix: credentials.terminalKey?.substring(0, 8),
    passwordSet: !!credentials.password,
    passwordLength: credentials.password?.length,
    testMode: credentials.isTestMode,
    orderId,
    amount,
    amountInKopeks: Math.round(amount * 100),
  })

  // Validate TerminalKey is not undefined/empty
  if (!credentials.terminalKey || credentials.terminalKey === "undefined" || credentials.terminalKey.trim() === "") {
    throw new Error("TBANK_TERMINAL_KEY is invalid or empty - check Vercel environment variables")
  }

  log.debug("Calling API", { testMode: credentials.isTestMode, orderId, amount })

  // Все параметры для Token (кроме Receipt, DATA, Token)
  const params: Record<string, string | number> = {
    TerminalKey: credentials.terminalKey,
    Amount: amountInKopeks,
    OrderId: orderId,
    Description: description.substring(0, 250), // Max 250 chars
  }

  // Map payment method to T-Bank PayType
  // O = одностадийная оплата (карта), S = СБП, T = T-Pay
  if (paymentMethod) {
    const payTypeMap: Record<PaymentMethod, string> = {
      'card': 'O',
      'sbp': 'S',
      'tpay': 'T',
    }
    if (payTypeMap[paymentMethod]) {
      params.PayType = payTypeMap[paymentMethod]
    }
  }

  // Добавляем URL в params ДО генерации токена
  if (successUrl) params.SuccessURL = successUrl
  if (failUrl) params.FailURL = failUrl
  if (notificationUrl) params.NotificationURL = notificationUrl

  // Генерируем токен из ВСЕХ параметров (кроме Receipt, DATA)
  const token = generateToken(params, credentials.password)

  // Формируем полное тело запроса
  const requestBody: Record<string, unknown> = {
    ...params,
    Token: token,
  }

  // DATA добавляется ПОСЛЕ генерации токена (не участвует в подписи)
  if (customerEmail) {
    requestBody.DATA = { Email: customerEmail }
  }

  // Receipt добавляется ПОСЛЕ генерации токена (не участвует в подписи)
  if (receipt) {
    requestBody.Receipt = receipt
  }

  log.debug("Request body", requestBody)

  try {
    const response = await fetch(`${TBANK_API_URL}/Init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const data: TBankPayment = await response.json()

    log.debug("Response", { success: data.Success, paymentId: data.PaymentId, status: data.Status })

    if (!data.Success) {
      // Enhanced error logging with full request/response context
      const receiptData = requestBody.Receipt as Receipt | undefined
      const dataField = requestBody.DATA as { Email?: string } | undefined

      log.error("Payment init failed - Full diagnostic", {
        errorCode: data.ErrorCode,
        message: data.Message,
        terminalKey: credentials.terminalKey?.substring(0, 8) + "...",
        isTestMode: credentials.isTestMode,
        hasReceipt: !!requestBody.Receipt,
        hasDATA: !!requestBody.DATA,
        receiptEmail: receiptData?.Email ? "present" : "missing",
        dataEmail: dataField?.Email ? "present" : "missing",
        amountInRequest: requestBody.Amount,
        receiptAmount: receiptData?.Items?.[0]?.Amount,
      })
      throw new Error(`T-Bank error ${data.ErrorCode}: ${data.Message || "Unknown error"}`)
    }

    return { ...data, isTestMode: credentials.isTestMode }
  } catch (error) {
    log.error("API error", error)
    throw error
  }
}

export async function getPaymentState(paymentId: string): Promise<TBankPayment> {
  // Get dynamic credentials based on admin mode setting
  const credentials = await getTBankCredentials()

  // Check if credentials are configured
  if (!credentials.terminalKey || !credentials.password) {
    throw new Error("T-Bank credentials not configured")
  }

  const params = {
    TerminalKey: credentials.terminalKey,
    PaymentId: paymentId,
  }

  const token = generateToken(params, credentials.password)

  const response = await fetch(`${TBANK_API_URL}/GetState`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...params,
      Token: token,
    }),
  })

  const data: TBankPayment = await response.json()

  if (!data.Success) {
    throw new Error(`T-Bank get payment failed: ${data.Message || data.ErrorCode}`)
  }

  return data
}

export function verifyWebhookSignature(notification: Record<string, unknown>, receivedToken: string): boolean {
  // SECURITY: ALWAYS verify signature - no bypasses allowed
  // If TBANK_PASSWORD is not configured, reject all webhooks
  if (!TBANK_PASSWORD) {
    log.error("Cannot verify webhook: TBANK_PASSWORD not configured")
    return false
  }

  // Создаем копию уведомления без токена
  const params: Record<string, string | number> = {}

  for (const [key, value] of Object.entries(notification)) {
    if (key !== "Token" && value !== null && value !== undefined) {
      params[key] = String(value)
    }
  }

  const calculatedToken = generateToken(params)

  // SECURITY: Use timing-safe comparison to prevent timing attacks
  try {
    const a = Buffer.from(calculatedToken, 'utf8')
    const b = Buffer.from(receivedToken, 'utf8')

    // Pad buffers to same length to prevent length-based timing leak
    const maxLen = Math.max(a.length, b.length)
    const padA = Buffer.alloc(maxLen)
    const padB = Buffer.alloc(maxLen)
    a.copy(padA)
    b.copy(padB)

    return crypto.timingSafeEqual(padA, padB)
  } catch {
    return false
  }
}

/**
 * Cancel or refund a payment
 * @param paymentId - Payment ID from T-Bank
 * @param amount - Optional amount in rubles for partial refund. If omitted, full refund.
 * @param receipt - Optional receipt for fiscal check
 */
export async function cancelPayment(
  paymentId: string,
  amount?: number,
  receipt?: Receipt,
): Promise<TBankCancelResponse> {
  // Get dynamic credentials based on admin mode setting
  const credentials = await getTBankCredentials()

  if (!credentials.terminalKey || !credentials.password) {
    throw new Error("T-Bank credentials not configured")
  }

  const params: Record<string, string | number> = {
    TerminalKey: credentials.terminalKey,
    PaymentId: paymentId,
  }

  // Amount in kopeks for partial refund
  if (amount !== undefined) {
    params.Amount = Math.round(amount * 100)
  }

  const token = generateToken(params, credentials.password)

  const requestBody: Record<string, unknown> = {
    ...params,
    Token: token,
  }

  // Receipt for fiscal check (optional)
  if (receipt) {
    requestBody.Receipt = receipt
  }

  log.debug("Cancel request", { paymentId, amount: amount ? Math.round(amount * 100) : "full" })

  try {
    const response = await fetch(`${TBANK_API_URL}/Cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const data: TBankCancelResponse = await response.json()

    log.debug("Cancel response", { success: data.Success, status: data.Status })

    if (!data.Success) {
      throw new Error(`T-Bank cancel error ${data.ErrorCode}: ${data.Message || "Unknown error"}`)
    }

    return data
  } catch (error) {
    log.error("Cancel error", error)
    throw error
  }
}


/**
 * Auto-refund payment when generation fails (any photo failed = full refund)
 * Called automatically when generation has ANY failed photos
 * @param avatarId - Avatar ID that had failed generation
 * @param userId - User ID for logging
 * @returns true if refund was successful, false otherwise
 */
export async function autoRefundForFailedGeneration(
  avatarId: number,
  userId: number,
): Promise<{ success: boolean; refundedPaymentId?: string; error?: string }> {
  // Import sql here to avoid circular dependency
  const { sql } = await import("./db")
  
  log.info("Auto-refund check for failed generation", { avatarId, userId })
  
  try {
    // First try to find payment linked to the specific generation job
    // This is the correct approach to avoid refunding the wrong payment
    const jobPaymentResult = await sql`
      SELECT p.tbank_payment_id, p.amount, p.status, p.id
      FROM generation_jobs gj
      JOIN payments p ON gj.payment_id = p.id
      WHERE gj.avatar_id = ${avatarId}
        AND p.status = 'succeeded'
      ORDER BY gj.created_at DESC
      LIMIT 1
    `
    
    let paymentResult = jobPaymentResult
    
    // Fallback: if no linked payment (legacy jobs), use most recent succeeded payment
    if (paymentResult.length === 0) {
      log.warn("No linked payment found, using fallback to latest", { avatarId, userId })
      paymentResult = await sql`
        SELECT p.tbank_payment_id, p.amount, p.status, p.id
        FROM payments p
        WHERE p.user_id = ${userId}
          AND p.status = 'succeeded'
        ORDER BY p.created_at DESC
        LIMIT 1
      `
    }
    
    if (paymentResult.length === 0) {
      log.warn("No succeeded payment found for refund", { avatarId, userId })
      return { success: false, error: "No payment found" }
    }
    
    const payment = paymentResult[0]
    
    // Create refund receipt (54-ФЗ compliance)
    // CRITICAL: Price/Amount in kopeks (payment.amount is in rubles from DB)
    const amountInKopeks = Math.round(payment.amount * 100)
    const receipt: Receipt = {
      Email: "noreply@pinglass.ru",
      Taxation: "usn_income_outcome",
      Items: [{
        Name: "Возврат - PinGlass AI фото (ошибка генерации)",
        Price: amountInKopeks, // в копейках
        Quantity: 1,
        Amount: amountInKopeks, // в копейках
        Tax: "none",
        PaymentMethod: "full_payment",
        PaymentObject: "service",
      }],
    }
    
    log.info("Processing auto-refund", {
      paymentId: payment.tbank_payment_id,
      amount: payment.amount,
      avatarId,
      userId,
    })
    
    // Call T-Bank Cancel API for full refund
    const result = await cancelPayment(payment.tbank_payment_id, undefined, receipt)
    
    // Update payment status in DB
    await sql`
      UPDATE payments
      SET status = 'refunded', updated_at = NOW()
      WHERE tbank_payment_id = ${payment.tbank_payment_id}
    `
    
    log.info("Auto-refund successful", {
      paymentId: payment.tbank_payment_id,
      status: result.Status,
      originalAmount: result.OriginalAmount,
    })
    
    return { 
      success: true, 
      refundedPaymentId: payment.tbank_payment_id 
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    log.error("Auto-refund failed", { avatarId, userId, error: errorMessage })
    
    return { success: false, error: errorMessage }
  }
}
