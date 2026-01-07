# Security Implementation Summary

## Overview

This document summarizes the security improvements implemented for PinGlass on 2025-12-11.

---

## Files Created

### 1. `lib/rate-limiter.ts` (372 lines)

**Purpose:** In-memory rate limiting for API endpoints without Redis dependency.

**Key Features:**
- Singleton pattern with automatic cleanup
- Per-client tracking (device ID or IP address)
- Configurable limits per endpoint type
- Automatic expired entry cleanup every 5 minutes
- Standard HTTP rate limit response headers

**Rate Limits:**
```typescript
GENERATION:  3 requests / hour   // Expensive AI operations
PAYMENT:     5 requests / hour   // Prevent payment spam
STATUS:      30 requests / hour  // Polling allowed
USER:        10 requests / hour  // General API
DEFAULT:     20 requests / hour  // Other endpoints
```

**Client Identification Priority:**
1. `x-device-id` header (preferred)
2. `x-forwarded-for` or `x-real-ip` (fallback)

**API:**
```typescript
// Check rate limit
checkRateLimitByType(key: string, type: keyof RATE_LIMITS)

// Create 429 response
createRateLimitResponse(result)

// Get client identifier from request
getClientIdentifier(request: Request)
```

---

### 2. `lib/telegram-auth.ts` (234 lines)

**Purpose:** Validate Telegram Mini App authentication using HMAC-SHA256.

**Security Features:**
- HMAC-SHA256 validation per Telegram official spec
- Constant-time hash comparison (prevents timing attacks)
- Replay attack prevention (validates `auth_date` freshness)
- Device ID enforcement (`tg_{user_id}`)
- Maximum age validation (default: 24 hours)

**Validation Algorithm:**
```
1. Parse initData → key-value pairs
2. Extract & remove hash parameter
3. Sort remaining parameters alphabetically
4. Create data-check-string: key=value\nkey=value\n...
5. Calculate secret_key = HMAC-SHA256(bot_token, "WebAppData")
6. Calculate expected_hash = HMAC-SHA256(secret_key, data_check_string)
7. Constant-time compare with provided hash
8. Verify auth_date within maxAge window
```

**API:**
```typescript
// Validate Telegram initData
validateTelegramInitData(
  initDataRaw: string,
  botToken: string,
  maxAge?: number
): TelegramInitData | null

// Get device ID from Telegram user
getTelegramDeviceId(user: TelegramUser): string

// Create 401 response
createUnauthorizedResponse(): Response
```

**Types:**
```typescript
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramInitData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  chat_instance?: string;
  chat_type?: string;
  start_param?: string;
}
```

---

### 3. `middleware.ts` (164 lines)

**Purpose:** Edge middleware for security headers and rate limiting.

**Runs on Edge Runtime** - Executes before API routes, applies to all requests.

**Security Headers:**
```typescript
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: [comprehensive policy]
Strict-Transport-Security: max-age=31536000 (production only)
```

**Content Security Policy:**
```
default-src 'self'
script-src 'self' 'unsafe-eval' 'unsafe-inline' https://telegram.org https://vercel.live
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob: https:
connect-src 'self' https://*.vercel-insights.com https://*.google.com https://api.yescale.ai
frame-src 'self' https://telegram.org https://yoomoney.ru https://securepayments.tinkoff.ru
```

**Rate Limiting:**
- All `/api/*` routes except `/api/payment/webhook`
- Per-client identification (device ID or IP)
- Returns 429 with `Retry-After` header
- Adds `X-RateLimit-*` headers to responses

**Method Enforcement:**
- `POST /api/generate` - only POST allowed
- `POST /api/payment/create` - only POST allowed
- Rejects other methods with 405 Method Not Allowed

**Matcher Configuration:**
```typescript
matcher: [
  '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp)).*)'
]
```

---

### 4. `app/api/user/route.ts` (Enhanced)

**Changes:**
- Added Telegram initData validation
- Device ID priority logic for Telegram users
- Device ID mismatch logging (security audit)
- Fallback to deviceId-only for non-Telegram clients
- Payment status is checked via /api/payment/status endpoint

**Authentication Flow:**

```
┌─────────────────────────────────┐
│ Request with telegramInitData?  │
└────────────┬────────────────────┘
             │
        ┌────┴────┐
     Yes│        │No
        │        └──────────────────┐
        ▼                           ▼
┌──────────────────┐    ┌───────────────────┐
│ Validate HMAC    │    │ Check deviceId    │
│ with bot token   │    │ required          │
└────────┬─────────┘    └─────────┬─────────┘
         │                        │
    ┌────┴────┐                   │
 Valid│   │Invalid               │
      │   └─────────────┐        │
      ▼                 ▼        ▼
┌──────────┐    ┌──────────┐  ┌──────────┐
│ Get tg   │    │ Return   │  │ Find/    │
│ user ID  │    │ 401      │  │ Create   │
└────┬─────┘    └──────────┘  │ User     │
     │                        └────┬─────┘
     ▼                             │
┌──────────────────┐               │
│ Create tg device │               │
│ ID: tg_{user_id} │               │
└────────┬─────────┘               │
         │                         │
         ▼                         │
┌──────────────────┐               │
│ Find/Create User │               │
│ Return user data │◄──────────────┘
│                  │
└──────────────────┘
```

**Security Enhancements:**
1. HMAC validation prevents forged Telegram auth
2. Constant-time comparison prevents timing attacks
3. Replay attack prevention via `auth_date` check
4. Device ID enforcement (can't spoof Telegram user ID)
5. Mismatch logging for security audits

---

## OWASP Top 10 Coverage

| Vulnerability | Mitigation Implemented |
|---------------|------------------------|
| **A01: Broken Access Control** | Device ID + Telegram HMAC auth, Pro status validation |
| **A02: Cryptographic Failures** | HSTS header (HTTPS enforced), HMAC-SHA256 validation |
| **A03: Injection** | Parameterized SQL queries (already in place) |
| **A04: Insecure Design** | Rate limiting, webhook signatures (T-Bank) |
| **A05: Security Misconfiguration** | Security headers, CSP, X-Frame-Options, method enforcement |
| **A06: Vulnerable Components** | (Requires regular `pnpm audit`) |
| **A07: Auth Failures** | Telegram HMAC validation, session validation |
| **A08: Data Integrity** | T-Bank webhook signatures, Telegram initData validation |
| **A09: Logging Failures** | Structured logging with [User API] prefixes |
| **A10: SSRF** | No user-controlled server-side URLs |

---

## Environment Variables Added

```env
# Telegram Bot (Optional - enables Telegram Mini App authentication)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

**Security Note:** Never expose this token to client-side code. Only used server-side for HMAC validation.

---

## Testing Checklist

### Rate Limiting
```bash
# Test generation endpoint rate limit (should fail on 4th request)
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/generate \
    -H "x-device-id: test-device" \
    -H "Content-Type: application/json" \
    -d '{"deviceId":"test-device","avatarId":"1","styleId":"professional","referenceImages":[]}'
done
```

### Security Headers
```bash
# Verify headers are present
curl -I https://pinglass.app

# Should include:
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Content-Security-Policy: ...
# - Strict-Transport-Security: max-age=31536000
```

### Telegram Authentication
```javascript
// In Telegram Mini App browser console
const initData = window.Telegram.WebApp.initData;

fetch('/api/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ telegramInitData: initData }),
})
.then(r => r.json())
.then(console.log);

// Should return: { id, deviceId, telegramUserId }
```

### Invalid Telegram Auth
```javascript
// Test with tampered initData
fetch('/api/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    telegramInitData: 'query_id=fake&user={"id":123}&auth_date=1234567890&hash=invalid'
  }),
});

// Should return 401 Unauthorized
```

---

## Monitoring & Alerts

### Security Events to Monitor

**Rate Limit Violations:**
```
[Rate Limit] {clientId} exceeded {type} limit on {pathname}
```

**Invalid Telegram Auth:**
```
[User API] Invalid Telegram initData
[User API] No user data in Telegram initData
```

**Device ID Mismatches:**
```
[User API] Device ID mismatch: provided={deviceId}, telegram={telegramDeviceId}
```

**Configuration Errors:**
```
[User API] TELEGRAM_BOT_TOKEN not configured
```

### Recommended Alerts

1. **High Rate Limit Violations** - >10 violations/minute from same client
2. **Invalid Telegram Auth Attempts** - >5 attempts/minute from same IP
3. **Missing Environment Variables** - TELEGRAM_BOT_TOKEN errors in production

---

## Known Limitations

### 1. In-Memory Rate Limiter

**Issue:** Rate limits reset on serverless cold starts.

**Impact:** Users can bypass limits by triggering new deployments.

**Future Mitigation:**
- Implement Redis-based rate limiter (Upstash, Vercel KV)
- Use Edge Config for distributed rate limiting
- Database-backed rate limiting for persistent state

### 2. No CSRF Protection

**Current:** API uses device ID (not cookies), so CSRF risk is minimal.

**Future:** Add CSRF tokens if implementing cookie-based sessions.

### 3. No Request Signing

**Current:** Device IDs are not cryptographically signed.

**Mitigation:** Telegram auth uses HMAC with timestamps (prevents replay).

**Future:** Consider request signatures for critical operations.

---

## Production Deployment Steps

1. Set environment variables in Vercel:
   ```env
   NODE_ENV=production
   TELEGRAM_BOT_TOKEN=<your_bot_token>
   ```

2. Test rate limiting with realistic traffic patterns

3. Verify CSP doesn't block legitimate resources

4. Test Telegram auth flow end-to-end

5. Monitor security event logs for anomalies

6. Run `pnpm audit` and fix vulnerabilities

7. Test payment webhook signatures (T-Bank)

8. Enable HSTS (automatic in production via middleware)

---

## Security Response Procedures

### Rate Limit Violation

1. Check logs for client identifier
2. Verify legitimate vs malicious traffic
3. If malicious: block IP at Vercel firewall level
4. If legitimate: consider increasing limits

### Invalid Telegram Auth Attack

1. Log attempt details (timestamp, IP, user agent)
2. Check for patterns (same IP, multiple attempts)
3. If sustained attack: consider temporary Telegram-only mode
4. Alert security team if >100 attempts/hour

### Payment Webhook Tampering

1. T-Bank webhooks include signature validation
2. Failed signatures log warnings automatically
3. Transaction not marked successful without valid signature
4. Manual verification required for disputed payments

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Telegram WebApp Authentication](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/deploying/production-checklist#security)
- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [HTTP Security Headers](https://owasp.org/www-project-secure-headers/)

---

**Implementation Date:** 2025-12-11
**Version:** 1.0
**Status:** Production Ready
