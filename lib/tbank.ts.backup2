// T-Bank (Tinkoff) Payment Integration
import crypto from "crypto"

const TBANK_TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY || ""
const TBANK_PASSWORD = process.env.TBANK_PASSWORD || ""
const TBANK_API_URL = "https://securepay.tinkoff.ru/v2"

// Check if credentials are configured
export const HAS_CREDENTIALS = !!(TBANK_TERMINAL_KEY && TBANK_PASSWORD)

// Test mode - when terminal key contains "DEMO" (uses real API but with test cards)
export const IS_TEST_MODE = TBANK_TERMINAL_KEY.includes("DEMO") ||
  TBANK_TERMINAL_KEY.toLowerCase().includes("test")

// Log config (without secrets)
if (typeof window === 'undefined') {
  console.log("[T-Bank] Config:", {
    mode: !HAS_CREDENTIALS ? "NO CREDENTIALS" : IS_TEST_MODE ? "TEST" : "PRODUCTION",
    terminalKeySet: !!TBANK_TERMINAL_KEY,
    passwordSet: !!TBANK_PASSWORD,
  })
}

export type PaymentMethod = "card" | "sbp" | "tpay"

export interface TBankPayment {
  Success: boolean
  ErrorCode?: string
  Message?: string
  TerminalKey?: string
  Status?: "NEW" | "CONFIRMED" | "REJECTED" | "AUTHORIZED" | "PARTIAL_REFUNDED" | "REFUNDED" | "CANCELED"
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
function generateToken(params: Record<string, string | number>): string {
  // Создаем объект с паролем
  const values: Record<string, string | number> = {
    ...params,
    Password: TBANK_PASSWORD || "test_password",
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
): Promise<TBankPayment> {
  // Check if credentials are configured
  if (!HAS_CREDENTIALS) {
    throw new Error("T-Bank credentials not configured. Set TBANK_TERMINAL_KEY and TBANK_PASSWORD environment variables.")
  }

  const amountInKopeks = Math.round(amount * 100)

  // Log API call
  console.log("[T-Bank] Calling API", {
    testMode: IS_TEST_MODE,
    orderId,
    amount,
    amountInKopeks,
    terminalKeyLength: TBANK_TERMINAL_KEY.length,
    terminalKeyPrefix: TBANK_TERMINAL_KEY.substring(0, 6),
  })

  // Все параметры для Token (кроме Receipt, DATA, Token)
  const params: Record<string, string | number> = {
    TerminalKey: TBANK_TERMINAL_KEY,
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
  const token = generateToken(params)

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

  // Log request
  console.log("[T-Bank] Request body:", JSON.stringify(requestBody, null, 2))

  try {
    const response = await fetch(`${TBANK_API_URL}/Init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const data: TBankPayment = await response.json()

    console.log("[T-Bank] Response:", {
      success: data.Success,
      errorCode: data.ErrorCode,
      message: data.Message,
      paymentId: data.PaymentId,
      status: data.Status,
      hasPaymentUrl: !!data.PaymentURL,
    })

    if (!data.Success) {
      console.error("[T-Bank] Payment init failed:", {
        errorCode: data.ErrorCode,
        message: data.Message,
        orderId,
        amount: amountInKopeks,
      })
      throw new Error(`T-Bank error ${data.ErrorCode}: ${data.Message || "Unknown error"}`)
    }

    return data
  } catch (error) {
    console.error("[T-Bank] API error:", error)
    throw error
  }
}

export async function getPaymentState(paymentId: string): Promise<TBankPayment> {
  // Check if credentials are configured
  if (!HAS_CREDENTIALS) {
    throw new Error("T-Bank credentials not configured")
  }

  const params = {
    TerminalKey: TBANK_TERMINAL_KEY!,
    PaymentId: paymentId,
  }

  const token = generateToken(params)

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
  // SECURITY: ALWAYS verify signature in production, regardless of test mode
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction && process.env.NODE_ENV === 'development' && IS_TEST_MODE) {
    // Only skip in EXPLICIT development mode AND test mode
    console.warn('[T-Bank] Skipping webhook signature verification (dev only + test mode)')
    return true
  }

  // For production OR any non-development environment: ALWAYS verify
  // This ensures security even if someone accidentally deploys with test key

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

    // If lengths differ, tokens don't match (but still do constant-time comparison)
    if (a.length !== b.length) {
      return false
    }

    return crypto.timingSafeEqual(a, b)
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
  if (!HAS_CREDENTIALS) {
    throw new Error("T-Bank credentials not configured")
  }

  const params: Record<string, string | number> = {
    TerminalKey: TBANK_TERMINAL_KEY,
    PaymentId: paymentId,
  }

  // Amount in kopeks for partial refund
  if (amount !== undefined) {
    params.Amount = Math.round(amount * 100)
  }

  const token = generateToken(params)

  const requestBody: Record<string, unknown> = {
    ...params,
    Token: token,
  }

  // Receipt for fiscal check (optional)
  if (receipt) {
    requestBody.Receipt = receipt
  }

  console.log("[T-Bank] Cancel request:", {
    paymentId,
    amount: amount ? Math.round(amount * 100) : "full",
    hasReceipt: !!receipt,
  })

  try {
    const response = await fetch(`${TBANK_API_URL}/Cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const data: TBankCancelResponse = await response.json()

    console.log("[T-Bank] Cancel response:", {
      success: data.Success,
      errorCode: data.ErrorCode,
      message: data.Message,
      status: data.Status,
      originalAmount: data.OriginalAmount,
      newAmount: data.NewAmount,
    })

    if (!data.Success) {
      throw new Error(`T-Bank cancel error ${data.ErrorCode}: ${data.Message || "Unknown error"}`)
    }

    return data
  } catch (error) {
    console.error("[T-Bank] Cancel error:", error)
    throw error
  }
}
