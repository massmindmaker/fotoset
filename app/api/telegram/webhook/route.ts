import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import {
  MESSAGES,
  BUTTONS,
  STATUS_LABELS,
  getFAQById,
  getAIService,
  createTicket,
  getOpenTicket,
  addMessage,
  updateTicketStatus,
  closeTicketByUser,
  getTicketByNumber,
} from '@/lib/support'
import { uploadFromUrl, isR2Configured } from '@/lib/r2'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Demo photos for welcome message
const DEMO_PHOTOS = [
  'https://www.pinglass.ru/demo/Screenshot_1.png',
  'https://www.pinglass.ru/demo/Screenshot_2.png',
  'https://www.pinglass.ru/demo/Screenshot_3.png',
  'https://www.pinglass.ru/demo/Screenshot_4.png',
  'https://www.pinglass.ru/demo/Screenshot_5.png',
]

interface TelegramUpdate {
  message?: {
    message_id: number
    chat: { id: number; username?: string; first_name?: string }
    text?: string
    from?: { id: number; username?: string; first_name?: string }
    photo?: { file_id: string }[]
  }
  callback_query?: {
    id: string
    from: { id: number; username?: string; first_name?: string }
    message?: {
      message_id: number
      chat: { id: number }
    }
    data?: string
  }
}

// ==================== TELEGRAM API HELPERS ====================

async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    reply_markup?: { inline_keyboard: any[][] }
    parse_mode?: string
  }
) {
  if (!TELEGRAM_BOT_TOKEN) return null

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'Markdown',
      reply_markup: options?.reply_markup,
    }),
  })

  const result = await response.json()
  return result.ok ? result.result : null
}

async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  options?: {
    reply_markup?: { inline_keyboard: any[][] }
  }
) {
  if (!TELEGRAM_BOT_TOKEN) return

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      reply_markup: options?.reply_markup,
    }),
  })
}

async function answerCallback(callbackId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) return

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text,
    }),
  })
}

async function sendPhotos(chatId: number, photoUrls: string[], caption?: string) {
  if (!TELEGRAM_BOT_TOKEN) return

  const media = photoUrls.map((url, index) => ({
    type: 'photo',
    media: url,
    caption: index === 0 ? caption : undefined,
    parse_mode: index === 0 ? 'HTML' : undefined,
  }))

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      media,
    }),
  })
}

async function sendChatAction(chatId: number, action: string = 'typing') {
  if (!TELEGRAM_BOT_TOKEN) return

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      action,
    }),
  })
}

// ==================== PHOTO HANDLING ====================

/**
 * Get file path from Telegram for a given file_id
 */
async function getTelegramFilePath(fileId: string): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN) return null

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  )
  const data = await response.json()

  if (!data.ok || !data.result?.file_path) {
    console.error('[Telegram] Failed to get file path:', data)
    return null
  }

  return data.result.file_path
}

/**
 * Get download URL for a Telegram file
 */
function getTelegramFileUrl(filePath: string): string {
  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`
}

/**
 * Download photo from Telegram and upload to R2
 * Returns the public URL or null on failure
 */
async function uploadTelegramPhotoToR2(
  fileId: string,
  ticketId: number
): Promise<{ url: string; filename: string } | null> {
  try {
    // Check if R2 is configured
    if (!isR2Configured()) {
      console.warn('[Telegram] R2 not configured, cannot upload photo')
      return null
    }

    // Get file path from Telegram
    const filePath = await getTelegramFilePath(fileId)
    if (!filePath) return null

    // Get download URL
    const downloadUrl = getTelegramFileUrl(filePath)

    // Generate unique key for R2
    const timestamp = Date.now()
    const ext = filePath.split('.').pop() || 'jpg'
    const filename = `ticket_${ticketId}_${timestamp}.${ext}`
    const key = `support-tickets/${ticketId}/${filename}`

    // Upload to R2
    const result = await uploadFromUrl(downloadUrl, key)

    console.log(`[Telegram] Photo uploaded to R2: ${result.url}`)

    return {
      url: result.url,
      filename,
    }
  } catch (error) {
    console.error('[Telegram] Failed to upload photo to R2:', error)
    return null
  }
}

// ==================== COMMAND HANDLERS ====================

async function handleStart(chatId: number, username: string) {
  await sendPhotos(chatId, DEMO_PHOTOS, `<b>👋 Привет, ${username}!</b>\n\nДобро пожаловать в PinGlass Support Bot!`)
  await sendMessage(chatId, MESSAGES.welcome, {
    reply_markup: { inline_keyboard: BUTTONS.mainMenu },
  })
}

async function handleHelp(chatId: number) {
  await sendMessage(chatId, MESSAGES.helpMenu, {
    reply_markup: { inline_keyboard: BUTTONS.faqCategories },
  })
}

async function handleTicket(chatId: number, username: string) {
  const existingTicket = await getOpenTicket(chatId)

  if (existingTicket) {
    await sendMessage(chatId, MESSAGES.ticketAlreadyOpen(existingTicket.ticket_number), {
      reply_markup: { inline_keyboard: BUTTONS.ticketActions(existingTicket.ticket_number) },
    })
  } else {
    // Create draft marker so next message creates a ticket
    await query(
      `INSERT INTO support_ticket_drafts (telegram_chat_id) VALUES ($1)
       ON CONFLICT (telegram_chat_id) DO UPDATE SET created_at = NOW()`,
      [chatId]
    ).catch(() => {})

    await sendMessage(chatId, '🎫 *Создание тикета*\n\nОпишите вашу проблему или вопрос в следующем сообщении.')
  }
}

async function handleTicketStatus(chatId: number) {
  const ticket = await getOpenTicket(chatId)

  if (ticket) {
    await sendMessage(chatId, MESSAGES.ticketStatus(ticket), {
      reply_markup: { inline_keyboard: BUTTONS.ticketActions(ticket.ticket_number) },
    })
  } else {
    await sendMessage(chatId, MESSAGES.noOpenTickets)
  }
}

async function handleCloseTicket(chatId: number) {
  const ticket = await closeTicketByUser(chatId)

  if (ticket) {
    await sendMessage(chatId, MESSAGES.ticketClosed(ticket.ticket_number), {
      reply_markup: { inline_keyboard: BUTTONS.feedbackRating(ticket.ticket_number) },
    })
  } else {
    await sendMessage(chatId, MESSAGES.noOpenTickets)
  }
}

async function handleClear(chatId: number) {
  const aiService = getAIService()
  if (aiService) {
    aiService.clearHistory(chatId)
  }
  await sendMessage(chatId, MESSAGES.sessionCleared)
}

async function handleAccountStatus(chatId: number) {
  const session = await query(
    `SELECT ts.user_id, u.telegram_username
     FROM telegram_sessions ts
     LEFT JOIN users u ON ts.user_id = u.id
     WHERE ts.telegram_chat_id = $1`,
    [chatId]
  )

  if (session.rows.length > 0 && session.rows[0].user_id) {
    await sendMessage(
      chatId,
      `✅ *Аккаунт привязан*\n\nВаш ID: ${session.rows[0].user_id}\n\nВы будете получать сгенерированные фото в этот чат.`,
      { reply_markup: { inline_keyboard: [[{ text: '🔗 Отвязать', callback_data: 'unlink_account' }]] } }
    )
  } else {
    await sendMessage(
      chatId,
      '❌ *Аккаунт не привязан*\n\nЧтобы получать фото в Telegram, привяжите аккаунт в веб-приложении.',
      { reply_markup: { inline_keyboard: BUTTONS.backToMenu } }
    )
  }
}

async function handleUnlink(chatId: number) {
  const result = await query(
    `DELETE FROM telegram_sessions WHERE telegram_chat_id = $1 RETURNING id`,
    [chatId]
  )

  if (result.rows.length > 0) {
    await sendMessage(chatId, '✅ Аккаунт отвязан. Вы больше не будете получать фото.')
  } else {
    await sendMessage(chatId, '❌ Аккаунт не был привязан.')
  }
}

// ==================== CALLBACK QUERY HANDLER ====================

async function handleCallback(
  callbackId: string,
  chatId: number,
  messageId: number,
  data: string,
  username: string
) {
  await answerCallback(callbackId)

  // Main menu
  if (data === 'main_menu') {
    await editMessage(chatId, messageId, MESSAGES.welcome, {
      reply_markup: { inline_keyboard: BUTTONS.mainMenu },
    })
    return
  }

  // Menu actions
  if (data === 'menu_about') {
    await editMessage(chatId, messageId, MESSAGES.aboutService, {
      reply_markup: { inline_keyboard: BUTTONS.backToMenu },
    })
    return
  }

  if (data === 'menu_pricing') {
    await editMessage(chatId, messageId, MESSAGES.pricingInfo, {
      reply_markup: { inline_keyboard: BUTTONS.backToMenu },
    })
    return
  }

  // FAQ categories
  if (data === 'faq_categories') {
    await editMessage(chatId, messageId, MESSAGES.helpMenu, {
      reply_markup: { inline_keyboard: BUTTONS.faqCategories },
    })
    return
  }

  if (data === 'cat_about') {
    await editMessage(chatId, messageId, '🎨 *О сервисе*\n\nВыберите вопрос:', {
      reply_markup: { inline_keyboard: BUTTONS.categoryAbout },
    })
    return
  }

  if (data === 'cat_generation') {
    await editMessage(chatId, messageId, '✨ *Генерация фото*\n\nВыберите вопрос:', {
      reply_markup: { inline_keyboard: BUTTONS.categoryGeneration },
    })
    return
  }

  if (data === 'cat_payment') {
    await editMessage(chatId, messageId, '💳 *Оплата и тарифы*\n\nВыберите вопрос:', {
      reply_markup: { inline_keyboard: BUTTONS.categoryPayment },
    })
    return
  }

  if (data === 'cat_technical') {
    await editMessage(chatId, messageId, '⚙️ *Технические вопросы*\n\nВыберите вопрос:', {
      reply_markup: { inline_keyboard: BUTTONS.categoryTechnical },
    })
    return
  }

  // FAQ answers
  if (data.startsWith('faq_')) {
    const faqId = data.replace('faq_', '')
    const faq = getFAQById(faqId)

    if (faq) {
      await editMessage(chatId, messageId, faq.answer, {
        reply_markup: { inline_keyboard: BUTTONS.afterAnswer },
      })

      // Track FAQ analytics
      await query(
        `INSERT INTO support_faq_analytics (faq_id, question, views)
         VALUES ($1, $2, 1)
         ON CONFLICT (faq_id) DO UPDATE SET views = support_faq_analytics.views + 1`,
        [faq.id, faq.question]
      ).catch(() => {})
    }
    return
  }

  // FAQ feedback
  if (data === 'faq_helpful') {
    await editMessage(chatId, messageId, '👍 Спасибо за отзыв! Рады, что помогли.', {
      reply_markup: { inline_keyboard: BUTTONS.backToMenu },
    })
    return
  }

  if (data === 'faq_not_helpful') {
    await editMessage(
      chatId,
      messageId,
      '😔 Жаль, что не помогло.\n\nХотите создать тикет для связи с оператором?',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎫 Создать тикет', callback_data: 'create_ticket' }],
            [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
          ],
        },
      }
    )
    return
  }

  // Create ticket
  if (data === 'create_ticket') {
    const existingTicket = await getOpenTicket(chatId)

    if (existingTicket) {
      await editMessage(chatId, messageId, MESSAGES.ticketAlreadyOpen(existingTicket.ticket_number), {
        reply_markup: { inline_keyboard: BUTTONS.ticketActions(existingTicket.ticket_number) },
      })
    } else {
      // Create draft marker so next message creates a ticket
      await query(
        `INSERT INTO support_ticket_drafts (telegram_chat_id) VALUES ($1)
         ON CONFLICT (telegram_chat_id) DO UPDATE SET created_at = NOW()`,
        [chatId]
      ).catch(() => {})

      await editMessage(
        chatId,
        messageId,
        '🎫 *Создание тикета*\n\nОпишите вашу проблему или вопрос в следующем сообщении.'
      )
    }
    return
  }

  // Ticket actions
  if (data.startsWith('ticket_close_')) {
    const ticketNumber = data.replace('ticket_close_', '')
    const ticket = await closeTicketByUser(chatId)

    if (ticket) {
      await editMessage(chatId, messageId, MESSAGES.ticketClosed(ticketNumber), {
        reply_markup: { inline_keyboard: BUTTONS.feedbackRating(ticketNumber) },
      })
    }
    return
  }

  // Rating
  if (data.startsWith('rate_')) {
    const parts = data.split('_')
    const ticketNumber = parts[1]
    const rating = parseInt(parts[2])

    // Save rating
    await query(
      `UPDATE support_tickets SET user_rating = $1 WHERE ticket_number = $2`,
      [rating, ticketNumber]
    ).catch(() => {})

    await editMessage(chatId, messageId, MESSAGES.feedbackThanks, {
      reply_markup: { inline_keyboard: BUTTONS.backToMenu },
    })
    return
  }

}

// ==================== TEXT MESSAGE HANDLER ====================

async function handleTextMessage(
  chatId: number,
  text: string,
  username: string,
  telegramUsername?: string,
  messageId?: number
) {
  // Check if user has an open ticket - add message to it
  const openTicket = await getOpenTicket(chatId)

  if (openTicket) {
    await addMessage({
      ticketId: openTicket.id,
      senderType: 'user',
      senderId: String(chatId),
      senderName: username,
      message: text,
      telegramMessageId: messageId,
    })

    await sendMessage(chatId, '✅ Сообщение добавлено к тикету. Оператор скоро ответит.')
    return
  }

  // Check if user is creating a new ticket (just sent /ticket)
  const draftCheck = await query(
    `SELECT 1 FROM support_ticket_drafts WHERE telegram_chat_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'`,
    [chatId]
  ).catch(() => ({ rows: [] }))

  if (draftCheck.rows.length > 0) {
    // Delete draft marker
    await query(`DELETE FROM support_ticket_drafts WHERE telegram_chat_id = $1`, [chatId]).catch(
      () => {}
    )

    // Get user ID if linked
    const sessionResult = await query(
      `SELECT user_id FROM telegram_sessions WHERE telegram_chat_id = $1`,
      [chatId]
    )
    const userId = sessionResult.rows[0]?.user_id

    // Create ticket
    const ticket = await createTicket({
      telegramChatId: chatId,
      telegramUsername,
      userName: username,
      userId,
      initialMessage: text,
    })

    await sendMessage(chatId, MESSAGES.ticketCreated(ticket.ticket_number), {
      reply_markup: { inline_keyboard: BUTTONS.ticketActions(ticket.ticket_number) },
    })

    return
  }

  // Try AI response
  const aiService = getAIService()

  if (aiService) {
    await sendChatAction(chatId, 'typing')

    const response = await aiService.generateResponse(chatId, text)

    // Check if AI suggests creating a ticket
    const suggestsTicket =
      response.includes('/ticket') ||
      response.includes('создать тикет') ||
      response.includes('обратитесь в поддержку')

    if (suggestsTicket) {
      await sendMessage(chatId, response, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎫 Создать тикет', callback_data: 'create_ticket' }],
            [{ text: '📚 FAQ', callback_data: 'faq_categories' }],
          ],
        },
      })
    } else {
      await sendMessage(chatId, response, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📚 FAQ', callback_data: 'faq_categories' },
              { text: '🎫 Тикет', callback_data: 'create_ticket' },
            ],
          ],
        },
      })
    }
  } else {
    // No AI available - offer to create ticket
    await sendMessage(
      chatId,
      'Я пока не могу ответить на этот вопрос автоматически.\n\nПопробуйте посмотреть FAQ или создайте тикет для связи с оператором.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📚 FAQ', callback_data: 'faq_categories' }],
            [{ text: '🎫 Создать тикет', callback_data: 'create_ticket' }],
          ],
        },
      }
    )
  }
}

// ==================== LINK CODE HANDLER ====================

async function handleLinkCode(chatId: number, code: string, username: string) {
  // Find valid code
  const codeResult = await query(
    `SELECT * FROM telegram_link_codes
     WHERE code = $1 AND expires_at > NOW() AND used_at IS NULL`,
    [code]
  )

  if (codeResult.rows.length === 0) {
    await sendMessage(
      chatId,
      '❌ Неверный или истёкший код.\n\nПопробуйте получить новый в приложении.'
    )
    return
  }

  const linkCode = codeResult.rows[0]

  // Check if already linked
  const existingSession = await query(`SELECT id FROM telegram_sessions WHERE user_id = $1`, [
    linkCode.user_id,
  ])

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

  await sendMessage(
    chatId,
    '✅ *Аккаунт успешно привязан!*\n\nТеперь вы будете получать сгенерированные фото прямо сюда.',
    { reply_markup: { inline_keyboard: BUTTONS.backToMenu } }
  )
}

// ==================== MAIN WEBHOOK HANDLER ====================

export async function POST(request: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram] Bot token not configured')
    return NextResponse.json({ ok: true })
  }

  try {
    const update: TelegramUpdate = await request.json()

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const cb = update.callback_query
      const chatId = cb.message?.chat.id
      const messageId = cb.message?.message_id
      const data = cb.data
      const username = cb.from.first_name || cb.from.username || 'User'

      if (chatId && messageId && data) {
        await handleCallback(cb.id, chatId, messageId, data, username)
      } else {
        await answerCallback(cb.id)
      }

      return NextResponse.json({ ok: true })
    }

    // Handle messages
    const message = update.message

    if (!message) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text?.trim()
    const username = message.from?.first_name || message.chat.first_name || 'User'
    const telegramUsername = message.from?.username

    // Handle photos - only in ticket context
    if (message.photo) {
      // Check if user has an open ticket
      const openTicket = await getOpenTicket(chatId)

      if (openTicket) {
        // Get the largest photo (last in array)
        const photo = message.photo[message.photo.length - 1]

        // Upload photo to R2
        const uploadResult = await uploadTelegramPhotoToR2(photo.file_id, openTicket.id)

        if (uploadResult) {
          // Add message with photo attachment to ticket
          const caption = text || '📸 Скриншот'
          await addMessage({
            ticketId: openTicket.id,
            senderType: 'user',
            senderId: String(chatId),
            senderName: username,
            message: caption,
            messageType: 'photo',
            attachments: [{ type: 'photo', url: uploadResult.url, filename: uploadResult.filename }],
            telegramMessageId: message.message_id,
          })

          await sendMessage(chatId, `📸 Скриншот добавлен к тикету *${openTicket.ticket_number}*`)
          console.log(`[Telegram] Photo added to ticket ${openTicket.ticket_number}`)
        } else {
          // R2 not configured or upload failed
          await sendMessage(chatId, '⚠️ Не удалось загрузить изображение. Попробуйте позже или опишите проблему текстом.')
        }
        return NextResponse.json({ ok: true })
      }

      // Check if there's a draft (user clicked "create ticket")
      const draftResult = await query(
        `SELECT 1 FROM support_ticket_drafts WHERE telegram_chat_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'`,
        [chatId]
      ).catch(() => ({ rows: [] }))

      if (draftResult.rows.length > 0) {
        // Get the largest photo (last in array)
        const photo = message.photo[message.photo.length - 1]

        // Create the ticket first
        const ticket = await createTicket({
          telegramChatId: chatId,
          telegramUsername,
          userName: username,
          initialMessage: text || '📸 Скриншот',
        })

        // Upload photo to R2
        const uploadResult = await uploadTelegramPhotoToR2(photo.file_id, ticket.id)

        if (uploadResult) {
          // Update the initial message with photo attachment
          await query(
            `UPDATE support_ticket_messages
             SET message_type = 'photo', attachments = $1
             WHERE ticket_id = $2 AND sender_type = 'user'
             ORDER BY created_at ASC LIMIT 1`,
            [JSON.stringify([{ type: 'photo', url: uploadResult.url, filename: uploadResult.filename }]), ticket.id]
          )
        }

        // Delete the draft
        await query(`DELETE FROM support_ticket_drafts WHERE telegram_chat_id = $1`, [chatId])

        await sendMessage(chatId, MESSAGES.ticketCreated(ticket.ticket_number), {
          reply_markup: { inline_keyboard: BUTTONS.ticketActions(ticket.ticket_number) },
        })

        console.log(`[Telegram] Created ticket ${ticket.ticket_number} with photo from ${chatId}`)
        return NextResponse.json({ ok: true })
      }

      // No ticket context - inform user how to add photo
      await sendMessage(
        chatId,
        '📸 Чтобы прикрепить скриншот, сначала создайте тикет командой /ticket или добавьте фото к существующему тикету.'
      )
      return NextResponse.json({ ok: true })
    }

    if (!text) {
      return NextResponse.json({ ok: true })
    }

    console.log(`[Telegram] Message from ${chatId} (@${telegramUsername}): ${text}`)

    // Command handlers
    if (text === '/start') {
      await handleStart(chatId, username)
      return NextResponse.json({ ok: true })
    }

    if (text === '/help' || text === '/faq') {
      await handleHelp(chatId)
      return NextResponse.json({ ok: true })
    }

    if (text === '/ticket') {
      await handleTicket(chatId, username)
      return NextResponse.json({ ok: true })
    }

    if (text === '/status') {
      await handleTicketStatus(chatId)
      return NextResponse.json({ ok: true })
    }

    if (text === '/close') {
      await handleCloseTicket(chatId)
      return NextResponse.json({ ok: true })
    }

    if (text === '/clear') {
      await handleClear(chatId)
      return NextResponse.json({ ok: true })
    }

    if (text === '/account') {
      await handleAccountStatus(chatId)
      return NextResponse.json({ ok: true })
    }

    if (text === '/unlink') {
      await handleUnlink(chatId)
      return NextResponse.json({ ok: true })
    }

    // Handle link code (6 characters, alphanumeric)
    if (/^[A-Z0-9]{6}$/i.test(text)) {
      await handleLinkCode(chatId, text.toUpperCase(), telegramUsername || username)
      return NextResponse.json({ ok: true })
    }

    // Handle regular text messages
    await handleTextMessage(chatId, text, username, telegramUsername, message.message_id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram] Webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}

// GET /api/telegram/webhook - Verify webhook (for Telegram setup)
export async function GET() {
  return NextResponse.json({ ok: true, message: 'PinGlass Support Bot webhook endpoint' })
}
