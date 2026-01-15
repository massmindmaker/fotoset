/**
 * Telegram notification utilities for PinGlass
 * Sends notifications when photo generation completes
 */

import { fetchWithTimeout, TIMEOUTS } from "./fetch-with-timeout"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

interface NotificationResult {
  success: boolean
  error?: string
}

/**
 * Send photo generation complete notification to Telegram user
 */
export async function sendGenerationNotification(
  telegramUserId: number,
  photoCount: number,
  thumbnailUrl: string,
  avatarId?: number
): Promise<NotificationResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram] BOT_TOKEN not configured, skipping notification")
    return { success: false, error: "Bot token not configured" }
  }

  if (!telegramUserId) {
    return { success: false, error: "No telegram user ID" }
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pinglass.app"

    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeout: TIMEOUTS.TELEGRAM_API,
        body: JSON.stringify({
          chat_id: telegramUserId,
          photo: thumbnailUrl,
          caption: `🎉 <b>Ваши фото готовы!</b>\n\n` +
                   `✨ Сгенерировано <b>${photoCount}</b> фото\n\n` +
                   `Нажмите кнопку ниже, чтобы посмотреть результат!`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              {
                text: "📸 Смотреть фото",
                web_app: { url: appUrl }
              }
            ]]
          }
        })
      }
    )

    const result = await response.json()

    if (!result.ok) {
      console.error("[Telegram] Notification failed:", result.description)
      return { success: false, error: result.description }
    }

    console.log(`[Telegram] Notification sent to user ${telegramUserId}`)
    return { success: true }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Telegram] Notification error:", errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Send text message notification (fallback if photo fails)
 */
export async function sendTextNotification(
  telegramUserId: number,
  message: string
): Promise<NotificationResult> {
  if (!TELEGRAM_BOT_TOKEN || !telegramUserId) {
    return { success: false, error: "Missing token or user ID" }
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pinglass.app"

    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeout: TIMEOUTS.TELEGRAM_API,
        body: JSON.stringify({
          chat_id: telegramUserId,
          text: message,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              {
                text: "📸 Открыть PinGlass",
                web_app: { url: appUrl }
              }
            ]]
          }
        })
      }
    )

    const result = await response.json()
    return { success: result.ok, error: result.description }

  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
