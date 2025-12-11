import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Demo photos for welcome message
const DEMO_PHOTOS = [
  "https://www.pinglass.ru/demo/Screenshot_1.png",
  "https://www.pinglass.ru/demo/Screenshot_2.png",
  "https://www.pinglass.ru/demo/Screenshot_3.png",
  "https://www.pinglass.ru/demo/Screenshot_4.png",
  "https://www.pinglass.ru/demo/Screenshot_5.png",
]

interface TelegramUpdate {
  message?: {
    chat: { id: number; username?: string; first_name?: string }
    text?: string
    from?: { id: number; username?: string }
  }
}

// Send message via Telegram API
async function sendTelegramMessage(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  })
}

// Send media group (photos) via Telegram API
async function sendTelegramPhotos(chatId: number, photoUrls: string[], caption?: string) {
  if (!TELEGRAM_BOT_TOKEN) return

  const media = photoUrls.map((url, index) => ({
    type: "photo",
    media: url,
    caption: index === 0 ? caption : undefined,
    parse_mode: index === 0 ? "HTML" : undefined,
  }))

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      media,
    }),
  })
}

// POST /api/telegram/webhook - Telegram bot webhook
export async function POST(request: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram] Bot token not configured")
    return NextResponse.json({ ok: true })
  }

  try {
    const update: TelegramUpdate = await request.json()
    const message = update.message

    if (!message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text.trim()
    const username = message.from?.username || message.chat.first_name || "User"

    console.log(`[Telegram] Message from ${chatId}: ${text}`)

    // Handle /start command - send welcome with demo photos
    if (text === "/start") {
      await sendTelegramPhotos(
        chatId,
        DEMO_PHOTOS,
        `<b>PinGlass</b> — AI-фотопортреты\n\n` +
          `Привет, ${username}! Создавай профессиональные фото с помощью ИИ.\n\n` +
          `Загрузи свои фото в приложении и получи 23 уникальных портрета в разных стилях.\n\n` +
          `Для привязки аккаунта введите код из приложения.`
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /help command
    if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        `<b>PinGlass Bot</b>\n\n` +
          `Команды:\n` +
          `/start - Начать\n` +
          `/status - Проверить привязку\n` +
          `/unlink - Отвязать аккаунт\n\n` +
          `Для привязки введите код из приложения.`
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /status command
    if (text === "/status") {
      const session = await query(
        `SELECT ts.*, u.device_id
         FROM telegram_sessions ts
         JOIN users u ON u.id = ts.user_id
         WHERE ts.telegram_chat_id = $1`,
        [chatId]
      )

      if (session.rows.length > 0) {
        await sendTelegramMessage(
          chatId,
          `Аккаунт привязан\n` +
            `Telegram: @${session.rows[0].telegram_username || "не указан"}\n` +
            `Привязан: ${new Date(session.rows[0].linked_at).toLocaleDateString("ru")}`
        )
      } else {
        await sendTelegramMessage(chatId, `Аккаунт не привязан. Введите код из приложения.`)
      }
      return NextResponse.json({ ok: true })
    }

    // Handle /unlink command
    if (text === "/unlink") {
      const result = await query(
        `DELETE FROM telegram_sessions WHERE telegram_chat_id = $1 RETURNING id`,
        [chatId]
      )

      if (result.rows.length > 0) {
        await sendTelegramMessage(chatId, `Аккаунт отвязан. Вы больше не будете получать фото.`)
      } else {
        await sendTelegramMessage(chatId, `Аккаунт не был привязан.`)
      }
      return NextResponse.json({ ok: true })
    }

    // Handle link code (6 characters, alphanumeric)
    if (/^[A-Z0-9]{6}$/i.test(text)) {
      const code = text.toUpperCase()

      // Find valid code
      const codeResult = await query(
        `SELECT * FROM telegram_link_codes
         WHERE code = $1 AND expires_at > NOW() AND used_at IS NULL`,
        [code]
      )

      if (codeResult.rows.length === 0) {
        await sendTelegramMessage(chatId, `Неверный или истёкший код. Попробуйте получить новый в приложении.`)
        return NextResponse.json({ ok: true })
      }

      const linkCode = codeResult.rows[0]

      // Check if already linked
      const existingSession = await query(
        `SELECT id FROM telegram_sessions WHERE user_id = $1`,
        [linkCode.user_id]
      )

      if (existingSession.rows.length > 0) {
        // Update existing session
        await query(
          `UPDATE telegram_sessions
           SET telegram_chat_id = $1, telegram_username = $2, last_activity = NOW()
           WHERE user_id = $3`,
          [chatId, username, linkCode.user_id]
        )
      } else {
        // Create new session
        await query(
          `INSERT INTO telegram_sessions (user_id, telegram_chat_id, telegram_username)
           VALUES ($1, $2, $3)
           ON CONFLICT (telegram_chat_id) DO UPDATE
           SET user_id = $1, telegram_username = $3, last_activity = NOW()`,
          [linkCode.user_id, chatId, username]
        )
      }

      // Mark code as used
      await query(`UPDATE telegram_link_codes SET used_at = NOW() WHERE id = $1`, [linkCode.id])

      await sendTelegramMessage(
        chatId,
        `Аккаунт успешно привязан!\n\nТеперь вы будете получать сгенерированные фото прямо сюда.`
      )

      return NextResponse.json({ ok: true })
    }

    // Unknown command
    await sendTelegramMessage(
      chatId,
      `Не понял команду. Введите /help для справки.`
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Telegram] Webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}

// GET /api/telegram/webhook - Verify webhook (for Telegram setup)
export async function GET() {
  return NextResponse.json({ ok: true, message: "Telegram webhook endpoint" })
}
