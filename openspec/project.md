# PinGlass Project Context

## Overview

**PinGlass** (Розовые очки) is an AI photo portrait generation web application. Users upload reference photos and receive 23 AI-generated professional portraits in various styles.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS 4, OKLCH color space |
| Database | Neon PostgreSQL (serverless) |
| AI Generation | Kie.ai (async) + Replicate (fallback) |
| Payments | T-Bank, Telegram Stars, TON Crypto |
| Storage | Cloudflare R2 |
| Background Jobs | QStash + Vercel Cron |
| Hosting | Vercel |

## Architecture Principles

### 1. Async-First Generation
- All AI generation uses fire-and-forget pattern
- Tasks tracked in `kie_tasks` table
- Cron job polls for completion (avoids Cloudflare 100s timeout)

### 2. Multi-Provider Payments
- Abstract payment logic behind provider interface
- Support T-Bank (cards), Telegram Stars, TON (crypto)
- All payments tracked in unified `payments` table

### 3. No User Status System
- Access = successful payment exists
- No Free/Pro tiers or `is_pro` flags
- Partner status only in `referral_balances.is_partner`

### 4. Device-Based Authentication
- Users identified by `telegram_user_id`
- Device tracking via `pinglass_device_id` localStorage
- No passwords or traditional auth

## Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Database | snake_case | `telegram_user_id` |
| TypeScript | camelCase | `telegramUserId` |
| API params | snake_case | `?telegram_user_id=123` |
| API body | camelCase | `{ telegramUserId }` |
| Env vars | SCREAMING_SNAKE | `DATABASE_URL` |
| Components | PascalCase | `PaymentModal` |

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `components/persona-app.tsx` | Main app, all views | ~1100 |
| `lib/prompts.ts` | 23 prompts + styles | ~103 |
| `lib/tbank.ts` | T-Bank integration | ~240 |
| `lib/kie-ai.ts` | Kie.ai async wrapper | ~200 |
| `app/api/generate/route.ts` | Generation endpoint | ~300 |

## Database Schema (Key Tables)

### users
```sql
id, telegram_user_id, telegram_username, is_banned, created_at
```

### payments
```sql
id, user_id, payment_id, provider, amount, status,
telegram_charge_id, stars_amount, ton_tx_hash, ton_amount, created_at
```

### kie_tasks
```sql
id, job_id, kie_task_id, prompt_index, status, result_url, attempts, created_at
```

### referral_balances
```sql
id, user_id, referral_code, balance, is_partner, commission_rate
```

## Anti-Patterns (DO NOT USE)

1. **User status flags** - No `is_pro`, `isPro`, or Free/Pro tiers
2. **Sync generation** - Never `await generateAndWait()` (timeout risk)
3. **Hardcoded prices** - Read from `pricing_tiers` or admin API
4. **telegram_queue table** - Does not exist, use `telegram_message_queue`

## Testing Strategy

- Unit tests: Vitest for utilities and hooks
- E2E tests: Playwright for critical flows
- Smoke tests: CI pipeline validation
- Manual: Payment flow testing in T-Bank sandbox

## Environment Variables

Required:
- `DATABASE_URL` - Neon PostgreSQL connection
- `NEXT_PUBLIC_APP_URL` - App base URL
- `KIE_API_KEY` - Kie.ai API key

Payment providers:
- `TBANK_TERMINAL_KEY`, `TBANK_PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `TON_API_KEY`

## Deployment

- Production: Vercel (auto-deploy from main)
- Preview: Vercel (auto-deploy from PRs)
- Database: Neon (use branches for features)
