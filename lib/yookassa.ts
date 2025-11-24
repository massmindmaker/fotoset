// YooKassa интеграция

const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY
const YOOKASSA_API_URL = "https://api.yookassa.ru/v3"

export const IS_TEST_MODE = !YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY

export interface YooKassaPayment {
  id: string
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled"
  amount: {
    value: string
    currency: string
  }
  confirmation?: {
    type: string
    confirmation_url?: string
  }
  created_at: string
  description?: string
  metadata?: Record<string, string>
}

function createTestPayment(
  amount: number,
  description: string,
  returnUrl: string,
  metadata?: Record<string, string>,
): YooKassaPayment {
  const testId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`
  return {
    id: testId,
    status: "pending",
    amount: {
      value: amount.toFixed(2),
      currency: "RUB",
    },
    confirmation: {
      type: "redirect",
      // В тестовом режиме сразу редиректим на success
      confirmation_url: `${returnUrl}&payment_id=${testId}&test=true`,
    },
    created_at: new Date().toISOString(),
    description,
    metadata,
  }
}

export async function createPayment(
  amount: number,
  description: string,
  returnUrl: string,
  metadata?: Record<string, string>,
): Promise<YooKassaPayment> {
  if (IS_TEST_MODE) {
    console.log("[YooKassa] Test mode: creating mock payment")
    return createTestPayment(amount, description, returnUrl, metadata)
  }

  const idempotenceKey = crypto.randomUUID()

  const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
      Authorization: `Basic ${Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: {
        value: amount.toFixed(2),
        currency: "RUB",
      },
      confirmation: {
        type: "redirect",
        return_url: returnUrl,
      },
      capture: true,
      description,
      metadata,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("YooKassa error:", error)
    throw new Error(`YooKassa payment creation failed: ${response.status}`)
  }

  return response.json()
}

export async function getPayment(paymentId: string): Promise<YooKassaPayment> {
  if (IS_TEST_MODE || paymentId.startsWith("test_")) {
    console.log("[YooKassa] Test mode: returning succeeded payment")
    return {
      id: paymentId,
      status: "succeeded",
      amount: { value: "500.00", currency: "RUB" },
      created_at: new Date().toISOString(),
    }
  }

  const response = await fetch(`${YOOKASSA_API_URL}/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString("base64")}`,
    },
  })

  if (!response.ok) {
    throw new Error(`YooKassa get payment failed: ${response.status}`)
  }

  return response.json()
}
