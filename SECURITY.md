# Security Implementation Guide

This document describes the security measures implemented in PinGlass to protect against common vulnerabilities and ensure compliance with best practices.

## Overview

PinGlass implements a defense-in-depth security strategy with the following layers:

1. **Edge Middleware** - Security headers and rate limiting
2. **Rate Limiting** - Per-endpoint request throttling
3. **Telegram Authentication** - HMAC-based validation for Telegram Mini Apps
4. **Input Validation** - Request parameter sanitization
5. **Database Security** - Parameterized queries to prevent SQL injection

---

## Security Headers

### Implementation: `middleware.ts`

All responses include the following security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking attacks |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Enables browser XSS protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables unnecessary features |
| `Content-Security-Policy` | See CSP section | Prevents XSS and injection attacks |
| `Strict-Transport-Security` | `max-age=31536000` (production only) | Enforces HTTPS |

### Content Security Policy (CSP)

```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline' https://telegram.org https://vercel.live;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https://*.vercel-insights.com https://*.google.com https://*.googleapis.com https://api.yescale.ai wss://ws.yescale.ai;
frame-src 'self' https://telegram.org https://yoomoney.ru https://securepayments.tinkoff.ru;
media-src 'self' blob:;
worker-src 'self' blob:;
```

**Allowances:**
- `unsafe-eval` and `unsafe-inline` for Next.js and React
- External scripts from Telegram and Vercel
- Images from any HTTPS source (for AI-generated photos)
- Frames for payment providers and Telegram

---

## Rate Limiting

### Implementation: `lib/rate-limiter.ts`

In-memory rate limiter (no Redis dependency) with automatic cleanup.

### Rate Limits by Endpoint

| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `/api/generate` | 3 requests | 1 hour | Expensive AI operations |
| `/api/payment/create` | 5 requests | 1 hour | Prevent payment spam |
| `/api/payment/status` | 30 requests | 1 hour | Polling allowed but limited |
| `/api/user` | 10 requests | 1 hour | General API calls |
| Other `/api/*` | 20 requests | 1 hour | Default limit |

### Client Identification

Rate limits are applied per client, identified by:

1. **Device ID** (preferred) - From `x-device-id` header
2. **IP Address** (fallback) - From `x-forwarded-for` or `x-real-ip`

### Response Headers

Rate-limited responses include:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 1234
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1702345678
```

### Usage Example

```typescript
import { checkRateLimitByType, createRateLimitResponse } from '@/lib/rate-limiter';

// In API route
const result = checkRateLimitByType(`ip:${clientIp}`, 'GENERATION');

if (!result.allowed) {
  return createRateLimitResponse(result);
}
```

---

## Telegram Authentication

### Implementation: `lib/telegram-auth.ts`

Validates Telegram Mini App `initData` using HMAC-SHA256 according to [official Telegram documentation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).

### Validation Algorithm

1. Parse `initData` string into key-value pairs
2. Extract and remove `hash` parameter
3. Sort remaining parameters alphabetically
4. Create data-check-string: `key=value\nkey=value\n...`
5. Calculate secret key: `HMAC-SHA256(bot_token, "WebAppData")`
6. Calculate expected hash: `HMAC-SHA256(secret_key, data_check_string)`
7. Compare with provided hash using constant-time comparison
8. Verify `auth_date` is within acceptable window (default: 24 hours)

### Security Features

- **Constant-time comparison** - Prevents timing attacks
- **Replay attack prevention** - Validates `auth_date` freshness
- **Device ID enforcement** - Telegram user ID becomes device ID (`tg_{user_id}`)
- **Spoofing prevention** - Rejects mismatched device IDs

### Usage Example

```typescript
import { validateTelegramInitData, getTelegramDeviceId } from '@/lib/telegram-auth';

// Validate initData from Telegram.WebApp.initData
const validated = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);

if (!validated || !validated.user) {
  return createUnauthorizedResponse();
}

// Use Telegram user ID as device identifier
const deviceId = getTelegramDeviceId(validated.user);
```

### Environment Variables

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

**Important:** Never expose bot token to client-side code.

---

## API Security

### Input Validation

All API routes validate input parameters:

```typescript
// Example: POST /api/generate
if (!deviceId || !avatarId || !styleId || !referenceImages) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
}

if (!['professional', 'lifestyle', 'creative'].includes(styleId)) {
  return NextResponse.json({ error: 'Invalid style ID' }, { status: 400 });
}
```

### SQL Injection Prevention

All database queries use parameterized queries via Neon's `sql` template tag:

```typescript
// SAFE - Parameterized query
const user = await sql`
  SELECT * FROM users WHERE device_id = ${deviceId}
`.then(rows => rows[0]);

// UNSAFE - Never do this
const query = `SELECT * FROM users WHERE device_id = '${deviceId}'`;
```

### Method Validation

Middleware enforces HTTP method restrictions:

```typescript
// Only POST allowed for generation
if (pathname.startsWith('/api/generate') && request.method !== 'POST') {
  return new NextResponse(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
  });
}
```

---

## OWASP Top 10 Mitigations

| Vulnerability | Mitigation |
|---------------|------------|
| **A01: Broken Access Control** | Device ID + Telegram auth, Pro status validation |
| **A02: Cryptographic Failures** | HTTPS enforced (HSTS), HMAC-SHA256 for Telegram auth |
| **A03: Injection** | Parameterized SQL queries, input validation |
| **A04: Insecure Design** | Rate limiting, webhook signature validation |
| **A05: Security Misconfiguration** | Security headers, CSP, X-Frame-Options |
| **A06: Vulnerable Components** | Regular `pnpm audit`, dependency updates |
| **A07: Auth Failures** | Telegram HMAC validation, session validation |
| **A08: Data Integrity** | T-Bank webhook signatures, Telegram initData validation |
| **A09: Logging Failures** | Console logging with [User API] prefixes |
| **A10: SSRF** | No user-controlled URLs for server-side requests |

---

## Deployment Checklist

### Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
GOOGLE_API_KEY=...
NEXT_PUBLIC_APP_URL=https://pinglass.app

# Payment (optional in test mode)
TBANK_TERMINAL_KEY=...
TBANK_PASSWORD=...

# Telegram (optional, enables Telegram Mini App)
TELEGRAM_BOT_TOKEN=...

# YeScale (optional)
YESCALE_API_KEY=...
```

### Pre-Production Steps

- [ ] Set `NODE_ENV=production` (enables HSTS)
- [ ] Configure `TELEGRAM_BOT_TOKEN` if using Telegram Mini App
- [ ] Test rate limiting with realistic traffic
- [ ] Verify CSP doesn't block legitimate resources
- [ ] Test payment flow end-to-end (including webhook)
- [ ] Enable T-Bank production mode (remove test mode flag)
- [ ] Configure webhook URL in T-Bank dashboard
- [ ] Run `pnpm audit` and fix vulnerabilities
- [ ] Test Telegram auth validation

### Monitoring

Monitor the following logs for security events:

```bash
# Rate limit violations
[Rate Limit] {clientId} exceeded {type} limit on {pathname}

# Invalid Telegram auth attempts
[User API] Invalid Telegram initData

# Device ID mismatches (potential spoofing)
[User API] Device ID mismatch: provided={deviceId}, telegram={telegramDeviceId}
```

---

## Known Limitations

### 1. In-Memory Rate Limiter

**Issue:** Rate limits reset on server restart (serverless cold starts).

**Impact:** Users can bypass rate limits by triggering new instance deployments.

**Mitigation:** For production at scale, consider:
- Redis-based rate limiter (Upstash, Vercel KV)
- Edge function storage (Vercel Edge Config)
- Database-backed rate limiting

### 2. No CSRF Protection

**Issue:** No CSRF tokens implemented.

**Impact:** Low risk for API-only application, but vulnerable if cookies are introduced.

**Mitigation:**
- Current: API uses device ID (not cookies)
- Future: Add CSRF tokens if implementing cookie-based sessions

### 3. No Request Signing

**Issue:** API requests are not signed.

**Impact:** Possible replay attacks if device ID is compromised.

**Mitigation:**
- Telegram auth uses HMAC with timestamps (prevents replay)
- Consider adding request signatures for critical operations

### 4. No DDoS Protection

**Issue:** Rate limiting is application-level only.

**Impact:** Network-level DDoS attacks not mitigated.

**Mitigation:** Vercel provides network-level DDoS protection automatically.

---

## Security Testing

### Manual Testing

```bash
# Test rate limiting
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/generate \
    -H "x-device-id: test-device" \
    -H "Content-Type: application/json" \
    -d '{"deviceId":"test-device","avatarId":"1","styleId":"professional","referenceImages":[]}'
done

# Expect: 3 success, 1 rate limit (429)
```

### Security Headers Check

```bash
# Check security headers
curl -I https://pinglass.app

# Expected headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: ...
# Strict-Transport-Security: max-age=31536000
```

### Telegram Auth Testing

```typescript
// In browser console (Telegram Mini App)
const initData = window.Telegram.WebApp.initData;

fetch('/api/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ telegramInitData: initData }),
});

// Should return user data with telegram_user_id
```

---

## Incident Response

### Rate Limit Violation

1. Check logs for client identifier
2. Verify legitimate vs malicious traffic
3. If malicious: block IP at Vercel firewall
4. If legitimate: consider increasing limits

### Invalid Telegram Auth

1. Log attempt details (timestamp, IP, user agent)
2. Check for patterns (same IP, multiple attempts)
3. Alert if sustained attack detected
4. Consider temporary Telegram auth requirement

### Payment Webhook Tampering

1. T-Bank webhooks include signature validation
2. Failed signature verification logs warning
3. Transaction not marked as successful
4. Manual verification required for disputed payments

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Telegram WebApp Authentication](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [HTTP Security Headers](https://owasp.org/www-project-secure-headers/)

---

**Last Updated:** 2025-12-11
**Security Version:** 1.0
