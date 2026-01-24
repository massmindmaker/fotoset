# PinGlass Environment Variables Reference

> **Last Updated:** 2026-01-24
> **Total Variables:** 65+

---

## Quick Setup (Minimum Required)

```env
# Minimum for local development
DATABASE_URL=postgresql://user:password@host:5432/database
NEXT_PUBLIC_APP_URL=http://localhost:3000
KIE_AI_API_KEY=your_kie_api_key
```

---

## 1. Database

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | Neon PostgreSQL connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | No | Direct connection for migrations |

**Example:**
```env
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

## 2. App URL

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | **Yes** | Public app URL for callbacks |

**Example:**
```env
NEXT_PUBLIC_APP_URL=https://pinglass.ru
```

---

## 3. AI Generation Providers

### Kie.ai (Primary)

| Variable | Required | Description |
|----------|----------|-------------|
| `KIE_AI_API_KEY` | **Yes*** | Kie.ai API key (async generation) |
| `KIE_API_KEY` | No | Alias for KIE_AI_API_KEY |

### Replicate (Fallback)

| Variable | Required | Description |
|----------|----------|-------------|
| `REPLICATE_API_TOKEN` | No | Replicate API token (r8_xxx) |
| `REPLICATE_PRIMARY_MODEL` | No | Default model: `nano-banana-pro` |
| `REPLICATE_MAX_RETRIES` | No | Default: `3` |
| `REPLICATE_BUDGET_PER_GENERATION` | No | Default: `5.00` USD |
| `REPLICATE_ENABLE_FALLBACK` | No | Default: `true` |

### Google Gemini (Support AI)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No | For AI support chat |
| `GEMINI_MODEL` | No | Default: `gemini-2.0-flash` |

### Legacy (Deprecated)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | No | Legacy Google AI key |
| `YESCALE_API_KEY` | No | YeScale proxy key (deprecated) |

**Example:**
```env
KIE_AI_API_KEY=abc123def456
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 4. T-Bank Payments

### Production

| Variable | Required | Description |
|----------|----------|-------------|
| `TBANK_TERMINAL_KEY` | **Yes*** | Production terminal key |
| `TBANK_PASSWORD` | **Yes*** | Production password |

### Test Mode

| Variable | Required | Description |
|----------|----------|-------------|
| `TBANK_TEST_TERMINAL_KEY` | No | Test terminal key (contains "DEMO") |
| `TBANK_TEST_PASSWORD` | No | Test password |
| `TBANK_MODE` | No | `test` or `production` |

**Example:**
```env
# Production
TBANK_TERMINAL_KEY=1765404063316
TBANK_PASSWORD=xxxxxxxxxxxxxxxx

# Test (optional)
TBANK_TEST_TERMINAL_KEY=1765404063316DEMO
TBANK_TEST_PASSWORD=xxxxxxxxxxxxxxxx
TBANK_MODE=test
```

---

## 5. Telegram Integration

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | **Yes*** | Bot token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | No | Bot username (e.g., `pinglassbot`) |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | No | Public bot username |
| `TELEGRAM_WEBHOOK_SECRET` | No | Webhook verification secret |

### MTProto (Advanced)

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_API_ID` | No | For advanced Telegram features |
| `TELEGRAM_API_HASH` | No | For advanced Telegram features |

**Example:**
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_BOT_USERNAME=pinglassbot
```

---

## 6. Upstash QStash (Background Jobs)

| Variable | Required | Description |
|----------|----------|-------------|
| `QSTASH_TOKEN` | **Yes*** | QStash API token |
| `QSTASH_CURRENT_SIGNING_KEY` | **Yes*** | Current webhook signing key |
| `QSTASH_NEXT_SIGNING_KEY` | **Yes*** | Next webhook signing key |

**Example:**
```env
QSTASH_TOKEN=eyJVc2VySUQiOiIx...
QSTASH_CURRENT_SIGNING_KEY=sig_xxxxxxxx
QSTASH_NEXT_SIGNING_KEY=sig_yyyyyyyy
```

---

## 7. Cloudflare R2 Storage

### Primary Variables (Recommended)

| Variable | Required | Description |
|----------|----------|-------------|
| `R2_ACCOUNT_ID` | **Yes*** | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | **Yes*** | R2 API access key |
| `R2_SECRET_ACCESS_KEY` | **Yes*** | R2 API secret |
| `R2_BUCKET_NAME` | No | Default: `pinglass` |
| `R2_PUBLIC_URL` | **Yes*** | Public CDN URL |

### Alternative Naming (Also Supported)

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Alias for R2_ACCOUNT_ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Alias for R2_ACCESS_KEY_ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Alias for R2_SECRET_ACCESS_KEY |
| `CLOUDFLARE_R2_BUCKET_NAME` | Alias for R2_BUCKET_NAME |
| `CLOUDFLARE_R2_PUBLIC_URL` | Alias for R2_PUBLIC_URL |

**Example:**
```env
R2_ACCOUNT_ID=abc123def456
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=pinglass
R2_PUBLIC_URL=https://cdn.pinglass.ru
```

---

## 8. Sentry Error Monitoring

| Variable | Required | Description |
|----------|----------|-------------|
| `SENTRY_DSN` | No | Server-side DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Client-side DSN (public) |
| `SENTRY_AUTH_TOKEN` | No | API token for admin logs |
| `SENTRY_ORG` | No | Organization slug |
| `SENTRY_PROJECT` | No | Project slug |

### Vercel Prefixed (Also Supported)

| Variable | Description |
|----------|-------------|
| `fotoset_SENTRY_AUTH_TOKEN` | Vercel auto-prefixed token |
| `fotoset_SENTRY_ORG` | Vercel auto-prefixed org |
| `fotoset_SENTRY_PROJECT` | Vercel auto-prefixed project |

### Public (for EventDetailsModal)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SENTRY_ORG` | For client-side Sentry links |
| `NEXT_PUBLIC_SENTRY_PROJECT` | For client-side Sentry links |

**Example:**
```env
SENTRY_DSN=https://xxxxx@o123456.ingest.sentry.io/789
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@o123456.ingest.sentry.io/789
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxx
SENTRY_ORG=pinglass
SENTRY_PROJECT=sentry-purple-zebra
```

---

## 9. TON Crypto Payments (Jump Finance)

| Variable | Required | Description |
|----------|----------|-------------|
| `JUMP_API_KEY` | No | Jump Finance API key |
| `JUMP_SECRET_KEY` | No | Jump Finance webhook secret |
| `JUMP_BASE_URL` | No | Default: `https://api.jump.finance/v1` |
| `TON_CENTER_API_KEY` | No | TON Center API key (rate limits) |
| `NEXT_PUBLIC_TON_MANIFEST_URL` | No | TON Connect manifest URL |

**Example:**
```env
JUMP_API_KEY=your_jump_api_key
JUMP_SECRET_KEY=your_jump_secret
TON_CENTER_API_KEY=your_toncenter_key
NEXT_PUBLIC_TON_MANIFEST_URL=https://pinglass.ru/tonconnect-manifest.json
```

---

## 10. Admin Panel

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_SESSION_SECRET` | **Yes*** | 32+ char secret for sessions |
| `ADMIN_SESSION_TTL` | No | Session TTL in seconds (default: 86400 = 24h) |
| `ADMIN_SUPER_EMAIL` | No | Super admin email (full access) |
| `ADMIN_ALLOW_GOOGLE_REGISTRATION` | No | Allow new admin signups (`true`/`false`) |

### Google OAuth (for Admin Login)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | **Yes*** | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | **Yes*** | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | No | Custom redirect URI |

**Example:**
```env
ADMIN_SESSION_SECRET=your-32-char-secret-key-here-min
ADMIN_SESSION_TTL=86400
ADMIN_SUPER_EMAIL=admin@pinglass.ru
ADMIN_ALLOW_GOOGLE_REGISTRATION=false

GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
```

---

## 11. Neon Auth (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEON_AUTH_BASE_URL` | No | Neon Auth service URL |

---

## 12. Cron Jobs

| Variable | Required | Description |
|----------|----------|-------------|
| `CRON_SECRET` | **Yes*** | Secret for cron endpoint auth |

**Example:**
```env
CRON_SECRET=your_cron_secret_key
```

---

## 13. Logging & Debug

| Variable | Required | Description |
|----------|----------|-------------|
| `ENABLE_PROD_INFO_LOGS` | No | Enable info logs in production (`true`) |
| `NODE_ENV` | Auto | `development`, `production`, `test` |

---

## 14. Testing

| Variable | Required | Description |
|----------|----------|-------------|
| `CI` | Auto | Set by CI/CD systems |
| `TEST_URL` | No | Override base URL for E2E tests |
| `TEST_DATABASE_URL` | No | Separate test database |
| `TEST_GOOGLE_API_KEY` | No | Test API key |
| `TEST_TBANK_TERMINAL_KEY` | No | Test terminal key |
| `TEST_TBANK_PASSWORD` | No | Test password |

---

## Vercel-Specific Variables

These are auto-set by Vercel:

| Variable | Description |
|----------|-------------|
| `VERCEL` | Always `1` on Vercel |
| `VERCEL_ENV` | `development`, `preview`, `production` |
| `VERCEL_URL` | Deployment URL |
| `NEXT_RUNTIME` | `nodejs` or `edge` |

---

## Template for .env.local

```env
# ===========================================
# PinGlass Environment Variables
# ===========================================

# --- DATABASE ---
DATABASE_URL=postgresql://user:password@host:5432/database

# --- APP URL ---
NEXT_PUBLIC_APP_URL=http://localhost:3000

# --- AI GENERATION ---
KIE_AI_API_KEY=
REPLICATE_API_TOKEN=

# --- PAYMENTS: T-BANK ---
TBANK_TERMINAL_KEY=
TBANK_PASSWORD=
TBANK_TEST_TERMINAL_KEY=
TBANK_TEST_PASSWORD=

# --- TELEGRAM ---
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=pinglassbot

# --- QSTASH (Background Jobs) ---
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# --- CLOUDFLARE R2 ---
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=pinglass
R2_PUBLIC_URL=

# --- SENTRY ---
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=

# --- ADMIN PANEL ---
ADMIN_SESSION_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- CRON ---
CRON_SECRET=

# --- TON PAYMENTS (Optional) ---
JUMP_API_KEY=
JUMP_SECRET_KEY=
NEXT_PUBLIC_TON_MANIFEST_URL=
```

---

## Notes

1. Variables marked with **Yes*** are required for specific features to work
2. Without T-Bank credentials, app runs in demo mode
3. Without QStash, generation may timeout on Vercel (100s limit)
4. R2 is required for storing generated images in production
5. Sentry is optional but recommended for error tracking
