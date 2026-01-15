# CLAUDE.md - PinGlass (розовые очки)

## Глобальные ресурсы
@C:/Users/bob/.claude/CLAUDE.md

---

## 🧠 ByteRover Context System

**ByteRover** обеспечивает персистентную память проекта. Контекст хранится в `.brv/context-tree/`.

### Структура контекста
```
.brv/context-tree/
├── structure/           # Архитектура
│   ├── architecture/    # Общая архитектура
│   ├── api/             # API эндпоинты
│   ├── payments/        # Платёжная система
│   └── generation/      # AI генерация
├── code_style/          # Паттерны кода
│   └── patterns/        # Стиль и конвенции
├── testing/             # Тестирование
│   └── strategies/      # Стратегии тестов
├── design/              # UI/UX
│   └── ui/              # Компоненты
└── bug_fixes/           # Известные баги
    └── known-issues/    # Решения проблем
```

### MCP интеграция
ByteRover MCP добавлен в `.mcp.json`. При работе с проектом:

1. **Поиск контекста** - читай `.brv/context-tree/` для понимания архитектуры
2. **Курирование** - после реализации фичи, обнови соответствующий `context.md`
3. **Связи** - используй `@domain/topic` для связывания контекстов

### Ключевые контексты
| Файл | Содержит |
|------|----------|
| `structure/architecture/context.md` | Core architecture, anti-patterns |
| `structure/payments/context.md` | T-Bank, Stars, TON integration |
| `structure/generation/context.md` | Async AI generation flow |
| `bug_fixes/known-issues/context.md` | Известные проблемы и решения |

---

## 🚫 ANTI-PATTERNS (НЕ ДЕЛАТЬ!)

### 1. Статусы пользователей - НЕ СУЩЕСТВУЮТ
```sql
-- В приложении НЕТ статусов Free/Pro!
-- Есть только: пользователь и партнёр (is_partner в referral_balances)
-- Доступ к генерации = есть успешный платёж
❌ is_pro, isPro, user_is_pro - НЕ ИСПОЛЬЗОВАТЬ
❌ Free/Pro статусы - НЕ ОТОБРАЖАТЬ
✅ Проверка доступа: SELECT COUNT(*) FROM payments WHERE user_id=? AND status='succeeded'
```

### 2. Синхронная генерация
```typescript
❌ await generateAndWait(prompt) // Cloudflare 100s timeout!
✅ createKieTask() + cron polling через kie_tasks таблицу
```

### 3. Хардкод цен/провайдеров
```typescript
❌ const PRICE = 499
✅ Читать из pricing_tiers или admin settings API
```

### 4. telegram_queue таблица
```sql
❌ SELECT * FROM telegram_queue -- НЕ СУЩЕСТВУЕТ
✅ JOIN telegram_message_queue + users ON telegram_chat_id
```

---

## Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Database columns | snake_case | `telegram_user_id`, `created_at` |
| TypeScript variables | camelCase | `telegramUserId`, `createdAt` |
| API query params | snake_case | `?telegram_user_id=123` |
| API request body | camelCase | `{ telegramUserId: 123 }` |
| API response body | camelCase | `{ success: true }` |
| Environment vars | SCREAMING_SNAKE | `DATABASE_URL`, `TBANK_PASSWORD` |
| React components | PascalCase | `PaymentModal`, `PersonaApp` |
| CSS classes | kebab-case | `payment-modal`, `btn-primary` |

---

## Project Overview

**PinGlass** (розовые очки) — это веб-приложение для генерации AI-фотопортретов на базе Next.js 16. Позволяет пользователям загружать свои фотографии и получать 23 профессиональных AI-сгенерированных портрета в различных стилях.

### Tech Stack
- **Frontend:** React 19, Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS 4, OKLCH color space
- **AI Generation:** Kie.ai (async) + Replicate fallback
- **Database:** Neon PostgreSQL (serverless)
- **Payments:** T-Bank + Telegram Stars + TON Crypto
- **Storage:** Cloudflare R2
- **Background Jobs:** QStash + Vercel Cron
- **Analytics:** Vercel Analytics, Sentry

---

## Project Structure

```
PinGlass/
├── app/                           # Next.js App Router
│   ├── api/                       # API Routes
│   │   ├── generate/route.ts      # Генерация 23 фото
│   │   ├── payment/
│   │   │   ├── create/route.ts    # Создание платежа
│   │   │   ├── status/route.ts    # Проверка статуса
│   │   │   └── webhook/route.ts   # T-Bank webhooks
│   │   ├── user/route.ts          # Управление пользователями
│   │   └── test-models/route.ts   # Тестирование API
│   ├── payment/callback/          # Callback страница оплаты
│   ├── layout.tsx                 # Root layout (fonts, meta)
│   └── page.tsx                   # Home page
├── components/
│   ├── persona-app.tsx            # Основной компонент (1059 строк)
│   ├── payment-modal.tsx          # Модальное окно оплаты
│   └── theme-provider.tsx         # Dark mode provider
├── lib/
│   ├── db.ts                      # Neon PostgreSQL клиент
│   ├── imagen.ts                  # Google Imagen API
│   ├── yescale.ts                 # YeScale API wrapper
│   ├── tbank.ts                   # T-Bank платежная интеграция
│   ├── prompts.ts                 # 23 промпта + стили
│   └── utils.ts                   # Tailwind utilities
├── styles/globals.css             # Глобальные стили + CSS переменные
└── public/                        # Статические ресурсы (демо-фото)
```

---

## Core Features

### 1. AI Photo Generation
- **23 уникальных фото** за одну генерацию
- **3 стиля:** Professional, Lifestyle, Creative
- Использование референсных изображений для консистентности
- Отказоустойчивость при ошибках отдельных фото

### 2. Payment System
- Интеграция с T-Bank, Telegram Stars, TON
- Test mode для разработки
- Webhook для real-time обновлений статуса

### 3. User Persistence
- Идентификация по telegram_user_id
- Хранение: `pinglass_device_id`, `pinglass_onboarding_complete`
- Множественные персоны (аватары) на пользователя

---

## User Workflows

### Workflow 1: First-Time User Journey

```
┌─────────────────┐
│   ONBOARDING    │ ← 3 шага с carousel примерами
│   (3 steps)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     UPLOAD      │ ← Загрузка 5-8 фото (drag-n-drop)
│   (5-8 photos)  │   Progress bar, preview с удалением
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  STYLE SELECT   │ ← Выбор: Professional/Lifestyle/Creative
│   (3 presets)   │   Описание и примеры каждого стиля
└────────┬────────┘
         │
    ┌────┴────┐
    │ Is Pro? │
    └────┬────┘
    No   │   Yes
    ▼    │    │
┌──────────┐  │
│ PAYMENT  │  │ ← Modal → T-Bank redirect → Callback
│ (500 ₽)  │  │
└────┬─────┘  │
     │        │
     └────┬───┘
          ▼
┌─────────────────┐
│   GENERATING    │ ← Progress spinner, 5-10 минут
│  (23 photos)    │   Можно закрыть - уведомит по готовности
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    RESULTS      │ ← Галерея 23 фото с download
│   (gallery)     │   "Generate More" для нового стиля
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   DASHBOARD     │ ← Все персоны, создание новых
│  (all personas) │
└─────────────────┘
```

### Workflow 2: Returning User

```
App Load → Check onboarding status
    │
    ▼
┌─────────────────┐
│   DASHBOARD     │ ← Skip onboarding if completed
│  (all personas) │
└────────┬────────┘
         │
    ┌────┴────────────┐
    │                 │
    ▼                 ▼
┌──────────┐    ┌──────────────┐
│  VIEW    │    │   CREATE     │
│ EXISTING │    │ NEW PERSONA  │
└──────────┘    └──────┬───────┘
                       │
                       ▼
              ┌─────────────────┐
              │     UPLOAD      │
              │  → STYLE        │
              │  → GENERATE     │
              │  → RESULTS      │
              └─────────────────┘
```

### Workflow 3: Payment Flow

```
┌─────────────────┐
│ User clicks     │
│ "Pay 500₽"      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PaymentModal    │ ← State: OFFER
│ shows offer     │   Features list, Pay button
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST /api/      │
│ payment/create  │ → Creates T-Bank order
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Redirect to     │
│ T-Bank          │ ← External payment page
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ T-Bank          │
│ processes       │
└────────┬────────┘
    ┌────┴────┐
    │         │
 Success   Cancel
    │         │
    ▼         ▼
┌──────────┐  ┌──────────┐
│ Callback │  │ Return   │
│ /payment │  │ to app   │
│ /callback│  └──────────┘
└────┬─────┘
     │
     ▼
┌─────────────────┐
│ Poll /api/      │
│ payment/status  │ ← Until status = 'succeeded'
└────────┬────────┘
     │
     ▼
┌─────────────────┐
│ Redirect to     │
│ Generation      │
└────────┬────────┘
     │
     ▼
┌─────────────────┐
│ Redirect to     │
│ Dashboard       │
└─────────────────┘
```

### Workflow 4: Photo Generation (API)

```
┌─────────────────┐
│ POST /api/      │
│ generate        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate        │
│ payment status  │ ← Check succeeded payment
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create          │
│ generation_job  │ ← status: 'processing'
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Loop 23         │
│ prompts         │ ← Based on selected style
└────────┬────────┘
         │
    For each prompt:
         │
         ▼
┌─────────────────┐
│ Call Imagen API │
│ with references │ ← User's uploaded photos
└────────┬────────┘
         │
    ┌────┴────┐
 Success    Error
    │         │
    ▼         ▼
┌──────────┐ ┌──────────┐
│ Save URL │ │ Skip,    │
│ to DB    │ │ continue │
└──────────┘ └──────────┘
         │
         ▼
┌─────────────────┐
│ Update job &    │
│ avatar status   │ → status: 'ready'
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return URLs     │
│ to frontend     │
└─────────────────┘
```

---

## API Reference

### `POST /api/generate`
Генерация 23 AI-фото для персоны.

**Request:**
```json
{
  "deviceId": "string",
  "avatarId": "string",
  "styleId": "professional" | "lifestyle" | "creative",
  "referenceImages": ["base64..."]
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "string",
  "photosGenerated": 23,
  "photos": ["url1", "url2", ...]
}
```

### `POST /api/payment/create`
Создание платежного заказа.

**Request:** `{ "deviceId": "string", "avatarId?": "string" }`

**Response:** `{ "paymentId": "string", "confirmationUrl": "string", "testMode": boolean }`

### `GET /api/payment/status?device_id=xxx&payment_id=xxx`
Проверка статуса платежа.

**Response:** `{ "status": "succeeded" | "pending" | "canceled" }`

### `POST /api/payment/webhook`
T-Bank webhook handler. Обрабатывает `payment.succeeded` и `payment.canceled`. Верифицирует подпись SHA256.

### `POST /api/user`
Получение/создание пользователя.

**Request:** `{ "telegramUserId": number }`

**Response:** `{ "id": number, "telegramUserId": number }`

---

## Style Presets

### Professional (Профессиональный)
- Бизнес-портреты для LinkedIn, резюме
- Корпоративный чистый фон
- Промпты: 3, 4, 11, 6, 18, 21, 0, 19, 7

### Lifestyle (Лайфстайл)
- Повседневные фото для соцсетей
- Естественные локации (кафе, парки, улицы)
- Промпты: 0, 1, 2, 5, 8, 12, 15, 20, 22

### Creative (Креативный)
- Художественные портреты для портфолио
- Креативное освещение и композиция
- Промпты: 7, 9, 10, 13, 14, 16, 17, 19, 21

---

## Environment Variables

```env
# Database (Required)
DATABASE_URL=postgresql://...

# Google AI (Required)
GOOGLE_API_KEY=...

# T-Bank Payment (Optional - test mode without)
TBANK_TERMINAL_KEY=...
TBANK_PASSWORD=...

# YeScale Proxy (Optional)
YESCALE_API_KEY=...

# App URL (Required for callbacks)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## Database Schema (Key Tables)

```sql
-- Users (статусов НЕТ! Доступ = есть успешный платёж)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE,
  telegram_username VARCHAR(255),
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payments (Multi-provider)
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  payment_id VARCHAR(255),
  provider VARCHAR(20) DEFAULT 'tbank', -- tbank, stars, ton
  amount DECIMAL(10,2),
  status VARCHAR(20), -- pending, succeeded, canceled, refunded
  -- Stars-specific
  telegram_charge_id VARCHAR(255) UNIQUE,
  stars_amount INTEGER,
  -- TON-specific
  ton_tx_hash CHAR(64) UNIQUE,
  ton_amount DECIMAL(20,9),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Async Generation (Kie.ai tasks)
CREATE TABLE kie_tasks (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES generation_jobs(id),
  kie_task_id VARCHAR(255) NOT NULL,
  prompt_index INTEGER,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  result_url TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Referral System
CREATE TABLE referral_balances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),
  referral_code VARCHAR(20) UNIQUE,
  balance DECIMAL(10,2) DEFAULT 0,
  is_partner BOOLEAN DEFAULT FALSE,
  commission_rate DECIMAL(3,2) DEFAULT 0.10 -- 10% default, 50% for partners
);
```

**Полная схема:** См. `scripts/migrations/` (29 миграций)

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Run development server (with Turbopack)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `components/persona-app.tsx` | Main application component (1059 lines), all views and state |
| `lib/prompts.ts` | 23 generation prompts + style configurations |
| `lib/tbank.ts` | T-Bank payment integration |
| `lib/imagen.ts` | Google Imagen API wrapper |
| `lib/db.ts` | Database client and type definitions |
| `app/api/generate/route.ts` | Core photo generation endpoint |
| `styles/globals.css` | Theme variables (OKLCH), global styles |

---

## Component Views

`PersonaApp` manages these view states:

1. **ONBOARDING** - 3-step tutorial carousel
2. **DASHBOARD** - Avatar gallery, creation UI
3. **CREATE_PERSONA_UPLOAD** - Multi-file upload with progress
4. **SELECT_STYLE** - 3 preset style selection
5. **GENERATING** - Progress indicator during AI generation
6. **RESULTS** - Generated photos gallery with download

---

## Security Notes

- Device ID-based auth (no passwords)
- API keys should be in environment variables only
- Payment webhooks verify T-Bank SHA256 signatures
- No rate limiting implemented (consider adding)

---

## Deployment

**Recommended:** Vercel

**Checklist:**
- [ ] Set all environment variables in Vercel
- [ ] Create PostgreSQL schema in Neon
- [ ] Register T-Bank merchant account and get Terminal Key
- [ ] Configure Google Cloud Imagen API
- [ ] Test payment flow end-to-end
- [ ] Configure webhook URL in T-Bank dashboard

---

## 📚 Serena Memory System

**Ключевые memory файлы (читать при необходимости):**

| Memory | Содержимое |
|--------|-----------|
| `architecture-decisions` | Anti-patterns, ключевые решения, схема БД |
| `2026-01-03-multi-payment-integration-complete` | T-Bank + Stars + TON интеграция |
| `2025-12-27-async-kie-ai-architecture` | Fire-and-forget + cron polling |
| `_memory-index` | Индекс всех memories |

**Команды:**
```
mcp__serena__list_memories      # Список всех
mcp__serena__read_memory        # Читать конкретный
```

---

## 🔧 Useful Skills

| Skill | Когда использовать |
|-------|-------------------|
| `/serena` | Файлы >100 строк, символьный анализ |
| `/context7` | Документация библиотек |
| `/github-cli` | PR, issues, actions |
| `/vercel` | Deploy, env, logs |
| `/docker` | Containers, compose |
