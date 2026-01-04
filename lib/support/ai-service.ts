// AI Service for Support Bot using Gemini

import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai'

const SYSTEM_PROMPT = `Ты — дружелюбный ассистент службы поддержки PinGlass (Розовые очки).

## О сервисе PinGlass:
PinGlass — AI-сервис для создания профессиональных фотопортретов.
- Пользователь загружает от 5 до 20 своих фотографий
- Выбирает тариф и получает AI-портреты за 5-10 минут
- Оплата: карты, СБП, SberPay, Telegram Stars, TON
- Сайт: pinglass.ru

## Тарифы:
1. **Starter** — 499₽, 7 AI-портретов (~71₽/фото)
2. **Standard** — 999₽, 15 AI-портретов (~67₽/фото) ⭐ Популярный
3. **Premium** — 1499₽, 23 AI-портрета (~65₽/фото)

Все тарифы включают скачивание в высоком качестве без водяных знаков!

## Требования к загружаемым фото:
- От 5 до 20 фотографий
- Максимальный размер файла: 30 МБ
- Форматы: JPEG, PNG, WebP, HEIC, HEIF
- Чёткие, хорошо освещённые
- Лицо хорошо видно (без масок)
- Разные ракурсы желательно
- НЕ подойдут: групповые, сильно отфильтрованные, с закрытым лицом

## Технические детали:
- Доступ привязан к Telegram аккаунту
- Фото хранятся бессрочно
- Фото отправляются в Telegram автоматически после генерации

## Твои правила:
1. Отвечай кратко (2-4 предложения)
2. Используй эмодзи умеренно
3. Если не знаешь ответ или проблема сложная — предложи создать тикет командой /ticket
4. Не придумывай несуществующие функции
5. Используй Markdown (*жирный*, _курсив_)
6. Если вопрос не про PinGlass — вежливо напомни, что ты помощник PinGlass
7. При проблемах с оплатой всегда предлагай создать тикет для проверки
8. Будь доброжелательным и терпеливым`

// In-memory chat sessions (resets on cold start in serverless)
const chatSessions: Map<number, ChatSession> = new Map()

export class AIService {
  private genAI: GoogleGenerativeAI
  private modelName: string

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    this.genAI = new GoogleGenerativeAI(apiKey)
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  }

  private createChatSession(userId: number): ChatSession {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM_PROMPT,
    })

    const chat = model.startChat({
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    })

    chatSessions.set(userId, chat)
    return chat
  }

  async generateResponse(userId: number, userMessage: string): Promise<string> {
    try {
      let chat = chatSessions.get(userId)

      if (!chat) {
        chat = this.createChatSession(userId)
      }

      const result = await chat.sendMessage(userMessage)
      const response = result.response.text()

      return response || 'Извините, не удалось сгенерировать ответ. Попробуйте ещё раз.'
    } catch (error: any) {
      console.error('[AI Service] Gemini error:', error.message)

      // Reset session on error
      if (error.message?.includes('session') || error.message?.includes('chat')) {
        chatSessions.delete(userId)
      }

      if (error.status === 429) {
        return '⏳ Слишком много запросов. Пожалуйста, подождите немного.'
      }

      if (error.status === 403) {
        return '⚠️ AI-ассистент временно недоступен. Попробуйте создать тикет /ticket'
      }

      return '❌ Произошла ошибка. Попробуйте позже или создайте тикет /ticket'
    }
  }

  /**
   * Generate AI suggestion for operator response
   */
  async generateOperatorSuggestion(
    userMessage: string,
    ticketHistory: { sender: string; message: string }[]
  ): Promise<{ suggestion: string; confidence: number }> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      })

      const historyContext = ticketHistory
        .slice(-5) // Last 5 messages
        .map((m) => `${m.sender}: ${m.message}`)
        .join('\n')

      const prompt = `Ты помощник оператора поддержки PinGlass. Предложи краткий ответ на сообщение пользователя.

История переписки:
${historyContext}

Последнее сообщение пользователя: ${userMessage}

Требования к ответу:
1. Краткий (1-3 предложения)
2. Профессиональный и дружелюбный
3. Если нужна информация от пользователя — запроси её
4. Если можешь помочь — предложи решение

Ответ:`

      const result = await model.generateContent(prompt)
      const suggestion = result.response.text()

      // Simple confidence based on response length and keywords
      let confidence = 0.7
      if (suggestion.length < 50) confidence -= 0.1
      if (suggestion.includes('?')) confidence -= 0.1 // Questions mean uncertainty
      if (suggestion.includes('проверю') || suggestion.includes('уточню')) confidence -= 0.1

      return {
        suggestion: suggestion || '',
        confidence: Math.max(0.3, Math.min(1.0, confidence)),
      }
    } catch (error) {
      console.error('[AI Service] Suggestion error:', error)
      return { suggestion: '', confidence: 0 }
    }
  }

  clearHistory(userId: number): void {
    chatSessions.delete(userId)
  }

  hasActiveSession(userId: number): boolean {
    return chatSessions.has(userId)
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null

export function getAIService(): AIService | null {
  if (!process.env.GEMINI_API_KEY) {
    return null
  }

  if (!aiServiceInstance) {
    try {
      aiServiceInstance = new AIService()
    } catch (error) {
      console.error('[AI Service] Failed to initialize:', error)
      return null
    }
  }

  return aiServiceInstance
}
