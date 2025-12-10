import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

/**
 * Send all generated photos to user's Telegram chat
 * POST /api/telegram/send-photos
 */
export async function POST(request: NextRequest) {
  try {
    const { deviceId, telegramUserId, photoUrls } = await request.json()

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: "Telegram bot not configured" },
        { status: 500 }
      )
    }

    // Get telegram user ID from request or database
    let chatId = telegramUserId

    if (!chatId && deviceId) {
      const user = await sql`
        SELECT telegram_user_id FROM users WHERE device_id = ${deviceId}
      `.then(rows => rows[0])

      chatId = user?.telegram_user_id
    }

    if (!chatId) {
      return NextResponse.json(
        { error: "Telegram user ID not found. Please open the app from Telegram." },
        { status: 400 }
      )
    }

    if (!photoUrls || photoUrls.length === 0) {
      return NextResponse.json(
        { error: "No photos to send" },
        { status: 400 }
      )
    }

    console.log(`[Telegram] Sending ${photoUrls.length} photos to user ${chatId}`)

    // Send photos in batches of 10 (Telegram limit for media groups)
    const batchSize = 10
    let sentCount = 0
    const errors: string[] = []

    for (let i = 0; i < photoUrls.length; i += batchSize) {
      const batch = photoUrls.slice(i, i + batchSize)

      if (batch.length === 1) {
        // Single photo - send as photo
        const response = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: batch[0],
              caption: i === 0 ? `PinGlass - ${photoUrls.length} AI-${photoUrls.length > 4 ? 'portraits' : 'portraits'}` : undefined
            })
          }
        )

        const result = await response.json()
        if (result.ok) {
          sentCount++
        } else {
          errors.push(`Photo ${i + 1}: ${result.description}`)
        }
      } else {
        // Multiple photos - send as media group
        const media = batch.map((url: string, idx: number) => ({
          type: "photo",
          media: url,
          caption: i === 0 && idx === 0 ? `PinGlass - ${photoUrls.length} AI-portraits` : undefined
        }))

        const response = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              media
            })
          }
        )

        const result = await response.json()
        if (result.ok) {
          sentCount += batch.length
        } else {
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${result.description}`)
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < photoUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`[Telegram] Sent ${sentCount}/${photoUrls.length} photos to user ${chatId}`)

    return NextResponse.json({
      success: true,
      sentCount,
      totalPhotos: photoUrls.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Telegram] Send photos error:", errorMessage)

    return NextResponse.json(
      { error: "Failed to send photos", message: errorMessage },
      { status: 500 }
    )
  }
}
