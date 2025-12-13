# Deployment Guide

## Overview

PinGlass is designed for deployment on **Vercel** with **Neon PostgreSQL** database.

---

## Prerequisites

1. **Vercel Account** - For hosting
2. **Neon Account** - For PostgreSQL database
3. **T-Bank Merchant Account** - For payments
4. **Google Cloud Project** - For Imagen API

---

## Environment Variables

### Required

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# Google AI (Imagen 3.0)
GOOGLE_API_KEY=AIza...

# App URL (for payment callbacks)
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### Optional

```env
# T-Bank Payment (production)
TBANK_TERMINAL_KEY=TinkoffBankTest
TBANK_PASSWORD=your-password

# YeScale Proxy (alternative AI provider)
YESCALE_API_KEY=sk-...
```

### Test Mode

Without T-Bank credentials, the app runs in **test mode**:
- Payments are auto-confirmed
- Payment IDs prefixed with `test_`
- Redirects to callback directly

---

## Database Setup

### 1. Create Neon Database

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create new project
3. Copy connection string

### 2. Run Migrations

```sql
-- Connect to your Neon database and run:

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  is_pro BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE avatars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255) DEFAULT 'Мой аватар',
  status VARCHAR(20) DEFAULT 'draft',
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE generated_photos (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id),
  style_id VARCHAR(50),
  prompt TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  tbank_payment_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'RUB',
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id),
  style_id VARCHAR(50),
  status VARCHAR(20),
  total_photos INTEGER DEFAULT 23,
  completed_photos INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_avatars_user_id ON avatars(user_id);
CREATE INDEX idx_generated_photos_avatar_id ON generated_photos(avatar_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_generation_jobs_avatar_id ON generation_jobs(avatar_id);
```

---

## Vercel Deployment

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Import Git repository
3. Select `PinGlass` project

### 2. Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://...` | All |
| `GOOGLE_API_KEY` | `AIza...` | All |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` | Production |
| `TBANK_TERMINAL_KEY` | `...` | Production |
| `TBANK_PASSWORD` | `...` | Production |

### 3. Deploy

```bash
# Automatic deployment on push to main
git push origin main

# Or manual deployment
vercel --prod
```

### 4. Verify Deployment

1. Visit `https://your-domain.vercel.app`
2. Complete onboarding
3. Test payment flow (test mode)
4. Verify photo generation

---

## T-Bank Integration

### 1. Register Merchant Account

1. Go to [T-Bank Business](https://business.tbank.ru)
2. Register as merchant
3. Get Terminal Key and Password

### 2. Configure Webhook

In T-Bank dashboard, set webhook URL:
```
https://your-domain.vercel.app/api/payment/webhook
```

### 3. Test Integration

```bash
# Test payment creation
curl -X POST https://your-domain.vercel.app/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test-device-123"}'
```

---

## Google Imagen API

### 1. Enable API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select project
3. Enable "Generative Language API"
4. Create API key

### 2. Configure Quota

Default quota: 60 requests/minute

For higher throughput:
1. Request quota increase
2. Or use YeScale proxy as backup

### 3. Test API

```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instances": [{"prompt": "A professional headshot"}]}'
```

---

## Monitoring

### Vercel Analytics

Automatically enabled via `@vercel/analytics`:

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Error Tracking

Consider adding:
- Sentry for error tracking
- LogDNA for log aggregation

---

## Performance Optimization

### Image Optimization

Currently disabled for external URLs:

```javascript
// next.config.mjs
export default {
  images: {
    unoptimized: true
  }
}
```

### Caching

- Static assets: Cached by Vercel CDN
- API routes: No caching (dynamic data)
- Consider Redis for session caching

---

## Security Checklist

### Before Production

- [ ] Set all environment variables
- [ ] Test payment flow end-to-end
- [ ] Configure T-Bank webhook URL
- [ ] Verify database connections
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Review CORS settings

### Recommended Improvements

- [ ] Add rate limiting
- [ ] Implement request validation
- [ ] Add API authentication tokens
- [ ] Set up monitoring alerts
- [ ] Configure backup strategy

---

## Troubleshooting

### Database Connection Issues

```
Error: Connection refused
```
- Check DATABASE_URL format
- Verify Neon project is active
- Check SSL mode (`?sslmode=require`)

### Payment Failures

```
Error: Payment creation failed
```
- Verify T-Bank credentials
- Check if in test mode
- Review T-Bank dashboard for errors

### Image Generation Failures

```
Error: Imagen API error
```
- Check GOOGLE_API_KEY validity
- Verify API quota
- Review rate limits

### Build Failures

```bash
# Check build logs
vercel logs

# Local build test
pnpm build
```

---

## Scaling Considerations

### Database

- Neon auto-scales read replicas
- Consider connection pooling for high traffic

### Image Generation

- 23 images × ~5 seconds = 115 seconds per user
- Consider queue system (Bull/Redis) for high volume
- YeScale proxy for load distribution

### File Storage

Currently using base64 data URLs.
For production scale:
- Store images in cloud storage (S3/GCS)
- Return URLs instead of base64

---

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Payment | Test mode | T-Bank live |
| Database | Local/Neon dev branch | Neon main branch |
| URL | localhost:3000 | your-domain.vercel.app |
| Debug | Full error messages | Minimal errors |
| Analytics | Disabled | Enabled |
