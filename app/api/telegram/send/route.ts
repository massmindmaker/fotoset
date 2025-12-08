import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Send photo via Telegram API
async function sendTelegramPhoto(chatId: number, photoUrl: string, caption?: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN not configured")
  }

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

// POST /api/telegram/send - Send photos to user's Telegram
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, photoUrls, caption } = body

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 })
    }

    if (!photoUrls || !Array.isArray(photoUrls) || photoUrls.length === 0) {
      return NextResponse.json({ error: "photoUrls array is required" }, { status: 400 })
    }

    // Get user's Telegram chat ID
    const sessionResult = await query(
      `SELECT ts.telegram_chat_id
       FROM telegram_sessions ts
       JOIN users u ON u.id = ts.user_id
       WHERE u.device_id = $1`,
      [deviceId]
    )

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Telegram not linked", code: "NOT_LINKED" },
        { status: 400 }
      )
    }

    const chatId = sessionResult.rows[0].telegram_chat_id

    // Send photos (limit to 10 at a time)
    const photosToSend = photoUrls.slice(0, 10)
    const results: Array<{ url: string; success: boolean; error?: string }> = []

    for (const url of photosToSend) {
      try {
        await sendTelegramPhoto(chatId, url, caption)
        results.push({ url, success: true })

        // Small delay between messages to avoid rate limiting
        await new Promise((r) => setTimeout(r, 100))
      } catch (error) {
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    // Update last activity
    await query(
      `UPDATE telegram_sessions SET last_activity = NOW() WHERE telegram_chat_id = $1`,
      [chatId]
    )

    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      sent: successCount,
      total: photosToSend.length,
      results,
    })
  } catch (error) {
    console.error("[API] POST /api/telegram/send error:", error)
    return NextResponse.json(
      { error: "Failed to send photos" },
      { status: 500 }
    )
  }
}
