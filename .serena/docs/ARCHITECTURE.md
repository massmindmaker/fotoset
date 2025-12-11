# Fotoset Architecture

## Project Overview
**Fotoset** (PinGlass) - Next.js 16 приложение для генерации AI-фотопортретов.
Позволяет пользователям загружать свои фото и получать 23 профессиональных AI-сгенерированных портрета.

## Tech Stack
| Component | Technology |
|-----------|------------|
| Frontend | React 19, Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS 4 (OKLCH color space) |
| Database | Neon PostgreSQL (serverless) |
| AI Generation | Replicate API (nano-banana-pro, flux-pulid, flux-kontext, instant-id) |
| Payments | T-Bank (Tinkoff) Payment API |
| Analytics | Vercel Analytics |
| Notifications | Telegram Bot API |

## Directory Structure

```
Fotoset/
├── app/                              # Next.js 16 App Router
│   ├── api/                          # API Routes (serverless)
│   │   ├── avatars/                  # CRUD операции для персон
│   │   ├── generate/route.ts         # AI генерация 23 фото
│   │   ├── payment/                  # T-Bank платежи
│   │   ├── referral/                 # Реферальная программа
│   │   └── telegram/                 # Telegram интеграция
│   └── page.tsx                      # Home page (PersonaApp)
├── components/
│   ├── persona-app.tsx               # Основной компонент (563 строк)
│   ├── payment-modal.tsx             # Модаль оплаты
│   └── results-gallery.tsx           # Галерея результатов
├── lib/
│   ├── db.ts                         # Neon PostgreSQL клиент
│   ├── tbank.ts                      # T-Bank API (244 строки)
│   ├── prompts.ts                    # 23 промпта (333 строки)
│   ├── replicate.ts                  # Replicate API (252 строки)
│   └── replicate/                    # AI модели и утилиты
└── styles/globals.css                # Tailwind 4, OKLCH
```

## Core Modules

### AI Generation (lib/replicate/)
**Fallback chain:**
1. nano-banana-pro (primary, $0.15/image)
2. flux-pulid ($0.022/image)
3. flux-kontext-pro ($0.04/image)
4. instant-id ($0.03/image)

### Payment (lib/tbank.ts)
- T-Bank API
- Modes: Production, Test, Demo
- ФЗ-54 receipts

### Auth
- Device ID-based (no passwords)
- localStorage persistence

