// API route для проверки доступных моделей YeScale
import { NextResponse } from "next/server"

const YESCALE_API_KEY = process.env.YESCALE_API_KEY || "sk-XdPb8LjjBVjQD5JsUW25MAKdzJ3lufQTqlz1v7XST9mBC55B"
const YESCALE_BASE_URL = "https://api.yescale.io/v1beta"

export async function GET() {
  try {
    // Пробуем получить список моделей
    const modelsResponse = await fetch(`${YESCALE_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${YESCALE_API_KEY}`,
        "x-goog-api-key": YESCALE_API_KEY,
      },
    })

    let modelsData = null
    if (modelsResponse.ok) {
      modelsData = await modelsResponse.json()
    }

    // Тестируем конкретную модель gemini-3-pro
    const testResponse = await fetch(`${YESCALE_BASE_URL}/models/gemini-2.0-flash:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${YESCALE_API_KEY}`,
        "x-goog-api-key": YESCALE_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: "Say hello in Russian" }],
          },
        ],
      }),
    })

    const testData = await testResponse.json()

    return NextResponse.json({
      success: true,
      modelsAvailable: modelsData,
      testModelResponse: {
        status: testResponse.status,
        data: testData,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
