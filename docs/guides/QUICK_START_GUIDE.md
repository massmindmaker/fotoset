# Quick Start: Исправление генерации за 1 день

**Цель:** Исправить критические баги, которые приводят к потере денег и данных

---

## 🚨 ТОП-3 критических бага

### 1️⃣ Race Condition → Двойная генерация на один платеж

**Файл:** `app/api/generate/route.ts:433-590`

**Проблема:**
```typescript
// BAD: Проверяем payment, потом через 100 строк помечаем consumed
const payment = await sql`SELECT ... WHERE consumed = FALSE`
// ... много кода ...
const job = await sql`INSERT INTO generation_jobs ...`
await sql`UPDATE payments SET consumed = TRUE` // ← TOO LATE!
```

**Решение:**
```typescript
// GOOD: Помечаем consumed АТОМАРНО перед созданием job
const consumed = await sql`
  UPDATE payments SET consumed = TRUE
  WHERE id = ${id} AND consumed = FALSE
  RETURNING id
`
if (consumed.length === 0) {
  return error("PAYMENT_CONSUMED")
}
// Теперь безопасно создавать job
const job = await sql`INSERT INTO generation_jobs ...`
```

**Время:** 30 минут
**Тест:** Отправить 2 параллельных curl запроса — должен пройти только 1

---

### 2️⃣ Потеря данных при DB ошибке

**Файл:** `app/api/cron/poll-kie-tasks/route.ts:70-118`

**Проблема:**
```typescript
// BAD: Если INSERT падает, фото теряется навсегда
await sql`INSERT INTO generated_photos ...` // ← может упасть
await sql`UPDATE kie_tasks SET status = 'completed'` // ← уже completed!
```

**Решение:**
```typescript
// GOOD: Транзакция — либо все, либо ничего
try {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO generated_photos ...`
    await tx`UPDATE kie_tasks SET status = 'completed'`
    await tx`UPDATE generation_jobs SET completed_photos = ...`
  })
} catch (error) {
  // НЕ помечаем completed, retry на следующем cron
  await sql`UPDATE kie_tasks SET attempts = attempts + 1`
}
```

**Время:** 1 час
**Тест:** Симулировать DB ошибку (отключить интернет во время генерации)

---

### 3️⃣ QStash duplicate execution

**Файл:** `app/api/jobs/process/route.ts:17`

**Проблема:**
QStash может вызвать endpoint дважды при retry → создадутся дубликаты задач

**Решение:**
```typescript
// Добавить idempotency key checking
const messageId = request.headers.get("upstash-message-id")

const existing = await sql`
  SELECT id FROM qstash_processed_messages
  WHERE message_id = ${messageId}
`

if (existing.length > 0) {
  return NextResponse.json({ success: true, duplicate: true })
}

// ... process normally ...

await sql`
  INSERT INTO qstash_processed_messages (message_id)
  VALUES (${messageId})
`
```

**Время:** 45 минут
**Миграция:**
```sql
CREATE TABLE qstash_processed_messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(255) UNIQUE NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🛠️ Порядок действий

### Шаг 1: Создать миграции (15 минут)

```bash
# Migration 030: Unique constraint на payment_id
cat > scripts/run-migration-030.mjs << 'EOF'
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE generation_jobs
  ADD CONSTRAINT fk_payment_unique UNIQUE (payment_id)
`;

await sql`
  CREATE INDEX idx_payments_consumed
  ON payments (user_id, generation_consumed, created_at DESC)
  WHERE generation_consumed = FALSE
`;

console.log('✓ Migration 030 complete');
EOF

node scripts/run-migration-030.mjs
```

```bash
# Migration 031: QStash deduplication table
cat > scripts/run-migration-031.mjs << 'EOF'
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE qstash_processed_messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
  )
`;

await sql`
  CREATE INDEX idx_qstash_cleanup
  ON qstash_processed_messages (created_at)
`;

console.log('✓ Migration 031 complete');
EOF

node scripts/run-migration-031.mjs
```

---

### Шаг 2: Исправить race condition (30 минут)

**Файл:** `app/api/generate/route.ts`

Найти секцию:
```typescript
// Payment Validation (строка ~433)
```

Заменить:
```typescript
// Check if user has an AVAILABLE payment (not yet consumed for generation)
const availablePayment = await sql`
  SELECT id, amount, status, tier_id, photo_count FROM payments
  WHERE user_id = ${user.id}
    AND status = 'succeeded'
    AND COALESCE(generation_consumed, FALSE) = FALSE
  ORDER BY created_at DESC
  LIMIT 1
`.then((rows: any[]) => rows[0])

if (!availablePayment) {
  // ... error handling ...
}
```

На:
```typescript
// ATOMIC: Find available payment
const availablePayment = await sql`
  SELECT id, amount, status, tier_id, photo_count FROM payments
  WHERE user_id = ${user.id}
    AND status = 'succeeded'
    AND COALESCE(generation_consumed, FALSE) = FALSE
  ORDER BY created_at DESC
  LIMIT 1
`.then((rows: any[]) => rows[0])

if (!availablePayment) {
  // Check if user has ANY payment (better error message)
  const anyPayment = await sql`
    SELECT id FROM payments WHERE user_id = ${user.id} AND status = 'succeeded' LIMIT 1
  `.then((rows: any[]) => rows[0])

  if (anyPayment) {
    logger.warn("User has consumed all payments", { userId: user.id, telegramUserId: tgId })
    return error("PAYMENT_CONSUMED",
      "Ваш платёж уже использован. Для новой генерации необходима новая оплата.",
      { code: "PAYMENT_CONSUMED" }
    )
  }

  logger.warn("User has no successful payment", { userId: user.id, telegramUserId: tgId })
  return error("PAYMENT_REQUIRED", "Please complete payment before generating photos", {
    code: "PAYMENT_REQUIRED"
  })
}

logger.info("Payment validated (available for generation)", {
  userId: user.id,
  paymentId: availablePayment.id,
  amount: availablePayment.amount,
  tierId: availablePayment.tier_id
})
```

Затем найти секцию создания job (строка ~568):
```typescript
// Create generation job with payment_id binding
const job = await sql`
  INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos, payment_id)
  VALUES (${dbAvatarId}, ${styleId}, 'pending', ${totalPhotos}, ${availablePayment.id})
  RETURNING *
`.then((rows: any[]) => rows[0])

// CRITICAL: Mark payment as consumed IMMEDIATELY after job creation
await sql`
  UPDATE payments
  SET generation_consumed = TRUE,
      consumed_at = NOW(),
      consumed_avatar_id = ${dbAvatarId}
  WHERE id = ${availablePayment.id}
`
```

Заменить на:
```typescript
// CRITICAL: Mark payment as consumed BEFORE job creation (ATOMIC)
// This prevents race conditions where same payment could be used for multiple generations
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

if (consumedResult.length === 0) {
  logger.warn("Payment already consumed (race condition prevented)", {
    userId: user.id,
    paymentId: availablePayment.id,
    telegramUserId: tgId,
  })
  return error("PAYMENT_CONSUMED",
    "Ваш платёж уже использован. Для новой генерации необходима новая оплата.",
    { code: "PAYMENT_CONSUMED" }
  )
}

const payment = consumedResult[0]

// Now safe to create generation job
const job = await sql`
  INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos, payment_id)
  VALUES (${dbAvatarId}, ${styleId}, 'pending', ${totalPhotos}, ${payment.id})
  RETURNING *
`.then((rows: any[]) => rows[0])
```

---

### Шаг 3: Добавить QStash idempotency (45 минут)

**Файл:** `app/api/jobs/process/route.ts`

В начале функции POST добавить:
```typescript
export async function POST(request: Request) {
  // Verify QStash signature
  const { valid, body } = await verifyQStashSignature(request)

  if (!valid) {
    console.error("[Jobs/Process] Invalid QStash signature")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // NEW: Check idempotency (prevent duplicate execution)
  const messageId = request.headers.get("upstash-message-id")

  if (messageId) {
    const existing = await sql`
      SELECT id FROM qstash_processed_messages
      WHERE message_id = ${messageId}
      LIMIT 1
    `

    if (existing.length > 0) {
      console.log("[Jobs/Process] Duplicate QStash message (idempotency), skipping", {
        messageId
      })
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Already processed"
      })
    }
  }

  // ... rest of the function ...

  // Before returning success, mark as processed
  if (messageId) {
    await sql`
      INSERT INTO qstash_processed_messages (message_id, processed_at)
      VALUES (${messageId}, NOW())
      ON CONFLICT (message_id) DO NOTHING
    `
  }

  return NextResponse.json({
    success: true,
    // ... rest of response
  })
}
```

---

### Шаг 4: Добавить transactions в poll-kie-tasks (1 час)

**Файл:** `app/api/cron/poll-kie-tasks/route.ts`

Заменить секцию обработки completed tasks (строка ~52-118):

```typescript
if (result.status === "completed" && result.url) {
  // Upload to R2 if configured
  let finalImageUrl = result.url
  if (useR2) {
    try {
      const r2Key = generatePromptKey(
        task.avatar_id.toString(),
        task.style_id,
        task.prompt_index,
        "png"
      )
      const r2Result = await uploadFromUrl(result.url, r2Key)
      finalImageUrl = r2Result.url
    } catch (r2Error) {
      console.warn(`[Poll Kie Tasks] R2 upload failed:`, r2Error)
    }
  }

  // CRITICAL: Use transaction to ensure atomicity
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
          INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
          VALUES (${task.avatar_id}, ${task.style_id}, ${task.prompt}, ${finalImageUrl})
        `
        console.log(`[Poll Kie Tasks] ✓ Saved photo to generated_photos for prompt ${task.prompt_index}`)
      }

      // 2. Update task status ONLY after successful photo save
      await tx`
        UPDATE kie_tasks
        SET status = 'completed', result_url = ${finalImageUrl}, updated_at = NOW()
        WHERE id = ${task.id}
      `

      // 3. Update job progress
      const actualCount = await tx`
        SELECT COUNT(*) as count FROM generated_photos
        WHERE avatar_id = ${task.avatar_id} AND style_id = ${task.style_id}
      `

      await tx`
        UPDATE generation_jobs
        SET completed_photos = ${parseInt(actualCount[0]?.count || '0')}, updated_at = NOW()
        WHERE id = ${task.job_id}
      `
    })

    console.log(`[Poll Kie Tasks] ✓ Task ${task.kie_task_id} completed (photo ${actualCount}/${task.prompt_index + 1})`)
    completed++

  } catch (dbError) {
    // DB error - do NOT mark task as completed, retry on next cron
    console.error(`[Poll Kie Tasks] DB transaction failed for task ${task.kie_task_id}:`, dbError)

    // Increment attempts so we don't retry forever
    await sql`
      UPDATE kie_tasks
      SET attempts = attempts + 1, updated_at = NOW()
      WHERE id = ${task.id}
    `.catch(() => {})

    stillPending++
  }
}
```

---

### Шаг 5: Тестирование (30 минут)

```bash
# Test 1: Race condition
cat > test-race-condition.sh << 'EOF'
#!/bin/bash
echo "Testing race condition with parallel requests..."

curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"telegramUserId":123,"avatarId":"456","styleId":"professional","useStoredReferences":true}' &

curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"telegramUserId":123,"avatarId":"456","styleId":"professional","useStoredReferences":true}' &

wait
echo "✓ Only ONE should succeed with job creation"
EOF

chmod +x test-race-condition.sh
./test-race-condition.sh
```

```bash
# Test 2: Check migrations
psql $DATABASE_URL << 'EOF'
-- Should return constraint
\d generation_jobs

-- Should return table
\dt qstash_processed_messages

-- Should return index
\di idx_payments_consumed
EOF
```

---

### Шаг 6: Deploy (15 минут)

```bash
# Push to preview
git add -A
git commit -m "fix: prevent race condition, add idempotency, use transactions"
git push origin fix/generation-reliability

# Deploy to Vercel preview
vercel --prod=false

# Wait for deployment
vercel logs --follow
```

---

## ✅ Проверка результатов

### После деплоя проверить:

1. **Race condition исправлен**
   ```bash
   # 2 параллельных запроса
   # Ожидается: 1 успех, 1 ошибка PAYMENT_CONSUMED
   ```

2. **Миграции применены**
   ```sql
   SELECT constraint_name FROM information_schema.table_constraints
   WHERE table_name = 'generation_jobs' AND constraint_name = 'fk_payment_unique';
   ```

3. **QStash idempotency работает**
   ```bash
   # Проверить логи: должно быть "Duplicate QStash message"
   vercel logs | grep "Duplicate QStash"
   ```

4. **Транзакции работают**
   ```sql
   -- После генерации проверить:
   -- generated_photos.count = kie_tasks WHERE status='completed'
   SELECT
     (SELECT COUNT(*) FROM generated_photos WHERE avatar_id = 123) as photos,
     (SELECT COUNT(*) FROM kie_tasks WHERE avatar_id = 123 AND status = 'completed') as tasks;
   ```

---

## 🎉 Готово!

После этих исправлений система будет:
- ✅ Защищена от race conditions (app + DB уровни)
- ✅ Гарантировать сохранение всех фото (transactions)
- ✅ Предотвращать дубликаты задач (idempotency)

**Время:** ~2.5 часа
**Результат:** Надежная генерация без потери денег и данных

---

## 📚 Дополнительные материалы

- Полный план улучшений: `GENERATION_IMPROVEMENT_PLAN.md`
- Детальный анализ: `PAYMENT_GENERATION_ANALYSIS_2026-01-02.md`
