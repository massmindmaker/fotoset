# CLAUDE.md - PinGlass (розовые очки)

## Глобальные ресурсы
@C:/Users/bob/.claude/CLAUDE.md

## Project Overview

**PinGlass** (розовые очки) — это веб-приложение для генерации AI-фотопортретов на базе Next.js 16. Позволяет пользователям загружать свои фотографии и получать 23 профессиональных AI-сгенерированных портрета в различных стилях.

### Tech Stack
- **Frontend:** React 19, Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS 4, OKLCH color space
- **AI Generation:** Google Imagen 3.0 API (через YeScale proxy)
- **Database:** Neon PostgreSQL (serverless)
- **Payments:** T-Bank (Tinkoff) Payment API
- **Analytics:** Vercel Analytics

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
│   │   │   └── webhook/route.ts   # YooKassa webhooks
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
│   ├── yookassa.ts                # Платежная интеграция
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
- Интеграция с YooKassa (500 ₽)
- Test mode для разработки
- Webhook для real-time обновлений статуса
- Pro-статус по device ID (без аккаунтов)

### 3. User Persistence
- Идентификация по device ID (localStorage)
- Хранение: `pinglass_device_id`, `pinglass_is_pro`, `pinglass_onboarding_complete`
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
│     UPLOAD      │ ← Загрузка 10-20 фото (drag-n-drop)
│  (10-20 photos) │   Progress bar, preview с удалением
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
│ PAYMENT  │  │ ← Modal → YooKassa redirect → Callback
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

### Workflow 2: Returning User (Pro)

```
App Load → Check localStorage isPro
    │
    ▼
┌─────────────────┐
│   DASHBOARD     │ ← Skip onboarding
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
│ payment/create  │ → Creates YooKassa order
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Redirect to     │
│ YooKassa        │ ← External payment page
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ YooKassa        │
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
│ payment/status  │ ← Until isPro = true
└────────┬────────┘
     │
     ▼
┌─────────────────┐
│ Save to         │
│ localStorage    │ → pinglass_is_pro = true
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
│ isPro status    │ ← Check DB
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
Проверка статуса Pro подписки.

**Response:** `{ "isPro": boolean, "status": "succeeded" | "pending" }`

### `POST /api/payment/webhook`
YooKassa webhook handler. Обрабатывает `payment.succeeded` и `payment.canceled`.

### `POST /api/user`
Получение/создание пользователя.

**Request:** `{ "deviceId": "string" }`

**Response:** `{ "id": number, "deviceId": "string", "isPro": boolean }`

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

## Database Schema

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  is_pro BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Avatars (Personas)
CREATE TABLE avatars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255) DEFAULT 'Мой аватар',
  status VARCHAR(20) DEFAULT 'draft', -- draft, processing, ready
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Generated Photos
CREATE TABLE generated_photos (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id),
  style_id VARCHAR(50),
  prompt TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  yookassa_payment_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'RUB',
  status VARCHAR(20), -- pending, succeeded, canceled
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Generation Jobs
CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id),
  style_id VARCHAR(50),
  status VARCHAR(20), -- processing, completed, failed
  total_photos INTEGER DEFAULT 23,
  completed_photos INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

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
- Payment webhooks verify YooKassa signatures
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
