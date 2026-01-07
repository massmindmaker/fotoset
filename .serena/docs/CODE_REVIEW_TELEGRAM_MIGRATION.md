# Code Review: Telegram User ID Migration

**Дата:** 2025-12-16
**Commit:** bf8d803
**Ревьюеры:** 4 параллельных субагента (code-reviewer)

---

## Сводка

| Категория | Критических | Высоких | Средних |
|-----------|-------------|---------|---------|
| Security | 3 | 2 | 1 |
| Code Quality | 1 | 2 | 2 |
| **Итого** | **4** | **4** | **3** |

---

## КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. Telegram User ID Spoofing — Authentication Bypass
**Уверенность: 100%** | **Severity: CRITICAL** | **Статус: НЕ ИСПРАВЛЕНО**

**Файл:** `components/persona-app.tsx:62-70`

```typescript
// УЯЗВИМЫЙ КОД
const tg = (window as any).Telegram?.WebApp
const telegramUserId = tg?.initDataUnsafe?.user?.id // ← Не верифицирован!
```

**Атака:**
```javascript
window.Telegram = { WebApp: { initDataUnsafe: { user: { id: 123456789 } } } }
```

**Решение:** Валидировать `initData` на сервере через HMAC-SHA256:

```typescript
// В /api/telegram/auth
import crypto from 'crypto';

function validateTelegramWebAppData(initData: string): { valid: boolean; userId?: number } {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) return { valid: false };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(TELEGRAM_BOT_TOKEN)
    .digest();

  const computedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return { valid: false };

  const user = JSON.parse(params.get('user') || '{}');
  return { valid: true, userId: user.id };
}
```

---

### 2. Race Condition в findOrCreateUser
**Уверенность: 95%** | **Severity: CRITICAL** | **Статус: НЕ ИСПРАВЛЕНО**

**Файл:** `lib/user-identity.ts:28-72`

```typescript
// УЯЗВИМЫЙ КОД - check-then-act
const existingUsers = await sql`SELECT * FROM users WHERE telegram_user_id = ${telegramUserId}`
if (existingUsers.length === 0) {
  await sql`INSERT INTO users ...` // ← Race condition!
}
```

**Решение:** Использовать `INSERT ... ON CONFLICT`:

```typescript
const result = await sql`
  INSERT INTO users (telegram_user_id, device_id)
  VALUES (${telegramUserId}, ${deviceId || `tg_${telegramUserId}`})
  ON CONFLICT (telegram_user_id) DO UPDATE
  SET device_id = COALESCE(EXCLUDED.device_id, users.device_id),
      updated_at = NOW()
  RETURNING *
`
return result[0] as User
```

---

### 3. Authorization Bypass — Silent Fallback
**Уверенность: 95%** | **Severity: CRITICAL** | **Статус: НЕ ИСПРАВЛЕНО**

**Файлы:**
- `app/api/avatars/route.ts:62-73`
- `app/api/generate/route.ts:300-319`

```typescript
// УЯЗВИМЫЙ КОД
if (telegramUserId) { user = ... }
if (!user && deviceId) { user = ... }  // ← Тихий fallback!
```

**Решение:** Если указан `telegram_user_id` — искать ТОЛЬКО по нему:

```typescript
let user
if (telegramUserId) {
  user = await sql`
    SELECT id FROM users WHERE telegram_user_id = ${parseInt(telegramUserId)}
  `.then((rows) => rows[0])

  if (!user) {
    return error("UNAUTHORIZED", "Telegram user not found")
  }
} else if (deviceId) {
  user = await sql`
    SELECT id FROM users WHERE device_id = ${deviceId}
  `.then((rows) => rows[0])
}
```

---

### 4. Memory Leak — Polling Intervals
**Уверенность: 95%** | **Severity: HIGH** | **Статус: НЕ ИСПРАВЛЕНО**

**Файл:** `components/persona-app.tsx:332-381, 685-737`

```typescript
// ПРОБЛЕМА - interval не очищается при unmount
const pollInterval = setInterval(..., 3000)
```

**Решение:**

```typescript
const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

// В useEffect для resume_payment и handleGenerate:
pollIntervalRef.current = setInterval(...)

// Добавить cleanup useEffect:
useEffect(() => {
  return () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }
  }
}, [])
```

---

## ВАЖНЫЕ ПРОБЛЕМЫ

### 5. NaN Validation для parseInt
**Файл:** `lib/user-identity.ts:124`, `app/api/avatars/route.ts:66`

```typescript
// Добавить валидацию:
const parsedId = parseInt(telegramUserId)
if (isNaN(parsedId)) {
  return error("VALIDATION_ERROR", "Invalid telegram_user_id format")
}
```

### 6. URL Injection в successUrl
**Файл:** `app/api/payment/create/route.ts:63-65`

```typescript
// ИСПРАВИТЬ:
const successUrl = telegramUserId
  ? `${baseUrl}/payment/callback?telegram_user_id=${encodeURIComponent(String(telegramUserId))}`
  : `${baseUrl}/payment/callback?device_id=${encodeURIComponent(deviceId || '')}`
```

### 7. Inconsistent Error Format
**Файлы:** `app/api/payment/create/route.ts`, `app/api/payment/status/route.ts`

```typescript
// ЗАМЕНИТЬ NextResponse.json на error():
import { error } from "@/lib/api-utils"

// Было:
return NextResponse.json({ error: "..." }, { status: 400 })

// Стало:
return error("VALIDATION_ERROR", "telegramUserId or deviceId required")
```

---

## Удалённый код

### is_pro column (FULLY REMOVED)
**Статус: ПОЛНОСТЬЮ УДАЛЕНО**

Колонка `is_pro` удалена из таблицы `users`.
Статус оплаты теперь определяется из таблицы `payments`:
```sql
SELECT EXISTS (
  SELECT 1 FROM payments
  WHERE user_id = ? AND status = 'succeeded'
) AS has_paid;
```

---

## Приоритет исправлений

1. **P0 (сегодня):** Telegram ID validation (#1)
2. **P0 (сегодня):** Authorization bypass (#3)
3. **P1 (завтра):** Race condition (#2)
4. **P1 (завтра):** Memory leaks (#4)
5. **P2 (эта неделя):** NaN validation, URL injection, error format (#5-7)

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `lib/user-identity.ts` | ON CONFLICT, NaN validation |
| `app/api/avatars/route.ts` | Remove fallback, NaN validation |
| `app/api/generate/route.ts` | Remove fallback, use findOrCreateUser |
| `app/api/payment/create/route.ts` | URL encoding, error format |
| `app/api/payment/status/route.ts` | Remove fallback, error format |
| `app/api/telegram/auth/route.ts` | Add initData validation |
| `components/persona-app.tsx` | Memory leak fix, interval cleanup |
