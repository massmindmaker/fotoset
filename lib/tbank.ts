// T-Bank (Tinkoff) Payment Integration
import crypto from "crypto"

const TBANK_TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY
const TBANK_PASSWORD = process.env.TBANK_PASSWORD
const TBANK_API_URL = "https://securepay.tinkoff.ru/v2"

export const IS_TEST_MODE = !TBANK_TERMINAL_KEY || !TBANK_PASSWORD

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
  metadata?: Record<string, string>,
): Promise<TBankPayment> {
  if (IS_TEST_MODE) {
    console.log("[T-Bank] Test mode: creating mock payment")
    return createTestPayment(amount, orderId, description, successUrl, failUrl)
  }

  // Параметры для создания платежа
  const params: Record<string, string | number> = {
    TerminalKey: TBANK_TERMINAL_KEY!,
    Amount: amount * 100, // конвертируем в копейки
    OrderId: orderId,
    Description: description,
    ...(customerEmail && { DATA: JSON.stringify({ Email: customerEmail }) }),
  }

  // Добавляем URL возврата и уведомлений
  if (successUrl) params.SuccessURL = successUrl
  if (failUrl) params.FailURL = failUrl
  if (notificationUrl) params.NotificationURL = notificationUrl

  // Генерируем токен
  const token = generateToken(params)

  // Формируем тело запроса
  const requestBody = {
    ...params,
    Token: token,
    ...(metadata && { Receipt: metadata }),
  }

  try {
    const response = await fetch(`${TBANK_API_URL}/Init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const data: TBankPayment = await response.json()

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
  if (IS_TEST_MODE || paymentId.startsWith("test_")) {
    console.log("[T-Bank] Test mode: returning confirmed payment")
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
