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
  paymentMethod?: PaymentMethod,
): Promise<TBankPayment> {
  // Check if credentials are configured
  if (!HAS_CREDENTIALS) {
    throw new Error("T-Bank credentials not configured. Set TBANK_TERMINAL_KEY and TBANK_PASSWORD environment variables.")
  }

  // Log API call
  console.log("[T-Bank] Calling API", {
    testMode: IS_TEST_MODE,
    orderId,
    amount,
    terminalKeyLength: TBANK_TERMINAL_KEY.length
  })

  const amountInKopeks = amount * 100

  // Создаём чек для ФЗ-54
  const receipt: Receipt | undefined = customerEmail
    ? {
        Email: customerEmail,
        Taxation: "usn_income",
        Items: [
          {
            Name: description,
            Price: amountInKopeks,
            Quantity: 1,
            Amount: amountInKopeks,
            Tax: "none",
            PaymentMethod: "full_payment",
            PaymentObject: "service",
          },
        ],
      }
    : undefined

  // Параметры для создания платежа
  const params: Record<string, string | number> = {
    TerminalKey: TBANK_TERMINAL_KEY,
    Amount: amountInKopeks,
    OrderId: orderId,
    Description: description,
  }

  // Добавляем URL возврата и уведомлений
  if (successUrl) params.SuccessURL = successUrl
  if (failUrl) params.FailURL = failUrl
  if (notificationUrl) params.NotificationURL = notificationUrl

  // Определяем PayType для разных способов оплаты
  let payType = "O" // One-stage payment by default
  if (paymentMethod === "sbp") {
    payType = "O"
  } else if (paymentMethod === "tpay") {
    payType = "O"
  }
  params.PayType = payType

  // Генерируем токен (без Receipt, DATA и сложных объектов)
  const token = generateToken(params)

  // Формируем полное тело запроса
  const requestBody: Record<string, unknown> = {
    ...params,
    Token: token,
  }

  // Добавляем чек если есть email
  if (receipt) {
    requestBody.Receipt = receipt
  }

  // Добавляем DATA с email
  if (customerEmail) {
    requestBody.DATA = {
      Email: customerEmail,
    }
  }

  // Log request (without sensitive data)
  console.log("[T-Bank] Request:", {
    url: `${TBANK_API_URL}/Init`,
    orderId,
    amount,
    amountInKopeks,
    email: customerEmail,
    paymentMethod,
    successUrl,
    failUrl,
    hasReceipt: !!receipt,
    hasData: !!customerEmail,
  })

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
  if (IS_TEST_MODE) {
    return true // В тестовом режиме пропускаем проверку
  }

  // Создаем копию уведомления без токена
  const params: Record<string, string | number> = {}

  for (const [key, value] of Object.entries(notification)) {
    if (key !== "Token" && value !== null && value !== undefined) {
      params[key] = String(value)
    }
  }

  const calculatedToken = generateToken(params)

  return calculatedToken === receivedToken
}
