import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""

interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

// Validate Telegram Web App initData
function validateInitData(initData: string): TelegramWebAppUser | null {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get("hash")

    if (!hash) {
      console.error("[Telegram] No hash in initData")
      return null
    }

    // Remove hash from params for verification
    params.delete("hash")

    // Sort params alphabetically and create data-check-string
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")

    // Create HMAC-SHA256 signature
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(TELEGRAM_BOT_TOKEN)
      .digest()

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(sortedParams)
      .digest("hex")

    if (calculatedHash !== hash) {
      console.error("[Telegram] Hash mismatch:", { calculatedHash, hash })
      return null
    }

    // Parse user data
    const userJson = params.get("user")
    if (!userJson) {
      console.error("[Telegram] No user in initData")
      return null
    }

    const user: TelegramWebAppUser = JSON.parse(userJson)
    return user
  } catch (error) {
    console.error("[Telegram] initData validation error:", error)
    return null
  }
}

// Send photo via Telegram API
async function sendTelegramPhoto(chatId: number, photoUrl: string, caption?: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption || "PinGlass",
        parse_mode: "HTML",
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Telegram API error: ${error}`)
  }

  return response.json()
}

// Send message via Telegram API
async function sendTelegramMessage(chatId: number, text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Telegram API error: ${error}`)
  }

  return response.json()
}

// POST /api/telegram/webapp-send - Send photos directly using Telegram Web App auth
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData, photoUrls, personaName } = body

    if (!initData) {
      return NextResponse.json(
        { error: "initData is required", code: "NO_INIT_DATA" },
        { status: 400 }
      )
    }

    if (!photoUrls || !Array.isArray(photoUrls) || photoUrls.length === 0) {
      return NextResponse.json(
        { error: "photoUrls array is required" },
        { status: 400 }
      )
    }

    // Validate initData and get user
    const user = validateInitData(initData)

    if (!user) {
      return NextResponse.json(
        { error: "Invalid Telegram Web App data", code: "INVALID_INIT_DATA" },
        { status: 401 }
      )
    }

    const chatId = user.id
    const userName = user.first_name || user.username || "User"

    console.log(`[Telegram] Sending ${photoUrls.length} photos to ${userName} (${chatId})`)

    // Send intro message
    await sendTelegramMessage(
      chatId,
      `<b>PinGlass</b>\n\nОтправляю ${photoUrls.length} фото${personaName ? ` для "${personaName}"` : ""}...`
    )

    // Send photos (limit to 10 at a time to avoid rate limits)
    const photosToSend = photoUrls.slice(0, 10)
    const results: Array<{ url: string; success: boolean; error?: string }> = []

    for (let i = 0; i < photosToSend.length; i++) {
      const url = photosToSend[i]
      try {
        const caption = i === 0
          ? `${personaName || "PinGlass"} - Фото ${i + 1}/${photosToSend.length}`
          : `Фото ${i + 1}/${photosToSend.length}`

        await sendTelegramPhoto(chatId, url, caption)
        results.push({ url, success: true })

        // Small delay between messages to avoid rate limiting
        if (i < photosToSend.length - 1) {
          await new Promise((r) => setTimeout(r, 150))
        }
      } catch (error) {
        console.error(`[Telegram] Failed to send photo ${i + 1}:`, error)
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    const successCount = results.filter((r) => r.success).length

    // Send completion message
    if (successCount > 0) {
      await sendTelegramMessage(
        chatId,
        `Готово! Отправлено ${successCount} из ${photosToSend.length} фото.`
      )
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      total: photosToSend.length,
      userId: user.id,
      results,
    })
  } catch (error) {
    console.error("[API] POST /api/telegram/webapp-send error:", error)
    return NextResponse.json(
      { error: "Failed to send photos", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
