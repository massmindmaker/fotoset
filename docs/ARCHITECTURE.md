# PinGlass Architecture

## Overview

PinGlass is a Telegram Mini App for generating AI photo portraits using Google Imagen 3.0 API.

## Tech Stack

- **Frontend:** React 19, Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS 4, OKLCH color space
- **AI Generation:** Google Imagen 3.0 API (via YeScale proxy)
- **Database:** Neon PostgreSQL (serverless)
- **Payments:** T-Bank (Tinkoff) Payment API
- **Analytics:** Vercel Analytics
- **Hosting:** Vercel (auto-deploy from git)

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
│   │   ├── avatars/route.ts       # CRUD операции с аватарами
│   │   └── test-models/route.ts   # Тестирование API
│   ├── payment/callback/          # Callback страница оплаты
│   ├── layout.tsx                 # Root layout (fonts, meta)
│   └── page.tsx                   # Home page (импорт PersonaApp)
├── components/
│   ├── persona-app.tsx            # Главный компонент приложения
│   ├── payment-modal.tsx          # Модальное окно оплаты
│   └── theme-provider.tsx         # Dark mode provider
├── lib/
│   ├── db.ts                      # Neon PostgreSQL клиент
│   ├── imagen.ts                  # Google Imagen API wrapper
│   ├── yescale.ts                 # YeScale API proxy
│   ├── tbank.ts                   # T-Bank платежная интеграция
│   ├── prompts.ts                 # 23 промпта + стили
│   ├── user-identity.ts           # Telegram auth utilities
│   └── utils.ts                   # Tailwind utilities
├── styles/globals.css             # Глобальные стили + CSS переменные
└── public/                        # Статические ресурсы
```

## Authentication Architecture

### Telegram-Only Authentication (v2.0)

**As of December 2024**, PinGlass uses **Telegram-only authentication**:

- **Primary identifier:** `telegram_user_id` (Telegram User ID from WebApp API)
- **No device_id:** Removed in migration 014
- **Session management:** Via `window.Telegram.WebApp.initDataUnsafe`
- **Access control:** Application blocks access outside Telegram Mini App

**Type Definition:**
```typescript
interface UserIdentifier {
  type: "telegram"
  telegramUserId: number  // Required (NOT NULL)
}

type AuthStatus = 'pending' | 'success' | 'failed' | 'not_in_telegram'
```

**Initialization Flow:**
1. App checks for `window.Telegram.WebApp` availability
2. If not found → `authStatus = 'not_in_telegram'` → Show error UI
3. If found → Extract `initDataUnsafe.user`
4. Call `/api/user` to create/fetch user record
5. Set `userIdentifier` with `telegramUserId`

## Component Architecture

### Main Component: `PersonaApp`

Single-file React component (1059 lines) managing all application views and state.

**View States:**
- `ONBOARDING` - 3-step tutorial carousel
- `DASHBOARD` - Avatar gallery, creation UI
- `CREATE_PERSONA_UPLOAD` - Multi-file upload with progress
- `SELECT_STYLE` - 3 preset style selection
- `GENERATING` - Progress indicator during AI generation
- `RESULTS` - Generated photos gallery with download

**State Management:**
```typescript
const [authStatus, setAuthStatus] = useState<AuthStatus>('pending')
const [userIdentifier, setUserIdentifier] = useState<UserIdentifier | null>(null)
const [hasPaid, setHasPaid] = useState(false)
const [currentView, setCurrentView] = useState<ViewType>('ONBOARDING')
const [personas, setPersonas] = useState<Persona[]>([])
const [currentPersona, setCurrentPersona] = useState<Persona | null>(null)
```

**Key Hooks:**
- `useEffect` for Telegram WebApp initialization
- `useCallback` for memoized event handlers
- Dynamic imports for heavy components (e.g., Confetti)

## Data Flow

### Photo Generation Pipeline

```
User Upload (10-20 photos)
    ↓
Convert to base64
    ↓
Select Style Preset (Professional/Lifestyle/Creative)
    ↓
POST /api/generate
    ↓
Create generation_job (status: 'processing')
    ↓
Loop 23 prompts from selected style
    ↓
    For each prompt:
        ↓
    Call Google Imagen API + reference images
        ↓
    Save to generated_photos table
        ↓
Update avatar.status = 'ready'
    ↓
Return URLs to frontend
    ↓
Display in Results Gallery
```

### Payment Flow

```
User clicks "Pay 500₽"
    ↓
POST /api/payment/create
    ↓
T-Bank creates order → Returns confirmationUrl
    ↓
Redirect to T-Bank payment page
    ↓
User completes payment
    ↓
T-Bank webhook → POST /api/payment/webhook
    ↓
Update payments.status = 'succeeded'
    ↓
Callback page polls /api/payment/status
    ↓
Frontend sets hasPaid = true (localStorage)
    ↓
Redirect to Dashboard
```

## Database Architecture

### Tables

- **users** - Telegram users, pro status
- **avatars** - User personas/characters
- **generated_photos** - AI-generated images
- **payments** - Payment records
- **generation_jobs** - Background job tracking

### Relationships

```
users (1) ──→ (N) avatars
avatars (1) ──→ (N) generated_photos
users (1) ──→ (N) payments
avatars (1) ──→ (N) generation_jobs
```

### Indexes

- `users.telegram_user_id` (UNIQUE, PRIMARY)
- `avatars.user_id` (Foreign Key)
- `generated_photos.avatar_id` (Foreign Key)
- `payments.user_id` (Foreign Key)

## API Design

### RESTful Endpoints

All API routes follow Next.js App Router conventions:

- `GET /api/user` - Get/create user by telegram_user_id
- `GET /api/avatars` - List user's avatars
- `POST /api/avatars` - Create new avatar
- `POST /api/avatars/[id]/references` - Upload reference photos
- `POST /api/generate` - Generate 23 AI photos
- `POST /api/payment/create` - Create payment order
- `GET /api/payment/status` - Check payment status
- `POST /api/payment/webhook` - T-Bank webhook handler

### Error Handling

Standard error responses:
```typescript
{
  "error": {
    "code": "UNAUTHORIZED" | "BAD_REQUEST" | "SERVER_ERROR",
    "message": "Human-readable error message"
  }
}
```

## Security

- **Telegram WebApp validation:** Via `initData` signature verification
- **Payment webhooks:** SHA256 signature validation
- **Environment variables:** All API keys in `.env.local` (not committed)
- **CORS:** Disabled (same-origin only)
- **Rate limiting:** Not implemented (consider adding for production)

## Performance

- **Serverless functions:** Auto-scaling on Vercel
- **Database:** Neon PostgreSQL with connection pooling
- **Image hosting:** Generated photos hosted on Google Cloud Storage
- **Frontend:** React 19 with Next.js 16 optimizations
- **Bundle size:** ~200KB gzipped

## Deployment

- **Platform:** Vercel
- **Auto-deploy:** On `git push` to `main` branch
- **Environment:** Production
- **Build command:** `pnpm build`
- **Output:** Static + Server Components

---

**Last Updated:** December 19, 2024
**Version:** 2.0 (Telegram-only authentication)
