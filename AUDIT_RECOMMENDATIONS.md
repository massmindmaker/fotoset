# Fotoset - Конкретные рекомендации по улучшению

**Дата:** 19 декабря 2025
**Приоритет:** Immediate → High → Medium

---

## 1. CRITICAL: FIX JEST CONFIGURATION

### Проблема
```
FAIL tests/unit/lib/tbank.test.ts
Jest encountered an unexpected token
SyntaxError: Unexpected reserved word 'interface'
```

### Решение 1: Обновить jest.config.unit.js (БЫСТРО)

```javascript
// jest.config.unit.js
/** @type {import('jest').Config} */
const config = {
  displayName: 'unit',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/unit'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],

  // FIX: Добавить proper TypeScript handling
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // ← ИСПРАВИТЬ эти опции
          jsx: 'react-jsx',
          esModuleInterop: true,
          moduleResolution: 'node',
          module: 'commonjs',          // ← ДОБАВИТЬ
          target: 'ES2020',            // ← ДОБАВИТЬ
          lib: ['ES2020', 'DOM'],      // ← ДОБАВИТЬ
          skipLibCheck: true,          // ← ДОБАВИТЬ
          strict: false,               // ← ОСТАВИТЬ
        },
        isolatedModules: true,         // ← ДОБАВИТЬ
        babelConfig: {
          presets: ['@babel/preset-typescript']
        }
      },
    ],
  },

  moduleNameMapper: {
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    '^.+\\.(css|sass|scss)$': '<rootDir>/tests/__mocks__/styleMock.js',
    '^.+\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/$1',
  },

  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.tsx'],

  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/api/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },

  testTimeout: 10000,
}

module.exports = config
```

### Решение 2: Мигрировать на Vitest (РЕКОМЕНДУЕТСЯ)

```bash
# Установить Vitest
npm install -D vitest @vitest/ui
```

```typescript
// vitest.config.ts (НОВЫЙ ФАЙЛ)
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Почему Vitest лучше:**
- ✅ Нативная поддержка TypeScript
- ✅ Быстрее Jest (в 10x раз)
- ✅ Compatible с Jest API
- ✅ ESM по умолчанию

---

## 2. HIGH: ENABLE TYPESCRIPT STRICT MODE

### Phase 1: Подготовка (1-2 дня)

```json
// tsconfig.json - ОБНОВИТЬ постепенно
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],

    // ← PHASE 1: Базовые strict checks
    "strict": false,              // ← Оставить false пока
    "noImplicitAny": true,        // ← ВКЛЮЧИТЬ
    "noImplicitThis": true,       // ← ВКЛЮЧИТЬ
    "strictNullChecks": false,    // ← Пока false
    "strictFunctionTypes": false, // ← Пока false

    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "jsx": "react-jsx",
    "allowJs": true,

    "paths": {
      "@/*": ["./*"]
    },

    "noEmit": true,
    "incremental": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### Phase 2: Фиксить типы (1-2 недели)

```bash
# Запустить type check
npx tsc --noEmit

# Исправить все ошибки типов
# Фокусироваться на lib/ and app/api/ first
```

### Phase 3: Включить полный strict (1 неделя)

```json
{
  "compilerOptions": {
    "strict": true,  // ← ВКЛЮЧИТЬ ПОЛНОСТЬЮ
  }
}
```

**Мониторинг:**
```bash
# Создать script для отслеживания улучшений
scripts/check-type-errors.sh
# Должно выводить: Type errors: 0/500 → 0/400 → 0/200 → 0/0
```

---

## 3. HIGH: ADD INPUT VALIDATION WITH ZOD

### Установка

```bash
npm install zod
```

### Пример: Validation schemas

```typescript
// lib/validation-schemas.ts (НОВЫЙ ФАЙЛ)
import { z } from 'zod'

// User schemas
export const CreateAvatarSchema = z.object({
  telegramUserId: z.number().int().positive('Invalid Telegram User ID'),
  name: z.string().min(1).max(100),
  styleId: z.enum(['professional', 'lifestyle', 'creative']),
})

export const GeneratePhotosSchema = z.object({
  telegramUserId: z.number().int().positive(),
  avatarId: z.number().int().positive(),
  styleId: z.enum(['professional', 'lifestyle', 'creative']),
  referenceImages: z.array(z.string().url()).min(1).max(20),
})

export const CreatePaymentSchema = z.object({
  telegramUserId: z.number().int().positive(),
  avatarId: z.number().int().optional(),
  amount: z.number().positive(),
})

export type CreateAvatarInput = z.infer<typeof CreateAvatarSchema>
export type GeneratePhotosInput = z.infer<typeof GeneratePhotosSchema>
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>
```

### API Route Example

```typescript
// app/api/avatars/route.ts
import { CreateAvatarSchema } from '@/lib/validation-schemas'
import { error, success, created } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = CreateAvatarSchema.safeParse(body)
    if (!validation.success) {
      return error('VALIDATION_ERROR', 'Invalid input', {
        errors: validation.error.flatten()
      })
    }

    const input = validation.data

    // Create avatar...
    const avatar = await createAvatar(input)
    return created(avatar)

  } catch (err) {
    return error('INTERNAL_ERROR', 'Failed to create avatar')
  }
}
```

### Middleware для валидации (ОПЦИОНАЛЬНО)

```typescript
// lib/middleware.ts
import type { NextRequest } from 'next/server'
import { ZodSchema } from 'zod'
import { error } from './api-utils'

export async function validateRequestBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<{ success: true; data: any } | { success: false; response: any }> {
  try {
    const body = await request.json()
    const validation = schema.safeParse(body)

    if (!validation.success) {
      return {
        success: false,
        response: error('VALIDATION_ERROR', 'Invalid request body', {
          errors: validation.error.flatten()
        })
      }
    }

    return { success: true, data: validation.data }
  } catch (err) {
    return {
      success: false,
      response: error('BAD_REQUEST', 'Invalid JSON')
    }
  }
}
```

---

## 4. HIGH: MIGRATE RATE LIMITING TO UPSTASH REDIS

### Установка

```bash
npm install @upstash/redis @upstash/ratelimit
```

### Environment variables

```env
# .env.local
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Реализация

```typescript
// lib/rate-limiter.ts (ОБНОВИТЬ)
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// Глобальный rate limiter
const globalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 requests per hour
  analytics: true,
})

// Per-user limiter
const userLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 d'), // 10 requests per day
  analytics: true,
})

export async function checkGenerationRateLimit(
  telegramUserId: number
): Promise<{ allowed: boolean; reset: number }> {
  const { success, reset } = await globalLimiter.limit(
    `generation:${telegramUserId}`
  )

  return { allowed: success, reset: reset?.getTime() || 0 }
}

export async function checkPaymentRateLimit(
  telegramUserId: number
): Promise<{ allowed: boolean; reset: number }> {
  const { success, reset } = await userLimiter.limit(
    `payment:${telegramUserId}`
  )

  return { allowed: success, reset: reset?.getTime() || 0 }
}
```

### Использование в API

```typescript
// app/api/generate/route.ts
import { checkGenerationRateLimit } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const identifier = getUserIdentifier(request, body)

  // Check rate limit
  const rateLimit = await checkGenerationRateLimit(identifier.telegramUserId)
  if (!rateLimit.allowed) {
    return error('RATE_LIMIT_EXCEEDED', 'Too many generation requests', {
      retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000)
    })
  }

  // Continue with generation...
}
```

**Преимущества:**
- ✅ Persists across deploys
- ✅ Works across multiple instances
- ✅ Analytics built-in
- ✅ No setup required (managed by Upstash)

---

## 5. HIGH: ADD E2E TESTS WITH PLAYWRIGHT

### Структура тестов

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Telegram Authentication', () => {
  test('should show dashboard when authenticated', async ({ page }) => {
    // Mock Telegram WebApp
    await page.evaluate(() => {
      window.Telegram = {
        WebApp: {
          ready: () => {},
          setBackgroundColor: () => {},
          initDataUnsafe: {
            user: {
              id: 123456,
              first_name: 'Test',
              last_name: 'User',
            }
          }
        }
      }
    })

    await page.goto('/')

    // Should show dashboard
    await expect(page.locator('text=My Avatars')).toBeVisible({ timeout: 5000 })
  })

  test('should show onboarding for new user', async ({ page }) => {
    await page.goto('/')

    // Mock unauthenticated state
    await page.evaluate(() => {
      window.localStorage.removeItem('auth_token')
    })

    // Should show onboarding
    await expect(page.locator('text=Welcome')).toBeVisible()
  })
})

// tests/e2e/generation.spec.ts
test.describe('Photo Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Mock Telegram auth
    await loginAsTelegramUser(page, 123456)
  })

  test('should upload reference images', async ({ page }) => {
    await page.goto('/dashboard')

    // Click "Create new avatar"
    await page.click('button:has-text("Create New")')

    // Upload files
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([
      'tests/fixtures/photo1.jpg',
      'tests/fixtures/photo2.jpg',
    ])

    // Verify images appear
    await expect(page.locator('img[alt="Uploaded photo"]')).toHaveCount(2)
  })

  test('should generate 23 photos', async ({ page }) => {
    // Setup: Create avatar with references
    const avatarId = await createTestAvatar(page)

    // Select style
    await page.click('button:has-text("Professional")')

    // Start generation
    await page.click('button:has-text("Generate Photos")')

    // Wait for completion (with timeout)
    await page.waitForFunction(
      () => {
        const images = document.querySelectorAll('img[data-photo]')
        return images.length === 23
      },
      { timeout: 15 * 60 * 1000 } // 15 minutes
    )

    // Verify all 23 photos visible
    const photos = page.locator('img[data-photo]')
    await expect(photos).toHaveCount(23)
  })
})

// tests/e2e/payment.spec.ts
test.describe('Payment Flow', () => {
  test('should process payment correctly', async ({ page, context }) => {
    await loginAsTelegramUser(page, 123456)
    await page.goto('/dashboard')

    // Click buy pro button
    await page.click('button:has-text("Upgrade to Pro")')

    // Should show payment modal
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()

    // Click pay button
    await page.click('button:has-text("Pay 500₽")')

    // Should redirect to T-Bank (or mock)
    // In test: mock webhook
    await mockTBankWebhook(context, { status: 'succeeded' })

    // Should show success message
    await expect(page.locator('text=Payment successful')).toBeVisible()
  })
})

// tests/e2e/helpers.ts
export async function loginAsTelegramUser(page: Page, userId: number) {
  await page.goto('/')
  await page.evaluate((id) => {
    window.Telegram = {
      WebApp: {
        ready: () => {},
        setBackgroundColor: () => {},
        initData: `user=${JSON.stringify({id})}`,
        initDataUnsafe: {
          user: { id, first_name: 'Test' }
        }
      }
    }
  }, userId)
}

export async function createTestAvatar(page: Page): Promise<number> {
  // ... implementation
}

export async function mockTBankWebhook(
  context: BrowserContext,
  params: Record<string, any>
) {
  // ... implementation
}
```

### Запуск тестов

```bash
# Локально
npx playwright test

# С UI
npx playwright test --ui

# Конкретный файл
npx playwright test tests/e2e/auth.spec.ts

# Деградированный браузер
npx playwright test --project=chromium
```

---

## 6. MEDIUM: ADD TRANSACTION SUPPORT TO DATABASE

### Проблема: Race conditions

```typescript
// ❌ ОПАСНО: Может случиться race condition
const job = await sql`
  INSERT INTO generation_jobs (avatar_id, style_id)
  VALUES (${avatarId}, ${styleId})
  RETURNING *
`

const avatar = await sql`
  UPDATE avatars
  SET status = 'processing'
  WHERE id = ${avatarId}
`

// Если первый запрос успешен, а второй падает → несогласованность
```

### Решение: Использовать транзакции

```typescript
// lib/db-transactions.ts (НОВЫЙ ФАЙЛ)
import { sql } from './db'

/**
 * Execute multiple SQL statements in a single transaction
 * Ensures atomicity - either all succeed or all rollback
 */
export async function inTransaction<T>(
  callback: (tx: typeof sql) => Promise<T>
): Promise<T> {
  // Neon uses connection pooling, transactions are per-connection
  // Use a single connection for the transaction
  try {
    await sql`BEGIN`
    const result = await callback(sql)
    await sql`COMMIT`
    return result
  } catch (error) {
    await sql`ROLLBACK`
    throw error
  }
}

/**
 * Example: Create avatar and update user atomically
 */
export async function createAvatarAtomic(params: {
  userId: number
  name: string
  styleId: string
  referenceImages: string[]
}): Promise<Avatar> {
  return inTransaction(async (tx) => {
    // Insert avatar
    const avatarResult = await tx`
      INSERT INTO avatars (user_id, name, status)
      VALUES (${params.userId}, ${params.name}, 'draft')
      RETURNING *
    `

    const avatar = avatarResult[0]

    // Insert reference images (atomically with avatar)
    for (const imageUrl of params.referenceImages) {
      await tx`
        INSERT INTO reference_photos (avatar_id, image_url)
        VALUES (${avatar.id}, ${imageUrl})
      `
    }

    // Update user's avatar count
    await tx`
      UPDATE users
      SET avatar_count = avatar_count + 1
      WHERE id = ${params.userId}
    `

    return avatar
  })
}
```

### Использование

```typescript
// app/api/avatars/route.ts
import { createAvatarAtomic } from '@/lib/db-transactions'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const identifier = getUserIdentifier(request, body)

  try {
    // Atomic operation - either all succeed or all fail
    const avatar = await createAvatarAtomic({
      userId: identifier.telegramUserId,
      name: body.name,
      styleId: body.styleId,
      referenceImages: body.referenceImages
    })

    return created(avatar)
  } catch (error) {
    // Transaction automatically rolled back
    return error('INTERNAL_ERROR', 'Failed to create avatar')
  }
}
```

---

## 7. MEDIUM: MIGRATE TO DRIZZLE ORM (OPTIONAL BUT BENEFICIAL)

### Установка

```bash
npm install drizzle-orm @drizzle-orm/neon-http
npm install -D drizzle-kit
```

### Определение схемы

```typescript
// lib/schema.ts (НОВЫЙ ФАЙЛ)
import { pgTable, serial, text, integer, boolean, timestamp, bigint } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).unique().notNull(),
  isPro: boolean('is_pro').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const avatars = pgTable('avatars', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull(), // draft, processing, ready
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const generatedPhotos = pgTable('generated_photos', {
  id: serial('id').primaryKey(),
  avatarId: integer('avatar_id').notNull().references(() => avatars.id, { onDelete: 'cascade' }),
  styleId: text('style_id').notNull(),
  prompt: text('prompt').notNull(),
  imageUrl: text('image_url').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  avatars: many(avatars),
}))

export const avatarsRelations = relations(avatars, ({ one, many }) => ({
  user: one(users, { fields: [avatars.userId], references: [users.id] }),
  photos: many(generatedPhotos),
}))

export const photosRelations = relations(generatedPhotos, ({ one }) => ({
  avatar: one(avatars, { fields: [generatedPhotos.avatarId], references: [avatars.id] }),
}))
```

### Использование

```typescript
// lib/db.ts (ОБНОВИТЬ)
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const client = neon(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })

// Type-safe queries
import { eq } from 'drizzle-orm'

export async function getAvatarWithPhotos(avatarId: number) {
  return db.query.avatars.findFirst({
    where: eq(schema.avatars.id, avatarId),
    with: {
      user: true,
      photos: true,
    }
  })
}

export async function getUserAvatars(userId: number) {
  return db.query.avatars.findMany({
    where: eq(schema.avatars.userId, userId),
    orderBy: (avatars, { desc }) => [desc(avatars.createdAt)],
  })
}
```

### Миграции

```bash
# Генерировать миграции из schema
npx drizzle-kit generate:pg --out ./migrations

# Применить миграции
npx drizzle-kit migrate:pg
```

**Преимущества Drizzle:**
- ✅ Type-safe queries
- ✅ Automatic migrations
- ✅ Relationship management
- ✅ Query builder
- ✅ Zero runtime overhead

---

## 8. MEDIUM: ENHANCE SECURITY - TELEGRAM WEBHOOK VALIDATION

### Проблема: HMAC signature verification может быть улучшена

```typescript
// lib/telegram-auth.ts (ОБНОВИТЬ)
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify Telegram WebApp initData using HMAC-SHA256
 * Prevents tampering and replay attacks
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAge: number = 5 * 60 // 5 minutes
): boolean {
  try {
    const params = new URLSearchParams(initData)

    // Extract hash
    const hash = params.get('hash')
    if (!hash) return false

    // Remove hash from params
    params.delete('hash')

    // Check timestamp (prevent replay attacks)
    const authDate = params.get('auth_date')
    if (!authDate) return false

    const authTimestamp = parseInt(authDate, 10)
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const age = currentTimestamp - authTimestamp

    if (age > maxAge) {
      console.warn(`Telegram auth too old: ${age}s (max: ${maxAge}s)`)
      return false
    }

    // Sort parameters alphabetically
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // Create secret key: HMAC-SHA256("WebAppData", botToken)
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    // Verify hash: HMAC-SHA256(secret_key, data_check_string)
    const validHash = createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex')

    // Use timing-safe comparison to prevent timing attacks
    const hashBuffer = Buffer.from(hash, 'hex')
    const validHashBuffer = Buffer.from(validHash, 'hex')

    return timingSafeEqual(hashBuffer, validHashBuffer)
  } catch (error) {
    console.error('Telegram auth verification failed:', error)
    return false
  }
}

/**
 * Middleware to verify Telegram auth
 */
export async function requireTelegramAuth(request: NextRequest) {
  const authHeader = request.headers.get('x-telegram-init-data')

  if (!authHeader) {
    return null
  }

  const isValid = verifyTelegramInitData(
    authHeader,
    process.env.TELEGRAM_BOT_TOKEN!,
    5 * 60 // 5 minutes
  )

  if (!isValid) {
    return null
  }

  // Extract user ID from init data
  const params = new URLSearchParams(authHeader)
  const userJson = params.get('user')

  if (!userJson) return null

  try {
    const user = JSON.parse(userJson)
    return user.id
  } catch {
    return null
  }
}
```

### Использование

```typescript
// app/api/avatars/route.ts
import { requireTelegramAuth } from '@/lib/telegram-auth'

export async function POST(request: NextRequest) {
  // Verify Telegram auth
  const telegramUserId = await requireTelegramAuth(request)

  if (!telegramUserId) {
    return error('UNAUTHORIZED', 'Invalid Telegram authentication')
  }

  // Continue with authenticated request...
}
```

---

## 9. MEDIUM: ADD MONITORING & OBSERVABILITY

### Setup Sentry Error Tracking (уже в проекте)

```typescript
// lib/monitoring.ts (НОВЫЙ ФАЙЛ)
import * as Sentry from '@sentry/nextjs'

/**
 * Capture performance metrics
 */
export function capturePerformance(
  name: string,
  fn: () => Promise<any>
) {
  return Sentry.startActiveSpan({ name }, fn)
}

/**
 * Track generation completion
 */
export async function trackGenerationComplete(params: {
  jobId: number
  duration: number
  photosGenerated: number
  errors: string[]
}) {
  Sentry.captureMessage('Generation completed', {
    level: 'info',
    extra: params,
  })

  // Send to custom analytics
  await fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify({
      event: 'generation_complete',
      ...params,
    })
  })
}

/**
 * Track payment processing
 */
export async function trackPayment(params: {
  paymentId: string
  amount: number
  status: 'success' | 'failed'
}) {
  Sentry.captureMessage('Payment processed', {
    level: params.status === 'success' ? 'info' : 'error',
    extra: params,
  })
}
```

### Custom Metrics API

```typescript
// app/api/analytics/route.ts (НОВЫЙ ФАЙЛ)
import { type NextRequest } from 'next/server'
import { error, success } from '@/lib/api-utils'

interface AnalyticsEvent {
  event: string
  userId?: number
  duration?: number
  metadata?: Record<string, any>
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyticsEvent = await request.json()

    // Store in database or external service
    if (body.event === 'generation_complete') {
      await logGenerationMetric({
        userId: body.userId!,
        duration: body.duration!,
      })
    }

    // Send to Sentry
    Sentry.captureMessage(body.event, {
      level: 'info',
      extra: body.metadata,
    })

    return success({ tracked: true })
  } catch (err) {
    return error('INTERNAL_ERROR', 'Failed to track event')
  }
}

async function logGenerationMetric(params: { userId: number; duration: number }) {
  // Log to database for analytics
  await sql`
    INSERT INTO analytics_generation (user_id, duration)
    VALUES (${params.userId}, ${params.duration})
  `
}
```

---

## 10. QUICK WINS (Сделать быстро)

### 10.1 Add Health Check Endpoint

```typescript
// app/api/health/route.ts (НОВЫЙ ФАЙЛ)
import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-utils'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check database
    await sql`SELECT 1`

    // Check external services (optional)
    const checks = {
      database: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }

    return success(checks)
  } catch (err) {
    return error('SERVICE_UNAVAILABLE', 'Database connection failed', {
      error: err instanceof Error ? err.message : String(err)
    })
  }
}
```

### 10.2 Add Request Logging Middleware

```typescript
// lib/middleware/logging.ts (НОВЫЙ ФАЙЛ)
import { type NextRequest } from 'next/server'

export function withRequestLogging(handler: (req: NextRequest) => Promise<Response>) {
  return async (request: NextRequest) => {
    const startTime = Date.now()
    const { method, url } = request

    const response = await handler(request)

    const duration = Date.now() - startTime
    console.log({
      method,
      path: new URL(url).pathname,
      status: response.status,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })

    return response
  }
}
```

### 10.3 Add Error Classes

```typescript
// lib/errors.ts (НОВЫЙ ФАЙЛ)
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, 400, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
    this.name = 'ForbiddenError'
  }
}
```

---

## Summary: Implementation Roadmap

### Week 1 (CRITICAL)
- [ ] Fix Jest configuration or migrate to Vitest
- [ ] Add Zod input validation
- [ ] Add health check endpoint

### Week 2 (HIGH)
- [ ] Migrate rate limiting to Upstash
- [ ] Enable TypeScript strict mode (Phase 1)
- [ ] Add E2E test suite

### Week 3 (MEDIUM)
- [ ] Add transaction support to database
- [ ] Enhance Telegram auth security
- [ ] Add monitoring & analytics

### Week 4+ (OPTIONAL)
- [ ] Migrate to Drizzle ORM
- [ ] Component architecture review
- [ ] Performance optimization

---

## Estimated Effort

| Task | Effort | Impact |
|------|--------|--------|
| Jest Fix | 2h | Critical |
| Zod Validation | 4h | High |
| Rate Limiting | 2h | High |
| E2E Tests | 10h | High |
| TypeScript Strict | 8h | Medium |
| Transactions | 4h | Medium |
| Security Enhancements | 3h | Medium |
| Drizzle ORM | 20h | Optional |

**Total: 40-50 hours (~1 week for team of 2)**

---

## Testing the Changes

```bash
# After applying fixes
npm run lint      # Should pass
npm run test      # Should pass (all tests)
npm run test:e2e  # Should pass E2E tests
npm run build     # Should build successfully
npm run type-check # Should have 0 type errors
```
