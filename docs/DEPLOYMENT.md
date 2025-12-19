# PinGlass Deployment Guide

Complete guide for deploying PinGlass to production.

---

## Prerequisites

- Vercel account
- Neon PostgreSQL database
- Google Cloud account (for Imagen API)
- T-Bank merchant account
- Telegram Bot Token
- Git repository

---

## Environment Variables

### Required Variables

Create `.env.local` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/pinglass?sslmode=require

# Google AI
GOOGLE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# T-Bank Payment
TBANK_TERMINAL_KEY=1234567890123456
TBANK_PASSWORD=your_password_here

# YeScale Proxy (Optional)
YESCALE_API_KEY=ys-XXXXXXXXXXXXXXXXXXXXXXXX

# App URL
NEXT_PUBLIC_APP_URL=https://pinglass.vercel.app

# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Environment Setup by Platform

#### Vercel
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.local`
3. Set scope: Production, Preview, Development

#### Local Development
1. Copy `.env.example` to `.env.local`
2. Fill in all required values
3. Never commit `.env.local` to git

---

## Database Setup

### 1. Create Neon Project

1. Go to [neon.tech](https://neon.tech)
2. Create new project: "PinGlass"
3. Select region: US East (Ohio) or nearest
4. Copy connection string

### 2. Run Migrations

```bash
# Connect to database
psql $DATABASE_URL

# Run all migrations in order
\i scripts/migrations/001_initial_schema.sql
\i scripts/migrations/002_add_payments.sql
\i scripts/migrations/003_add_generation_jobs.sql
# ... (run all migrations)
\i scripts/migrations/014_remove_device_id.sql
```

**Or use migration script:**
```bash
node scripts/run-migration.mjs scripts/migrations/014_remove_device_id.sql
```

### 3. Verify Schema

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Expected tables:
-- users, avatars, generated_photos, payments, generation_jobs
```

---

## Google Cloud Setup

### 1. Enable Imagen API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable "Vertex AI API"
4. Enable "Imagen API"

### 2. Create API Key

1. Go to APIs & Services → Credentials
2. Create API Key
3. Restrict to Imagen API only
4. Copy key to `GOOGLE_API_KEY` env var

### 3. Set Up Billing

1. Go to Billing
2. Link payment method
3. Set budget alerts (recommended: $100/month)

**Pricing:**
- Imagen 3.0 Generate: ~$0.04 per image
- 23 photos = ~$0.92 per generation

---

## T-Bank Payment Setup

### 1. Register Merchant Account

1. Go to [T-Bank Business](https://www.tbank.ru/business/)
2. Register business account
3. Apply for merchant services
4. Wait for approval (1-3 days)

### 2. Get API Credentials

1. Login to merchant dashboard
2. Go to Settings → API
3. Copy Terminal Key and Password
4. Set `TBANK_TERMINAL_KEY` and `TBANK_PASSWORD`

### 3. Configure Webhooks

1. Go to Settings → Notifications
2. Add webhook URL: `https://pinglass.vercel.app/api/payment/webhook`
3. Select events:
   - `payment.succeeded`
   - `payment.canceled`
4. Save configuration

### 4. Test Mode

For testing, use test credentials:
```env
TBANK_TERMINAL_KEY=TestTerminalKey
TBANK_PASSWORD=TestPassword
```

**Note:** Test payments won't charge real money.

---

## Telegram Bot Setup

### 1. Create Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Follow instructions
4. Copy Bot Token to `TELEGRAM_BOT_TOKEN`

### 2. Configure Mini App

1. Send `/mybots` to BotFather
2. Select your bot
3. Click "Bot Settings" → "Menu Button"
4. Set Web App URL: `https://pinglass.vercel.app`

### 3. Set Bot Commands

```
/start - Запустить приложение
/help - Помощь
/status - Проверить статус Pro
```

### 4. Configure Bot Description

```
PinGlass - генерация AI-портретов
Создайте 23 профессиональных фото за 500₽
```

---

## Vercel Deployment

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Select GitHub repository
4. Configure project:
   - Framework: Next.js
   - Root Directory: `./`
   - Build Command: `pnpm build`
   - Output Directory: `.next`

### 2. Configure Environment Variables

Add all variables from `.env.local` to Vercel:
- DATABASE_URL
- GOOGLE_API_KEY
- TBANK_TERMINAL_KEY
- TBANK_PASSWORD
- YESCALE_API_KEY (optional)
- NEXT_PUBLIC_APP_URL
- TELEGRAM_BOT_TOKEN

### 3. Deploy

```bash
# Push to main branch
git add .
git commit -m "Initial deployment"
git push origin main

# Vercel auto-deploys on push
```

### 4. Verify Deployment

1. Check build logs in Vercel dashboard
2. Visit deployed URL
3. Test Telegram Mini App
4. Verify database connection
5. Test payment flow (test mode)

---

## Post-Deployment

### 1. DNS Configuration

1. Go to Vercel → Settings → Domains
2. Add custom domain: `pinglass.ru`
3. Configure DNS records:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

### 2. SSL Certificate

- Vercel automatically provisions SSL via Let's Encrypt
- Certificate renews automatically
- HTTPS enforced by default

### 3. Analytics

Vercel Analytics is already integrated via:
```tsx
import { Analytics } from '@vercel/analytics/react'

<Analytics />
```

### 4. Monitoring

**Recommended Tools:**
- Vercel Analytics (built-in)
- Sentry for error tracking
- Neon monitoring dashboard
- T-Bank payment dashboard

---

## Continuous Deployment

### Auto-Deploy Workflow

```
Developer commits → Git push to main
    ↓
GitHub webhook → Vercel
    ↓
Vercel builds project (pnpm build)
    ↓
Run tests (if configured)
    ↓
Deploy to production
    ↓
Notify on success/failure
```

### Preview Deployments

- Every PR gets preview URL
- Test changes before merging
- Automatic cleanup after merge

---

## Rollback Procedure

### Quick Rollback

1. Go to Vercel → Deployments
2. Find last working deployment
3. Click "Promote to Production"
4. Confirm rollback

### Manual Rollback

```bash
# Revert last commit
git revert HEAD

# Push to main
git push origin main

# Vercel auto-deploys reverted version
```

---

## Troubleshooting

### Build Failures

**Error:** `Module not found`
```bash
# Clear cache and rebuild
pnpm clean
pnpm install
pnpm build
```

**Error:** `Type error in components/persona-app.tsx`
```bash
# Check TypeScript errors
pnpm tsc --noEmit
```

### Database Connection Issues

**Error:** `Connection timeout`
- Check DATABASE_URL format
- Verify Neon database is running
- Check IP whitelist (Neon allows all by default)

**Error:** `SSL required`
```env
DATABASE_URL=postgresql://...?sslmode=require
```

### Payment Webhook Issues

**Error:** `Invalid signature`
- Verify TBANK_PASSWORD is correct
- Check webhook URL in T-Bank dashboard
- Ensure HTTPS (not HTTP)

**Error:** `Webhook not received`
- Check Vercel function logs
- Verify T-Bank webhook configuration
- Test with T-Bank webhook tester

### Telegram Mini App Issues

**Error:** `window.Telegram is undefined`
- App only works in Telegram Mini App
- Test using Telegram Bot link
- Check NEXT_PUBLIC_APP_URL

---

## Performance Optimization

### 1. Image Optimization

```tsx
// Use Next.js Image component
import Image from 'next/image'

<Image
  src={photo.url}
  width={400}
  height={400}
  alt="Generated photo"
/>
```

### 2. Code Splitting

```tsx
// Lazy load heavy components
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })
```

### 3. Database Connection Pooling

Neon uses connection pooling by default:
```env
DATABASE_URL=postgresql://...?sslmode=require&connect_timeout=10
```

### 4. Caching

```tsx
// Add revalidation to API routes
export const revalidate = 60 // 1 minute
```

---

## Security Checklist

- [ ] All API keys in environment variables (not committed)
- [ ] Telegram webhook signature validation
- [ ] T-Bank webhook signature validation
- [ ] HTTPS enforced on all endpoints
- [ ] Database uses SSL connections
- [ ] No sensitive data in logs
- [ ] CORS disabled (same-origin only)
- [ ] Rate limiting implemented (recommended)

---

## Cost Estimation

**Monthly Costs (1000 users, 500 generations):**

- Vercel Hosting: $0 (free tier) or $20/month (Pro)
- Neon Database: $0 (free tier) or $19/month (Pro)
- Google Imagen API: ~$460 (500 generations × 23 photos × $0.04)
- T-Bank fees: 2.5% commission on payments
- Total: ~$500-600/month

**Revenue (500 Pro subscriptions × 500₽):**
- Gross: 250,000₽ (~$2,500)
- Net (after costs): ~$1,900/month

---

**Last Updated:** December 19, 2024
**Version:** 2.0
