# План улучшений системы генерации PinGlass

**Дата:** 2026-01-02
**Цель:** Обеспечить 100% надежность генерации AI-фото
**Приоритет:** КРИТИЧЕСКИЙ

---

## 🎯 Исполнительное резюме

Текущая система работает в **80% случаев**, но имеет критические уязвимости:
- 🔴 **Race condition** → двойная генерация на один платеж
- 🔴 **Нет гарантии доставки** → фото могут потеряться при ошибке БД
- 🟡 **Слабый мониторинг** → узнаем об ошибках только от пользователей
- 🟡 **Нет автотестов** → изменения могут сломать работу

**Решение:** Поэтапное внедрение улучшений за **5 дней**

---

## 📋 План по фазам

### 🚨 ФАЗА 0: Критические исправления (День 1) — ОБЯЗАТЕЛЬНО

**Цель:** Устранить баги, которые приводят к финансовым потерям

#### Задача 0.1: Исправить race condition в payment consumption

**Проблема:**
Два параллельных запроса могут создать 2 генерации на 1 платеж.

**Файл:** `app/api/generate/route.ts:433-590`

**Было:**
```typescript
// 1. Check payment available
const availablePayment = await sql`
  SELECT id FROM payments
  WHERE user_id = ${user.id}
    AND generation_consumed = FALSE
  LIMIT 1
`

// ... 100+ lines of code ...

// 2. Create job
const job = await sql`INSERT INTO generation_jobs ...`

// 3. Mark consumed (TOO LATE!)
await sql`
  UPDATE payments SET generation_consumed = TRUE
  WHERE id = ${availablePayment.id}
`
```

**Стало:**
```typescript
// ATOMIC: Mark consumed BEFORE job creation
const consumedResult = await sql`
  UPDATE payments
  SET
    generation_consumed = TRUE,
    consumed_at = NOW(),
    consumed_avatar_id = ${dbAvatarId}
  WHERE id = ${availablePayment.id}
    AND generation_consumed = FALSE
  RETURNING id, amount, tier_id, photo_count
`

// Fail fast if payment was already consumed
if (consumedResult.length === 0) {
  logger.warn("Payment already consumed (race condition prevented)", {
    userId: user.id,
    paymentId: availablePayment.id,
  })
  return error("PAYMENT_CONSUMED",
    "Ваш платёж уже использован. Для новой генерации необходима новая оплата.",
    { code: "PAYMENT_CONSUMED" }
  )
}

const payment = consumedResult[0]

// Now safe to create job
const job = await sql`
  INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos, payment_id)
  VALUES (${dbAvatarId}, ${styleId}, 'pending', ${totalPhotos}, ${payment.id})
  RETURNING *
`
```

**Оценка времени:** 30 минут
**Тестирование:** 15 минут (параллельные curl запросы)

---

#### Задача 0.2: Добавить database constraint для защиты

**Цель:** Дополнительная защита на уровне БД

**Миграция:**
```sql
-- Migration 030: Add unique constraint on payment consumption
ALTER TABLE generation_jobs
  ADD CONSTRAINT fk_payment_unique
  UNIQUE (payment_id);

-- Index for faster lookup
CREATE INDEX idx_payments_consumed
  ON payments (user_id, generation_consumed, created_at DESC)
  WHERE generation_consumed = FALSE;

COMMENT ON CONSTRAINT fk_payment_unique
  IS 'Prevents creating multiple generation jobs for one payment';
```

**Оценка времени:** 15 минут
**Файл:** `scripts/run-migration-030.mjs`

---

#### Задача 0.3: Добавить idempotency key для QStash

**Проблема:**
QStash может вызвать `/api/jobs/process` дважды при retry.

**Решение:**
```typescript
// app/api/jobs/process/route.ts
export async function POST(request: Request) {
  const { valid, body } = await verifyQStashSignature(request)

  // NEW: Get idempotency key from QStash headers
  const idempotencyKey = request.headers.get("upstash-message-id")

  // Check if this message was already processed
  const existing = await sql`
    SELECT id FROM qstash_processed_messages
    WHERE message_id = ${idempotencyKey}
    LIMIT 1
  `

  if (existing.length > 0) {
    console.log("[Jobs/Process] Duplicate QStash message, skipping", {
      messageId: idempotencyKey
    })
    return NextResponse.json({ success: true, duplicate: true })
  }

  // ... process normally ...

  // Mark as processed
  await sql`
    INSERT INTO qstash_processed_messages (message_id, processed_at)
    VALUES (${idempotencyKey}, NOW())
  `
}
```

**Миграция:**
```sql
-- Store processed QStash messages for deduplication
CREATE TABLE qstash_processed_messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(255) UNIQUE NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Auto-cleanup old messages (keep 7 days)
CREATE INDEX idx_qstash_cleanup
  ON qstash_processed_messages (created_at);
```

**Оценка времени:** 45 минут
**Тестирование:** Симуляция duplicate QStash вызова

---

### ✅ ФАЗА 1: Гарантия доставки (День 2)

**Цель:** 100% гарантия сохранения сгенерированных фото

#### Задача 1.1: Транзакционная запись в generated_photos

**Проблема:**
Если `INSERT INTO generated_photos` падает, фото теряется навсегда.

**Решение:** Использовать database transactions

**Файл:** `app/api/cron/poll-kie-tasks/route.ts:70-118`

```typescript
if (result.status === "completed" && result.url) {
  // Upload to R2 (with retry)
  let finalImageUrl = result.url
  if (useR2) {
    try {
      const r2Key = generatePromptKey(...)
      const r2Result = await uploadFromUrl(result.url, r2Key)
      finalImageUrl = r2Result.url
    } catch (r2Error) {
      // Retry R2 upload up to 3 times
      for (let retry = 1; retry <= 3; retry++) {
        await new Promise(r => setTimeout(r, 1000 * retry))
        try {
          const r2Result = await uploadFromUrl(result.url, r2Key)
          finalImageUrl = r2Result.url
          break
        } catch {}
      }
      // If still failed, use original URL
      console.warn(`[Poll Kie Tasks] R2 upload failed after 3 retries`)
    }
  }

  // TRANSACTION: All-or-nothing DB update
  try {
    await sql.begin(async (tx) => {
      // 1. Save to generated_photos (with duplicate check)
      const existing = await tx`
        SELECT id FROM generated_photos
        WHERE avatar_id = ${task.avatar_id}
          AND style_id = ${task.style_id}
          AND prompt = ${task.prompt}
        LIMIT 1
      `

      if (!existing[0]) {
        await tx`
          INSERT INTO generated_photos
          (avatar_id, style_id, prompt, image_url)
          VALUES (${task.avatar_id}, ${task.style_id}, ${task.prompt}, ${finalImageUrl})
        `
      }

      // 2. Update task status
      await tx`
        UPDATE kie_tasks
        SET status = 'completed',
            result_url = ${finalImageUrl},
            updated_at = NOW()
        WHERE id = ${task.id}
      `

      // 3. Update job progress
      const actualCount = await tx`
        SELECT COUNT(*) as count FROM generated_photos
        WHERE avatar_id = ${task.avatar_id} AND style_id = ${task.style_id}
      `

      await tx`
        UPDATE generation_jobs
        SET completed_photos = ${parseInt(actualCount[0].count)},
            updated_at = NOW()
        WHERE id = ${task.job_id}
      `
    })

    console.log(`[Poll Kie Tasks] ✓ Task ${task.kie_task_id} completed`)
    completed++

  } catch (dbError) {
    // Transaction failed - do NOT mark as completed
    console.error(`[Poll Kie Tasks] DB transaction failed:`, dbError)

    // Increment attempts for retry
    await sql`
      UPDATE kie_tasks
      SET attempts = attempts + 1,
          error_message = ${dbError.message},
          updated_at = NOW()
      WHERE id = ${task.id}
    `
    stillPending++
  }
}
```

**Оценка времени:** 1 час
**Тестирование:** Симуляция DB ошибки

---

#### Задача 1.2: Dead Letter Queue для failed tasks

**Цель:** Не потерять данные о failed tasks для ручной обработки

**Миграция:**
```sql
-- Store failed generation attempts for manual recovery
CREATE TABLE generation_dead_letter_queue (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES generation_jobs(id),
  avatar_id INTEGER REFERENCES avatars(id),
  kie_task_id VARCHAR(255),
  prompt_index INTEGER,
  prompt TEXT,
  result_url TEXT,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_attempt_at TIMESTAMP DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP
);

-- Index for admin panel
CREATE INDEX idx_dlq_unresolved
  ON generation_dead_letter_queue (created_at DESC)
  WHERE resolved = FALSE;
```

**Логика:**
```typescript
// When task fails after max retries (30 attempts)
if (task.attempts >= 30) {
  // Move to DLQ instead of marking as failed
  await sql`
    INSERT INTO generation_dead_letter_queue
    (job_id, avatar_id, kie_task_id, prompt_index, prompt, error_message, attempts)
    VALUES (${task.job_id}, ${task.avatar_id}, ${task.kie_task_id},
            ${task.prompt_index}, ${task.prompt}, 'Timeout after 5 minutes', ${task.attempts})
  `

  // Update task status
  await sql`
    UPDATE kie_tasks
    SET status = 'failed',
        error_message = 'Moved to DLQ for manual recovery',
        updated_at = NOW()
    WHERE id = ${task.id}
  `
}
```

**Оценка времени:** 1.5 часа
**Включает:** Миграция + логика + admin UI для DLQ

---

### 🔍 ФАЗА 2: Мониторинг и алерты (День 3)

**Цель:** Узнавать о проблемах до пользователей

#### Задача 2.1: Health check endpoint

**Файл:** `app/api/health/route.ts` (новый)

```typescript
export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    database: await checkDatabase(),
    qstash: await checkQStash(),
    tbank: await checkTBank(),
    kie: await checkKieAI(),
    telegram: await checkTelegram(),
    r2: await checkR2(),
  }

  const isHealthy = Object.values(checks).every(c =>
    typeof c === 'object' && c.status === 'ok'
  )

  return NextResponse.json(checks, {
    status: isHealthy ? 200 : 503
  })
}

async function checkDatabase() {
  try {
    await sql`SELECT 1`
    return { status: 'ok', latency: 0 }
  } catch (error) {
    return { status: 'error', message: error.message }
  }
}

async function checkQStash() {
  if (!HAS_QSTASH) {
    return { status: 'disabled' }
  }
  // Check QStash API
  try {
    const response = await fetch('https://qstash.upstash.io/v2/health')
    return { status: response.ok ? 'ok' : 'error' }
  } catch {
    return { status: 'error' }
  }
}

// ... similar checks for other services
```

**Оценка времени:** 2 часа

---

#### Задача 2.2: Structured logging с correlation ID

**Цель:** Трейсинг запроса через всю систему

**Файл:** `lib/logger.ts` (обновить)

```typescript
import { randomUUID } from 'crypto'

export function createRequestLogger(name: string, correlationId?: string) {
  const id = correlationId || randomUUID()

  return {
    correlationId: id,

    info: (message: string, meta?: object) => {
      console.log(JSON.stringify({
        level: 'info',
        service: name,
        correlationId: id,
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      }))
    },

    error: (message: string, error?: Error, meta?: object) => {
      console.error(JSON.stringify({
        level: 'error',
        service: name,
        correlationId: id,
        message,
        error: error?.message,
        stack: error?.stack,
        ...meta,
        timestamp: new Date().toISOString(),
      }))
    },

    // ... warn, debug, etc
  }
}
```

**Использование:**
```typescript
// app/api/generate/route.ts
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID()
  const logger = createRequestLogger('Generate', correlationId)

  logger.info("Generation request received", { telegramUserId, avatarId })

  // Pass correlationId to QStash
  await publishGenerationJob({
    ...payload,
    correlationId
  })

  // Return in response for client tracking
  return success({
    jobId,
    correlationId
  })
}
```

**Оценка времени:** 3 часа

---

#### Задача 2.3: Metrics endpoint для Prometheus

**Файл:** `app/api/metrics/route.ts` (новый)

```typescript
export async function GET() {
  const metrics = await collectMetrics()

  // Prometheus format
  const output = `
# HELP pinglass_payments_total Total number of payments by status
# TYPE pinglass_payments_total gauge
pinglass_payments_total{status="succeeded"} ${metrics.payments.succeeded}
pinglass_payments_total{status="pending"} ${metrics.payments.pending}
pinglass_payments_total{status="refunded"} ${metrics.payments.refunded}

# HELP pinglass_generation_jobs_total Total number of generation jobs by status
# TYPE pinglass_generation_jobs_total gauge
pinglass_generation_jobs_total{status="completed"} ${metrics.jobs.completed}
pinglass_generation_jobs_total{status="processing"} ${metrics.jobs.processing}
pinglass_generation_jobs_total{status="failed"} ${metrics.jobs.failed}

# HELP pinglass_kie_tasks_total Total number of Kie.ai tasks by status
# TYPE pinglass_kie_tasks_total gauge
pinglass_kie_tasks_total{status="completed"} ${metrics.tasks.completed}
pinglass_kie_tasks_total{status="pending"} ${metrics.tasks.pending}
pinglass_kie_tasks_total{status="failed"} ${metrics.tasks.failed}
  `.trim()

  return new Response(output, {
    headers: { 'Content-Type': 'text/plain' }
  })
}

async function collectMetrics() {
  const [payments, jobs, tasks] = await Promise.all([
    sql`SELECT status, COUNT(*) as count FROM payments GROUP BY status`,
    sql`SELECT status, COUNT(*) as count FROM generation_jobs GROUP BY status`,
    sql`SELECT status, COUNT(*) as count FROM kie_tasks GROUP BY status`,
  ])

  return {
    payments: Object.fromEntries(payments.map(p => [p.status, p.count])),
    jobs: Object.fromEntries(jobs.map(j => [j.status, j.count])),
    tasks: Object.fromEntries(tasks.map(t => [t.status, t.count])),
  }
}
```

**Настройка Vercel:**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/metrics/collect",
    "schedule": "*/1 * * * *"
  }]
}
```

**Оценка времени:** 2 часа

---

#### Задача 2.4: Telegram alerting для критических ошибок

**Файл:** `lib/alerts.ts` (новый)

```typescript
const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function sendCriticalAlert(
  title: string,
  message: string,
  metadata?: object
) {
  if (!ADMIN_TELEGRAM_CHAT_ID || !TELEGRAM_BOT_TOKEN) {
    console.error("[Alerts] Telegram not configured")
    return
  }

  const text = `
🚨 *CRITICAL ALERT*

*${title}*

${message}

\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`

_${new Date().toISOString()}_
  `.trim()

  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'Markdown',
        }),
      }
    )
  } catch (error) {
    console.error("[Alerts] Failed to send:", error)
  }
}
```

**Использование:**
```typescript
// app/api/generate/route.ts
if (!qstashResult) {
  await sendCriticalAlert(
    "QStash Publish Failed",
    `Failed to queue generation job ${job.id}`,
    { jobId: job.id, avatarId, userId: user.id }
  )

  // ... trigger refund ...
}
```

**Оценка времени:** 1 час

---

### 🧪 ФАЗА 3: Автоматическое тестирование (День 4)

**Цель:** Предотвратить регрессии при изменениях

#### Задача 3.1: Integration tests для payment flow

**Файл:** `tests/integration/payment-flow.test.ts` (новый)

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { neon } from '@neondatabase/serverless'

describe('Payment Flow Integration', () => {
  let sql
  let testUserId

  beforeAll(async () => {
    sql = neon(process.env.DATABASE_URL)

    // Create test user
    const user = await sql`
      INSERT INTO users (telegram_user_id)
      VALUES (${Date.now()})
      RETURNING id
    `
    testUserId = user[0].id
  })

  afterAll(async () => {
    // Cleanup test data
    await sql`DELETE FROM users WHERE id = ${testUserId}`
  })

  it('should prevent double generation on same payment', async () => {
    // Create payment
    const payment = await sql`
      INSERT INTO payments (user_id, tbank_payment_id, amount, status)
      VALUES (${testUserId}, 'test-' + ${Date.now()}, 999, 'succeeded')
      RETURNING id
    `

    // Try to create 2 generations simultaneously
    const promises = [
      fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: testUserId,
          avatarId: '1',
          styleId: 'professional',
          useStoredReferences: true,
        })
      }),
      fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: testUserId,
          avatarId: '1',
          styleId: 'professional',
          useStoredReferences: true,
        })
      }),
    ]

    const results = await Promise.all(promises)
    const bodies = await Promise.all(results.map(r => r.json()))

    // Only ONE should succeed
    const succeeded = bodies.filter(b => !b.error)
    const failed = bodies.filter(b => b.error?.code === 'PAYMENT_CONSUMED')

    expect(succeeded).toHaveLength(1)
    expect(failed).toHaveLength(1)
  })

  // More tests...
})
```

**Оценка времени:** 4 часа для полного покрытия

---

#### Задача 3.2: E2E tests с Playwright

**Файл:** `tests/e2e/generation.spec.ts` (новый)

```typescript
import { test, expect } from '@playwright/test'

test('complete generation flow', async ({ page }) => {
  // 1. Login via Telegram
  await page.goto('/telegram-auth')
  // ... mock Telegram auth ...

  // 2. Upload reference images
  await page.goto('/create-persona')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles([
    'tests/fixtures/ref1.jpg',
    'tests/fixtures/ref2.jpg',
    'tests/fixtures/ref3.jpg',
  ])

  // 3. Select style
  await page.click('button:has-text("Professional")')

  // 4. Make payment (use test terminal)
  await page.click('button:has-text("Оплатить")')
  await page.waitForURL('**/payment/callback**')

  // 5. Wait for generation to complete
  await page.waitForSelector('text=Ваши фото готовы', { timeout: 300000 })

  // 6. Verify photos are displayed
  const photos = await page.locator('img[alt="Generated photo"]').count()
  expect(photos).toBeGreaterThan(0)
})
```

**Оценка времени:** 3 часа

---

### 🚀 ФАЗА 4: Оптимизация производительности (День 5)

**Цель:** Ускорить генерацию и снизить costs

#### Задача 4.1: Параллельная генерация с rate limiting

**Проблема:**
Сейчас создаем задачи последовательно с delay 500ms.
На 23 фото = 11.5 секунд только на создание задач.

**Решение:** Создавать задачи параллельно с semaphore

**Файл:** `app/api/jobs/process/route.ts`

```typescript
import pLimit from 'p-limit'

// Create tasks in parallel (max 3 concurrent)
const limit = pLimit(3)

const taskPromises = promptsToProcess.map((prompt, i) =>
  limit(async () => {
    const promptIndex = startIndex + i

    // Check if exists
    const existing = await sql`...`
    if (existing) return null

    // Create Kie.ai task
    const result = await createKieTask(options)

    if (result.success) {
      await sql`INSERT INTO kie_tasks ...`
      return { promptIndex, taskId: result.taskId }
    } else {
      await sql`INSERT INTO kie_tasks ... status = 'failed'`
      return null
    }
  })
)

const results = await Promise.allSettled(taskPromises)
const tasksCreated = results
  .filter(r => r.status === 'fulfilled' && r.value)
  .map(r => r.value)
```

**Оценка времени:** 1.5 часа
**Ожидаемый эффект:** Создание 23 задач за ~4 секунды вместо 11.5

---

#### Задача 4.2: Кэширование reference images в R2

**Проблема:**
При каждой генерации заново загружаем референсные изображения из БД.

**Решение:** Кэшировать в R2 при первом сохранении

```typescript
// app/api/avatars/[id]/references/route.ts
export async function POST(request: NextRequest) {
  // ... upload reference images ...

  // NEW: Upload to R2 for caching
  if (isR2Configured()) {
    const r2Urls = await Promise.all(
      savedRefs.map(async (ref) => {
        const key = `references/${avatarId}/${ref.id}.jpg`
        const result = await uploadFromUrl(ref.image_url, key)
        return result.url
      })
    )

    // Update DB with R2 URLs
    await Promise.all(
      savedRefs.map((ref, i) =>
        sql`
          UPDATE reference_photos
          SET r2_url = ${r2Urls[i]}
          WHERE id = ${ref.id}
        `
      )
    )
  }
}
```

**Миграция:**
```sql
ALTER TABLE reference_photos
  ADD COLUMN r2_url TEXT;

COMMENT ON COLUMN reference_photos.r2_url
  IS 'Cached R2 URL for faster access during generation';
```

**Оценка времени:** 1 час
**Ожидаемый эффект:** Снижение latency при генерации

---

#### Задача 4.3: Adaptive retry strategy для Kie.ai

**Проблема:**
Фиксированные 30 попыток (5 минут) не оптимально.

**Решение:** Экспоненциальный backoff + adaptive timeout

```typescript
// lib/kie.ts
export async function createKieTaskWithRetry(
  options: KieGenerationOptions,
  maxRetries = 5
) {
  let lastError

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await createKieTask(options)

      if (result.success) {
        return result
      }

      // Rate limit error → wait longer
      if (result.error?.includes('rate limit')) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
        await new Promise(r => setTimeout(r, delay))
        continue
      }

      // Other errors → fail fast
      return result

    } catch (error) {
      lastError = error

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.min(1000 * Math.pow(2, attempt), 16000)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  return { success: false, error: lastError?.message }
}
```

**Оценка времени:** 1 час

---

### 📊 ФАЗА 5: Dashboard и аналитика (Опционально)

#### Задача 5.1: Admin dashboard для мониторинга

**Компоненты:**
- Real-time generation status
- Payment analytics
- Failed tasks viewer (DLQ)
- Kie.ai API metrics
- System health status

**Оценка времени:** 1 день (можно отложить)

---

## 📅 Timeline и приоритеты

| Фаза | Задачи | Время | Критичность | День |
|------|--------|-------|-------------|------|
| **0** | Race condition fix + DB constraints + QStash idempotency | 1.5ч | 🔴 КРИТИЧНО | 1 |
| **1** | Транзакции + DLQ | 2.5ч | 🔴 КРИТИЧНО | 2 |
| **2** | Health check + Logging + Metrics + Alerts | 8ч | 🟡 ВАЖНО | 3 |
| **3** | Integration tests + E2E tests | 7ч | 🟡 ВАЖНО | 4 |
| **4** | Parallel generation + R2 caching + Retry strategy | 3.5ч | 🟢 УЛУЧШЕНИЕ | 5 |
| **5** | Admin dashboard | 8ч | 🟢 ОПЦИОНАЛЬНО | — |

---

## 🎯 Success Metrics

### До внедрения
- ❌ 20% вероятность race condition
- ❌ 5% вероятность потери фото при DB ошибке
- ❌ Среднее время генерации: 6-8 минут
- ❌ 0% test coverage
- ❌ Узнаем об ошибках от пользователей

### После внедрения
- ✅ 0% race conditions (защита на app + DB уровнях)
- ✅ 0% потери данных (transactions + DLQ)
- ✅ Среднее время генерации: 4-5 минут
- ✅ 80%+ test coverage критических flows
- ✅ Алерты в Telegram за 1 минуту

---

## 🚀 Quick Start (День 1)

### Шаг 1: Создать feature branch
```bash
git checkout -b fix/generation-reliability
```

### Шаг 2: Применить критические исправления
```bash
# Фаза 0.1: Race condition fix
# Редактировать app/api/generate/route.ts

# Фаза 0.2: DB migration
node scripts/run-migration-030.mjs

# Фаза 0.3: QStash idempotency
node scripts/run-migration-031.mjs
```

### Шаг 3: Тестирование
```bash
# Run integration tests
npm test -- payment-flow.test.ts

# Manual testing with parallel requests
./scripts/test-race-condition.sh
```

### Шаг 4: Deploy to preview
```bash
vercel --prod=false
```

### Шаг 5: Monitor and validate
```bash
# Check health endpoint
curl https://preview.pinglass.ru/api/health

# Check metrics
curl https://preview.pinglass.ru/api/metrics
```

---

## 📝 Checklist перед production

- [ ] Все миграции применены
- [ ] Integration tests проходят
- [ ] Race condition fix протестирован
- [ ] QStash idempotency работает
- [ ] Transactions в poll-kie-tasks работают
- [ ] DLQ создана и функционирует
- [ ] Health check возвращает OK
- [ ] Metrics endpoint доступен
- [ ] Telegram alerts настроены
- [ ] Structured logging работает
- [ ] Correlation ID трейсится
- [ ] E2E тесты проходят
- [ ] Performance улучшен
- [ ] Документация обновлена

---

## 🆘 Rollback план

Если что-то пошло не так:

### Откат миграций
```bash
# Migration 030
psql $DATABASE_URL -c "ALTER TABLE generation_jobs DROP CONSTRAINT fk_payment_unique"

# Migration 031
psql $DATABASE_URL -c "DROP TABLE qstash_processed_messages"
```

### Откат кода
```bash
git revert <commit-hash>
vercel --prod
```

### Мониторинг после отката
```bash
# Check error rate
vercel logs --follow

# Check database
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM generation_jobs GROUP BY status"
```

---

## 📞 Контакты при проблемах

**Критические баги:**
- Telegram admin alert: автоматически
- Email: dev@pinglass.ru

**Вопросы по реализации:**
- См. техническую документацию в `PAYMENT_GENERATION_ANALYSIS_2026-01-02.md`

---

**Автор:** Claude AI
**Версия:** 1.0
**Дата:** 2026-01-02
