# PinGlass Product Presentation Plan

> **Дата:** 2026-01-27
> **Версия:** 1.0
> **Цель:** Презентация продукта для инвесторов и партнёров

---

## 1. Executive Summary

### Продукт
**PinGlass** — AI-платформа для генерации профессиональных фотопортретов на базе Telegram Mini App.

### Ключевые метрики (на январь 2026)
| Метрика | Значение |
|---------|----------|
| Технология | Next.js 16 + React 19 + Kie.ai |
| Платежи | T-Bank + Telegram Stars + TON |
| Время генерации | 5-10 минут (23 фото) |
| Средний чек | 500-1500 ₽ |

### Уникальное преимущество
- **Telegram-native** — нет регистрации, мгновенный старт
- **Multi-payment** — рубли, Stars, криптовалюта
- **Партнёрская программа** — до 50% комиссии

---

## 2. Problem Statement

### Боль пользователя
1. **Дорого** — профессиональная фотосессия стоит 5,000-50,000 ₽
2. **Долго** — запись, съёмка, обработка занимают недели
3. **Неудобно** — нужно ехать в студию, готовиться

### Боль рынка
- AI-генерация фото растёт на 40% ежегодно
- Telegram Mini Apps — 500M+ пользователей
- Крипто-платежи становятся mainstream

---

## 3. Solution

### Как это работает
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. Upload  │ ──► │  2. Style   │ ──► │  3. AI Gen  │
│  5-8 фото   │     │  selection  │     │  23 photos  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌─────────────┐     ┌──────▼──────┐
                    │  5. Share   │ ◄── │  4. Result  │
                    │  download   │     │  gallery    │
                    └─────────────┘     └─────────────┘
```

### Стили генерации
| Стиль | Описание | Применение |
|-------|----------|------------|
| **Professional** | Бизнес-портреты | LinkedIn, резюме |
| **Lifestyle** | Повседневные фото | Instagram, соцсети |
| **Creative** | Художественные | Портфолио, арт |

### Тарифы
| План | Фото | Цена |
|------|------|------|
| Starter | 7 | 499 ₽ |
| **Standard** | 15 | 999 ₽ |
| Premium | 23 | 1,499 ₽ |

---

## 4. Partner Program — Go-To-Market Strategy

### Почему партнёрская программа?

```
┌─────────────────────────────────────────────────────────────┐
│                    GTM FLYWHEEL                              │
│                                                              │
│    Partners ──► New Users ──► Payments ──► Commission ──►   │
│        ▲                                         │          │
│        └─────────────── More Partners ◄──────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Двухуровневая комиссия

| Уровень | Комиссия | Требования |
|---------|----------|------------|
| **Пользователь** | 10% | Автоматически для всех |
| **Партнёр** | 50% | Заявка + одобрение |

### Как стать партнёром

```
1. Заявка (/api/partner/apply)
   ├── Контактные данные
   ├── Размер аудитории
   ├── Каналы продвижения
   └── Ожидаемые рефералы/месяц

2. Модерация (24 часа)
   ├── Проверка аккаунта
   └── Оценка потенциала

3. Активация
   ├── Статус: is_partner = true
   ├── Комиссия: 50%
   └── Доступ к Partner Cabinet
```

### Partner Cabinet Features

| Функция | Описание |
|---------|----------|
| **Dashboard** | KPI, баланс, график доходов |
| **Earnings** | История начислений с фильтрами |
| **Referrals** | Список рефералов, конверсия |
| **Withdrawals** | Вывод на карту/СБП (мин. 5000₽) |
| **Packs** | Создание своих паков промптов |

### Экономика партнёра

**Пример: блогер с 10K подписчиков**

```
Конверсия в регистрацию: 5% = 500 юзеров
Конверсия в оплату: 10% = 50 платежей
Средний чек: 999 ₽
Комиссия партнёра: 50%

Доход = 50 × 999 × 0.50 = 24,975 ₽

За вычетом НДФЛ (13%): 21,728 ₽
```

### Реферальные ссылки

| Канал | Формат | Пример |
|-------|--------|--------|
| **Telegram** | `t.me/pinglass_bot?start=CODE` | Глубокая ссылка в бота |
| **Web** | `pinglass.ru/?ref=CODE` | Редирект в Telegram |

### Защита от фрода

1. **Atomic transactions** — баланс обновляется атомарно
2. **Deferred earnings** — комиссия после завершения генерации
3. **FOR UPDATE SKIP LOCKED** — защита от race conditions
4. **Deduplication** — один реферал = одно начисление

---

## 5. Technical Architecture

### Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Next.js 16 + React 19 + Tailwind CSS 4                     │
│  Telegram WebApp SDK + TON Connect                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         API LAYER                            │
│  Next.js App Router + Edge Runtime (critical routes)        │
│  QStash (background jobs) + Vercel Cron                     │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    DATABASE     │ │    STORAGE      │ │   AI PROVIDER   │
│ Neon PostgreSQL │ │ Cloudflare R2   │ │ Kie.ai + Repli- │
│   (serverless)  │ │    (CDN)        │ │     cate        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Authentication Flow

```
Telegram WebApp
      │
      ▼
[x-telegram-init-data header]
      │
      ▼
validateTelegramInitData() ──► HMAC verification
      │
      ▼
findOrCreateTelegramUser()
      │
      ▼
Authenticated Session
```

### Payment Providers

| Provider | Currency | Flow |
|----------|----------|------|
| **T-Bank** | RUB | Redirect → Webhook |
| **Stars** | ⭐ | Telegram Invoice |
| **TON** | TON | TON Connect |

### Async Generation

```
POST /api/generate
      │
      ▼
Create generation_job (status: 'queued')
      │
      ▼
Publish to QStash ──► /api/jobs/process
      │                       │
      ▼                       ▼
Return jobId          Loop prompts:
                           │
                      createKieTask()
                           │
                           ▼
                      kie_tasks table
                           │
                           ▼
                      Cron: poll-kie-tasks
                           │
                           ▼
                      Download → R2 → DB
```

---

## 6. Recent Updates (Test Branch)

### January 2026 Releases

| Feature | Status | Impact |
|---------|--------|--------|
| **Edge Runtime** | ✅ Done | Faster response times |
| **CI/CD Pipeline** | ✅ Done | Automated testing |
| **E2E Tests** | ✅ Done | 10+ test specs |
| **Partner Cabinet** | ✅ Done | Full dashboard |
| **Telegram-only Auth** | ✅ Done | Simplified UX |
| **Dynamic Packs** | ✅ Done | Custom prompts |

### File Changes Summary
- **66 files changed**
- **+6,819 lines** added
- **-450 lines** removed
- New: `AGENTS.md`, `docs/ENV_VARIABLES.md`
- New: E2E tests with Playwright

---

## 7. Competitive Analysis

### Competitors

| Competitor | Price | Time | Platform |
|------------|-------|------|----------|
| Lensa | $8-30 | 20min | Mobile app |
| EPIK | $10-20 | 30min | Mobile app |
| PhotoAI | $29-99 | 1hr | Web |
| **PinGlass** | $5-15 | 5-10min | Telegram |

### Advantages

1. **Price** — 2-3x дешевле конкурентов
2. **Speed** — быстрее за счёт Kie.ai
3. **Distribution** — Telegram = 800M users
4. **Payments** — криптовалюта + Stars
5. **Partner Program** — viral growth engine

---

## 8. Presentation Flow (30 min)

### Slide Structure

| # | Slide | Time | Content |
|---|-------|------|---------|
| 1 | Title | 1 min | Logo, tagline, speaker |
| 2 | Problem | 3 min | Pain points, market gap |
| 3 | Solution | 5 min | Demo video, how it works |
| 4 | Product | 5 min | Screenshots, features |
| 5 | **Partner Program** | 8 min | GTM strategy, economics |
| 6 | Technology | 3 min | Architecture diagram |
| 7 | Traction | 3 min | Metrics, growth |
| 8 | Team | 1 min | Founders, advisors |
| 9 | Q&A | - | Open discussion |

### Demo Script

1. **Open Telegram** → tap bot link
2. **Onboarding** → swipe through 3 steps
3. **Upload** → select 5 photos from gallery
4. **Style** → choose "Professional"
5. **Payment** → pay with Stars
6. **Wait** → show progress (skip with pre-generated)
7. **Results** → scroll gallery, download

### Key Talking Points

**For Investors:**
- Market size: $10B AI photo market by 2027
- Unit economics: 70%+ gross margin
- Viral coefficient: partner program

**For Partners:**
- 50% commission = real income
- No inventory, no risk
- Instant payouts via SBP

---

## 9. Materials Checklist

- [ ] Pitch deck (Google Slides/Figma)
- [ ] Demo video (2-3 min)
- [ ] Product screenshots (UI mockups exist)
- [ ] Partner economics calculator
- [ ] Technical architecture diagram
- [ ] Competitive analysis table
- [ ] Press kit (logo, brand assets)

---

## 10. Appendix: URLs & Resources

### Documentation
- **UI Mockups:** `docs/mockups/admin-panel-mockups.html`
- **Redesign Previews:** `.openchamber/eager-walrus/docs/redesign-preview/`
- **ENV Reference:** `docs/ENV_VARIABLES.md`
- **Agent Instructions:** `AGENTS.md`

### API Endpoints
- Partner Apply: `POST /api/partner/apply`
- Partner Stats: `GET /api/partner/stats`
- Referral Code: `GET /api/referral/code`
- Withdraw: `POST /api/referral/withdraw`

### Memory & Knowledge
- Serena: `mcp__serena__read_memory`
- Memory MCP: `mcp__memory__search_nodes`
- ByteRover: `.brv/context-tree/`

---

*Last Updated: 2026-01-27*
