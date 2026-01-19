// Support Bot Messages and Button Layouts

export const MESSAGES = {
  welcome: `👋 Привет! Добро пожаловать в поддержку *PinGlass*!

🎨 PinGlass — AI-сервис для создания профессиональных фотопортретов.

Я помогу ответить на ваши вопросы. Выберите тему или просто напишите свой вопрос 👇`,

  helpMenu: `📚 *Центр помощи PinGlass*

Выберите категорию:`,

  aboutService: `🎨 *О сервисе PinGlass*

PinGlass (Розовые очки) — AI-сервис, который превращает ваши обычные фото в профессиональные портреты.

🔹 Загрузите 5-20 фото
🔹 Выберите тариф
🔹 Получите AI-портреты в Telegram!

🌐 Сайт: pinglass.ru`,

  pricingInfo: `💰 *Тарифы PinGlass*

🔹 *Starter* — 499₽
   • 7 AI-портретов

⭐ *Standard* — 999₽ (популярный)
   • 15 AI-портретов

💎 *Premium* — 1499₽
   • 23 AI-портрета

✅ Все тарифы: высокое качество, без водяных знаков!`,

  // Ticket messages
  ticketCreated: (ticketNumber: string) => `🎫 *Тикет создан: ${ticketNumber}*

Ваше обращение принято! Оператор ответит в ближайшее время.

⏰ Гарантированное время ответа: до 24 часов
📱 Вы получите уведомление, когда оператор ответит.

💡 Пока ждёте, можете посмотреть раздел FAQ — возможно, ответ уже есть там!`,

  ticketAlreadyOpen: (ticketNumber: string) => `📋 У вас уже есть открытый тикет: *${ticketNumber}*

Опишите ваш вопрос — сообщение будет добавлено к существующему тикету.

💡 Если хотите создать новый тикет — сначала закройте текущий командой /close`,

  ticketClosed: (ticketNumber: string) => `✅ Тикет *${ticketNumber}* закрыт.

Спасибо за обращение! Если возникнут новые вопросы — обращайтесь.

💡 Вы можете оставить отзыв о качестве поддержки.`,

  ticketStatus: (ticket: { ticket_number: string; status: string; created_at: string; subject?: string | null }) => `📋 *Тикет ${ticket.ticket_number}*

📌 Статус: ${STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] || ticket.status}
📅 Создан: ${new Date(ticket.created_at).toLocaleString('ru')}
${ticket.subject ? `📝 Тема: ${ticket.subject}` : ''}`,

  noOpenTickets: `📭 У вас нет открытых тикетов.

Если нужна помощь — создайте тикет командой /ticket или просто напишите свой вопрос.`,

  ticketReply: (operatorName: string, message: string) => `👨‍💻 *Ответ от поддержки:*

${message}

---
Если нужна дополнительная помощь — просто напишите в этот чат!`,

  ticketEscalated: `⚡ Ваше обращение передано старшему оператору для скорейшего решения.`,

  // AI messages
  aiThinking: `🤔 Думаю...`,

  aiError: `😔 Извините, не могу сейчас ответить. Попробуйте позже или посмотрите раздел FAQ.`,

  aiRateLimit: `⏳ Слишком много запросов. Подождите немного.`,

  // System messages
  photoNotSupported: `📸 Я пока не умею анализировать изображения. Попробуйте описать вопрос текстом!`,

  unknownCommand: `❓ Не понял команду.

Доступные команды:
/start — Главное меню
/help — FAQ
/ticket — Создать тикет
/status — Статус тикета
/close — Закрыть тикет`,

  sessionCleared: `🧹 История диалога очищена! Можем начать разговор заново.`,

  // Feedback
  feedbackRequest: `⭐ *Оцените качество поддержки*

Насколько вы довольны полученной помощью?`,

  feedbackThanks: `🙏 Спасибо за отзыв! Это помогает нам становиться лучше.`,

  slaWarning: (ticket: { ticket_number: string; minutes_left: number }) =>
    `⚠️ *SLA предупреждение*

Тикет *${ticket.ticket_number}* требует ответа!
⏰ Осталось: ${ticket.minutes_left} мин.`,

  slaBreached: (ticket: { ticket_number: string }) =>
    `🚨 *SLA нарушен!*

Тикет *${ticket.ticket_number}* просрочен!
Требуется немедленная реакция.`,
}

export const STATUS_LABELS: Record<string, string> = {
  open: '🟢 Открыт',
  in_progress: '🔵 В работе',
  waiting_user: '🟡 Ожидает ответа',
  resolved: '✅ Решён',
  closed: '⬛ Закрыт',
}

export const PRIORITY_LABELS: Record<string, string> = {
  P1: '🔴 Критический',
  P2: '🟠 Высокий',
  P3: '🟡 Средний',
  P4: '🟢 Низкий',
}

export const CATEGORY_LABELS: Record<string, string> = {
  payment: '💳 Оплата',
  generation: '✨ Генерация',
  technical: '⚙️ Технический',
  account: '👤 Аккаунт',
  feedback: '💬 Отзыв',
  general: '📋 Общий',
}

// Inline keyboard layouts
export const BUTTONS = {
  mainMenu: [
    [
      { text: '🎨 О сервисе', callback_data: 'menu_about' },
      { text: '💰 Тарифы', callback_data: 'menu_pricing' },
    ],
    [{ text: '📚 FAQ', callback_data: 'faq_categories' }],
    [{ text: '🎫 Создать тикет', callback_data: 'create_ticket' }],
    [{ text: '🌐 Открыть PinGlass', url: 'https://pinglass.ru' }],
  ],

  faqCategories: [
    [
      { text: '🎨 О сервисе', callback_data: 'cat_about' },
      { text: '✨ Генерация', callback_data: 'cat_generation' },
    ],
    [
      { text: '💳 Оплата', callback_data: 'cat_payment' },
      { text: '⚙️ Технические', callback_data: 'cat_technical' },
    ],
    [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
  ],

  categoryAbout: [
    [{ text: '❓ Что такое PinGlass?', callback_data: 'faq_what_is_pinglass' }],
    [{ text: '🔄 Как это работает?', callback_data: 'faq_how_it_works' }],
    [{ text: '📸 Сколько фото я получу?', callback_data: 'faq_photo_count' }],
    [{ text: '🔙 Назад', callback_data: 'faq_categories' }],
  ],

  categoryGeneration: [
    [{ text: '📤 Какие фото загружать?', callback_data: 'faq_upload_requirements' }],
    [{ text: '⏱️ Сколько ждать?', callback_data: 'faq_generation_time' }],
    [{ text: '🔄 Можно перегенерировать?', callback_data: 'faq_regenerate' }],
    [{ text: '🔙 Назад', callback_data: 'faq_categories' }],
  ],

  categoryPayment: [
    [{ text: '💰 Какие тарифы?', callback_data: 'faq_pricing' }],
    [{ text: '💳 Как оплатить?', callback_data: 'faq_payment_methods' }],
    [{ text: '⚠️ Проблемы с оплатой', callback_data: 'faq_payment_problem' }],
    [{ text: '💸 Возврат средств', callback_data: 'faq_refund' }],
    [{ text: '🔙 Назад', callback_data: 'faq_categories' }],
  ],

  categoryTechnical: [
    [{ text: '📥 Как скачать фото?', callback_data: 'faq_save_photos' }],
    [{ text: '💾 Сколько хранятся?', callback_data: 'faq_photos_storage' }],
    [{ text: '📱 Сменить устройство', callback_data: 'faq_change_device' }],
    [{ text: '📁 Размер файла', callback_data: 'faq_file_size' }],
    [{ text: '🖼️ Качество фото', callback_data: 'faq_photo_quality' }],
    [{ text: '🔙 Назад', callback_data: 'faq_categories' }],
  ],

  afterAnswer: [
    [
      { text: '👍 Помогло', callback_data: 'faq_helpful' },
      { text: '👎 Не помогло', callback_data: 'faq_not_helpful' },
    ],
    [{ text: '📚 Другой вопрос', callback_data: 'faq_categories' }],
    [{ text: '🎫 Создать тикет', callback_data: 'create_ticket' }],
  ],

  backToMenu: [[{ text: '🔙 Главное меню', callback_data: 'main_menu' }]],

  ticketActions: (ticketNumber: string) => [
    [
      { text: '📝 Добавить сообщение', callback_data: `ticket_reply_${ticketNumber}` },
      { text: '✅ Закрыть тикет', callback_data: `ticket_close_${ticketNumber}` },
    ],
    [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
  ],

  feedbackRating: (ticketNumber: string) => [
    [
      { text: '⭐', callback_data: `rate_${ticketNumber}_1` },
      { text: '⭐⭐', callback_data: `rate_${ticketNumber}_2` },
      { text: '⭐⭐⭐', callback_data: `rate_${ticketNumber}_3` },
      { text: '⭐⭐⭐⭐', callback_data: `rate_${ticketNumber}_4` },
      { text: '⭐⭐⭐⭐⭐', callback_data: `rate_${ticketNumber}_5` },
    ],
  ],
}
