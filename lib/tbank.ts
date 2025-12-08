// T-Bank (Tinkoff) Payment Integration
import crypto from "crypto"

const TBANK_TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY || "TinkoffBankTest"
const TBANK_PASSWORD = process.env.TBANK_PASSWORD || "TinkoffBankTest"
const TBANK_API_URL = "https://securepay.tinkoff.ru/v2"

// Test mode only if explicitly no credentials
export const IS_TEST_MODE = process.env.TBANK_TEST_MODE === "true" ||
  (!process.env.TBANK_TERMINAL_KEY && !process.env.TBANK_PASSWORD)

// Demo mode - when no payment credentials are set, use demo payment page
export const IS_DEMO_MODE = !process.env.TBANK_TERMINAL_KEY || !process.env.TBANK_PASSWORD

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

function createTestPayment(
  amount: number,
  orderId: string,
  description: string,
  successUrl: string,
  failUrl: string,
): TBankPayment {
  const testId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`

  return {
    Success: true,
    Status: "NEW",
    PaymentId: testId,
    OrderId: orderId,
    Amount: amount * 100, // в копейках
    // В тестовом режиме сразу редиректим на success
    PaymentURL: `${successUrl}&payment_id=${testId}&test=true`,
  }
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
  if (IS_TEST_MODE) {
    console.log("[T-Bank] Test mode: creating mock payment")
    return createTestPayment(amount, orderId, description, successUrl, failUrl)
  }

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

  console.log("[T-Bank] Creating payment:", { orderId, amount, email: customerEmail, paymentMethod })

  try {
    const response = await fetch(`${TBANK_API_URL}/Init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const data: TBankPayment = await response.json()

    console.log("[T-Bank] Response:", data)

    if (!data.Success) {
      console.error("T-Bank payment init error:", data.Message, data.ErrorCode)
      throw new Error(`T-Bank payment creation failed: ${data.Message || data.ErrorCode}`)
    }

    return data
  } catch (error) {
    console.error("T-Bank API error:", error)
    throw error
  }
}

export async function getPaymentState(paymentId: string): Promise<TBankPayment> {
  if (IS_TEST_MODE || paymentId.startsWith("test_") || paymentId.startsWith("demo_")) {
    console.log("[T-Bank] Test/Demo mode: returning confirmed payment")
    return {
      Success: true,
      Status: "CONFIRMED",
      PaymentId: paymentId,
      Amount: 50000, // 500 рублей в копейках
    }
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
