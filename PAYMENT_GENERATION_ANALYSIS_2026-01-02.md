# Анализ системы оплаты и генерации PinGlass

**Дата:** 2026-01-02
**Проверены:** Последние коммиты, код API, логика обработки

---

## 📊 Общее резюме

### ✅ Что работает корректно

1. **Платежная система (T-Bank)**
   - ✅ Корректная интеграция с T-Bank API
   - ✅ Защита от двойной траты через `generation_consumed` флаг
   - ✅ Webhook верификация с SHA256 подписью
   - ✅ Идемпотентность обработки вебхуков (защита от дубликатов)
   - ✅ Автоматический возврат при ошибках генерации
   - ✅ Динамическое переключение терминалов (test/prod) через админку
   - ✅ Сохранение всех вебхуков в `webhook_logs` для диагностики

2. **Система генерации (Kie.ai + QStash)**
   - ✅ Асинхронная обработка через QStash (предотвращает timeout на Vercel)
   - ✅ Chunked processing по 5 задач для обхода rate limits
   - ✅ Атомарная блокировка через SQL UPDATE для предотвращения дублирования
   - ✅ Polling через cron каждые 10 секунд (`/api/cron/poll-kie-tasks`)
   - ✅ Автоматическая отправка фото в Telegram после завершения
   - ✅ R2 storage интеграция для долговременного хранения

3. **Отказоустойчивость**
   - ✅ Cron job для детекции "застрявших" задач (`/api/cron/check-stuck-jobs`)
   - ✅ Авто-возврат при фатальных ошибках через `autoRefundForFailedGeneration()`
   - ✅ Retry логика для Kie.ai задач (до 30 попыток = 5 минут)
   - ✅ Детальное логирование всех этапов

---

## 🔍 Обнаруженные проблемы

### 🔴 КРИТИЧЕСКИЕ (требуют немедленного исправления)

#### 1. **Потеря данных при DB ошибке в poll-kie-tasks**

**Файл:** `app/api/cron/poll-kie-tasks/route.ts:70-118`

**Проблема:**
```typescript
// CRITICAL: Wrap DB operations in try/catch to prevent marking task as completed without saving photo
try {
  // Save to generated_photos
  await sql`INSERT INTO generated_photos ...`

  // Update task status ONLY after successful photo save
  await sql`UPDATE kie_tasks SET status = 'completed' ...`
} catch (dbError) {
  // DB error - do NOT mark task as completed, retry on next cron
  console.error(`[Poll Kie Tasks] DB error for task ${task.kie_task_id}:`, dbError)
  await sql`UPDATE kie_tasks SET attempts = attempts + 1 ...`
  stillPending++
}
```

**Риск:**
- Если `INSERT INTO generated_photos` падает (дубликат, constraint violation), фото НЕ сохраняется
- Но задача уже отмечена как `completed` в Kie.ai
- Результат: Потеря сгенерированного изображения

**Исправление:**
✅ Уже реализовано в коде! Есть проверка дубликатов перед INSERT:
```typescript
const existing = await sql`
  SELECT id FROM generated_photos
  WHERE avatar_id = ${task.avatar_id} AND style_id = ${task.style_id} AND prompt = ${task.prompt}
  LIMIT 1
`.then((rows: any[]) => rows[0])

if (!existing) {
  await sql`INSERT INTO generated_photos ...`
}
```

**Статус:** ✅ ИСПРАВЛЕНО (защита от дубликатов есть)

---

#### 2. **Race condition при множественных webhook вызовах**

**Файл:** `app/api/payment/webhook/route.ts:51-65`

**Проблема:**
```typescript
const updateResult = await sql`
  UPDATE payments
  SET status = 'succeeded', updated_at = NOW()
  WHERE tbank_payment_id = ${paymentId} AND status = 'pending'
  RETURNING id, user_id
`

if (updateResult.length === 0) {
  // Payment was already processed - this is a duplicate webhook
  log.debug(" Payment already processed (duplicate webhook):", paymentId)
  return NextResponse.json({ success: true }, { status: 200 })
}
```

**Анализ:**
✅ **Корректная идемпотентность!**
- Обновление только если `status = 'pending'`
- При дубликате webhook просто возвращает success

**Статус:** ✅ БЕЗ ПРОБЛЕМ (идемпотентность реализована правильно)

---

#### 3. **Возможность двойной генерации на один платеж**

**Файл:** `app/api/generate/route.ts:433-458`

**Проблема:**
Между проверкой `availablePayment` и пометкой `generation_consumed = TRUE` есть временной разрыв:

```typescript
// 1. Check payment available
const availablePayment = await sql`
  SELECT id FROM payments
  WHERE user_id = ${user.id} AND generation_consumed = FALSE
  LIMIT 1
`

// ... (много кода между проверкой и потреблением)

// 2. Create job (100+ строк кода после проверки)
const job = await sql`INSERT INTO generation_jobs ...`

// 3. Mark consumed
await sql`
  UPDATE payments SET generation_consumed = TRUE
  WHERE id = ${availablePayment.id}
`
```

**Сценарий атаки:**
1. Пользователь открывает 2 вкладки
2. Обе вкладки одновременно вызывают `/api/generate`
3. Обе проходят проверку `availablePayment` (еще не consumed)
4. Обе создают generation_job
5. Только вторая успешно помечает `consumed = TRUE`
6. Результат: **Две генерации на один платеж**

**Исправление:**
```typescript
// ATOMIC: Mark consumed BEFORE creating job
const consumedResult = await sql`
  UPDATE payments
  SET generation_consumed = TRUE, consumed_at = NOW()
  WHERE id = ${availablePayment.id} AND generation_consumed = FALSE
  RETURNING id
`

if (consumedResult.length === 0) {
  return error("PAYMENT_CONSUMED", "Payment already used")
}

// Now safe to create job
const job = await sql`INSERT INTO generation_jobs ...`
```

**Статус:** 🔴 УЯЗВИМОСТЬ (требует исправления)

---

### 🟡 СРЕДНИЕ (не критично, но требует внимания)

#### 4. **Отсутствие лимита на количество webhook вызовов**

**Файл:** `app/api/payment/webhook/route.ts`

**Проблема:**
- T-Bank может присылать webhook несколько раз при ретраях
- Нет rate limiting на endpoint
- Злоумышленник может flood webhook endpoint

**Рекомендация:**
Добавить Redis-based rate limiting через Upstash (уже есть QStash):
```typescript
const { Ratelimit } = await import("@upstash/ratelimit")
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 req / 10s per IP
})
```

**Статус:** 🟡 РЕКОМЕНДУЕТСЯ

---

#### 5. **Telegram delivery не гарантирован**

**Файл:** `app/api/cron/poll-kie-tasks/route.ts:253-386`

**Проблема:**
```typescript
async function sendPhotosToTelegram(avatarId: number) {
  try {
    // Send photos via Telegram API
    const response = await fetch(`https://api.telegram.org/bot.../sendPhoto`)
    const result = await response.json()

    if (result.ok) {
      await sql`INSERT INTO telegram_message_queue ... status = 'sent'`
    } else {
      await sql`INSERT INTO telegram_message_queue ... status = 'failed'`
    }
  } catch (error) {
    console.error("[Poll Kie Tasks] Failed to send photos to Telegram:", error)
    // НЕТ RETRY МЕХАНИЗМА!
  }
}
```

**Риск:**
- Если Telegram API недоступен, фото НЕ отправляются
- Пользователь получает фото только в веб-интерфейсе
- Нет автоматической retry логики

**Рекомендация:**
Использовать `telegram_message_queue` с retry worker:
```typescript
// Создать отдельный cron /api/cron/retry-telegram-queue
// который переотправляет failed сообщения каждые 5 минут
```

**Статус:** 🟡 УЛУЧШЕНИЕ (не критично, фото все равно доступны в вебе)

---

### 🟢 НИЗКИЕ (мелкие улучшения)

#### 6. **Избыточное логирование**

**Файлы:** Все API routes

**Проблема:**
```typescript
logger.info("Generation request received", { ... 15 полей ... })
logger.info("User resolved", { ... })
logger.info("Payment validated", { ... })
logger.info("Reference images validated", { ... })
```

**Рекомендация:**
- Использовать уровни `debug` для детальной инфы
- Оставить только критические `info` и `error`
- Добавить request ID для трейсинга

**Статус:** 🟢 ОПТИМИЗАЦИЯ

---

## 📈 Метрики и мониторинг

### Что мониторится

1. ✅ **Платежи**
   - `webhook_logs` сохраняет все вебхуки
   - `payments.status` трекает статус оплаты
   - `payments.generation_consumed` предотвращает двойное использование

2. ✅ **Генерация**
   - `generation_jobs.status` (pending → processing → completed/failed)
   - `kie_tasks.status` (pending → completed/failed)
   - `kie_tasks.attempts` для детекции зависших задач

3. ✅ **Автоматические проверки**
   - `/api/cron/check-stuck-jobs` (каждые 5 минут)
     - Детектирует jobs с `status = processing` и `updated_at > 10 min`
     - Автоматически помечает как `failed` + возврат средств
   - `/api/cron/poll-kie-tasks` (каждые 10 секунд)
     - Проверяет статус Kie.ai задач
     - Скачивает готовые изображения
     - Отправляет в Telegram

### Что НЕ мониторится

1. ❌ **QStash delivery rate**
   - Нет метрик: сколько jobs успешно доставлены в QStash
   - Решение: логировать `qstash.messageId` + проверять через QStash API

2. ❌ **Kie.ai rate limit errors**
   - Есть delay 200ms между задачами, но нет детекции 429 ошибок
   - Решение: добавить экспоненциальный backoff при rate limit

3. ❌ **R2 upload success rate**
   - Есть fallback на оригинальный URL, но нет метрики успеха
   - Решение: добавить счетчик `r2_upload_failures`

---

## 🎯 Рекомендации по улучшению

### Немедленно (критично)

1. **Исправить race condition в /api/generate**
   ```diff
   + // ATOMIC: Mark consumed BEFORE job creation
   + const consumedResult = await sql`
   +   UPDATE payments
   +   SET generation_consumed = TRUE, consumed_at = NOW()
   +   WHERE id = ${availablePayment.id} AND generation_consumed = FALSE
   +   RETURNING id
   + `
   + if (consumedResult.length === 0) {
   +   return error("PAYMENT_CONSUMED", "Payment already used")
   + }

     const job = await sql`INSERT INTO generation_jobs ...`

   - // Mark consumed AFTER job creation
   - await sql`UPDATE payments SET generation_consumed = TRUE ...`
   ```

### В ближайшее время (1-2 дня)

2. **Добавить rate limiting на webhook endpoint**
   - Использовать Upstash Rate Limit
   - Защитить от flood атак

3. **Улучшить Telegram delivery**
   - Создать retry worker для `telegram_message_queue`
   - Добавить exponential backoff (1 мин → 5 мин → 15 мин)

4. **Добавить health check endpoint**
   ```typescript
   // GET /api/health
   export async function GET() {
     const checks = {
       database: await checkDBConnection(),
       qstash: await checkQStashConfig(),
       tbank: await checkTBankConfig(),
       kie: await checkKieAPI(),
       telegram: await checkTelegramBot(),
     }
     return NextResponse.json(checks)
   }
   ```

### Долгосрочно (1-2 недели)

5. **Мигрировать на трансактивные очереди**
   - Заменить polling на Postgres LISTEN/NOTIFY
   - Или использовать BullMQ + Redis для очередей

6. **Добавить structured logging**
   - Использовать Pino или Winston
   - Добавить correlation ID для трейсинга

7. **Настроить алерты**
   - Vercel Monitor для 5xx ошибок
   - Webhook для Telegram при критических ошибках
   - Dashboard для метрик генерации

---

## 🧪 Тестовые сценарии для проверки

### Сценарий 1: Двойная оплата (race condition)

```bash
# Запустить 2 параллельных запроса
curl -X POST /api/generate -d '{
  "telegramUserId": 123,
  "avatarId": "456",
  "styleId": "professional",
  "useStoredReferences": true
}' &

curl -X POST /api/generate -d '{
  "telegramUserId": 123,
  "avatarId": "456",
  "styleId": "professional",
  "useStoredReferences": true
}' &
```

**Ожидаемый результат:**
- ✅ Только ОДИН запрос должен создать job
- ✅ Второй должен получить `PAYMENT_CONSUMED` ошибку

**Текущий результат (БАГ):**
- ❌ Оба запроса могут создать job

---

### Сценарий 2: Webhook дубликаты

```bash
# Отправить один webhook 3 раза подряд
for i in {1..3}; do
  curl -X POST /api/payment/webhook \
    -H "Content-Type: application/json" \
    -d '{"Status":"CONFIRMED","PaymentId":"123","Token":"..."}'
done
```

**Ожидаемый результат:**
- ✅ Только первый webhook обновляет `status = succeeded`
- ✅ Второй и третий возвращают `success: true` без изменений

**Текущий результат:**
- ✅ РАБОТАЕТ КОРРЕКТНО (идемпотентность реализована)

---

### Сценарий 3: Застрявшая генерация

```sql
-- Создать job со старым updated_at
INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos, updated_at)
VALUES (1, 'professional', 'processing', 23, NOW() - INTERVAL '15 minutes');
```

**Ожидаемый результат:**
- ✅ Cron `/api/cron/check-stuck-jobs` детектирует через 5 минут
- ✅ Помечает как `failed`
- ✅ Вызывает auto-refund

**Текущий результат:**
- ✅ РАБОТАЕТ (есть cron job)

---

## 📊 Статистика кодовой базы

### Размер критических файлов

| Файл | Строк | Функций | Комментариев | Логирования |
|------|-------|---------|--------------|-------------|
| `app/api/generate/route.ts` | 709 | 3 | ~50 | ~30 |
| `app/api/payment/create/route.ts` | 214 | 1 | ~20 | ~15 |
| `app/api/payment/webhook/route.ts` | 179 | 2 | ~15 | ~10 |
| `app/api/jobs/process/route.ts` | 199 | 1 | ~25 | ~20 |
| `app/api/cron/poll-kie-tasks/route.ts` | 387 | 3 | ~30 | ~25 |
| `app/api/cron/check-stuck-jobs/route.ts` | 194 | 1 | ~20 | ~15 |

**Итого:** ~1,882 строк критической бизнес-логики

### Покрытие тестами

❌ **0% - тестов НЕТ**

**Критичные области без тестов:**
1. Payment webhook processing
2. Generation job creation
3. QStash chunking logic
4. Auto-refund logic
5. Kie.ai task polling

**Рекомендация:**
Добавить integration tests с TestContainers (Postgres + mock T-Bank API)

---

## ✅ Выводы

### Работает хорошо
- ✅ Платежная интеграция с T-Bank корректна
- ✅ Webhook обработка идемпотентна
- ✅ Асинхронная генерация через QStash работает
- ✅ Автоматический возврат средств настроен
- ✅ Детальное логирование присутствует

### Требует исправления
- 🔴 **Race condition в /api/generate** (двойная генерация на один платеж)
- 🟡 Отсутствие rate limiting на webhook
- 🟡 Telegram delivery без retry механизма

### Следующие шаги
1. Исправить race condition (приоритет 1)
2. Добавить rate limiting (приоритет 2)
3. Написать integration tests (приоритет 3)
4. Настроить мониторинг и алерты (приоритет 4)

---

**Автор:** Claude (AI Code Analysis)
**Дата:** 2026-01-02
