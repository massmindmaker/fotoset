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
  Status?: "NEW" | "CONFIRMED" | "REJECTED" | "AUTHORIZED" | "PARTIAL_REFUNDED" | "REFUNDED"
  PaymentId?: string
  OrderId?: string
  Amount?: number
  PaymentURL?: string
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
  _paymentMethod?: PaymentMethod,
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
  // SECURITY: Only skip verification in development AND test mode
  if (IS_TEST_MODE && process.env.NODE_ENV === 'development') {
    console.warn('[T-Bank] Skipping webhook signature verification (dev + test mode)')
    return true
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

    // If lengths differ, tokens don't match (but still do constant-time comparison)
    if (a.length !== b.length) {
      return false
    }

    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
