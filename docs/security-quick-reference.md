# Security Quick Reference Card

Quick reference for common security tasks in PinGlass.

---

## Rate Limiting

### Check rate limit in API route

```typescript
import { checkRateLimitByType, createRateLimitResponse, getClientIdentifier } from '@/lib/rate-limiter';

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const result = checkRateLimitByType(`generation:${clientId}`, 'GENERATION');

  if (!result.allowed) {
    return createRateLimitResponse(result);
  }

  // Continue with request...
}
```

### Available rate limit types

```typescript
'GENERATION'  // 3/hour - AI photo generation
'PAYMENT'     // 5/hour - Payment creation
'STATUS'      // 30/hour - Status polling
'USER'        // 10/hour - User operations
'DEFAULT'     // 20/hour - Other endpoints
```

---

## Telegram Authentication

### Validate Telegram initData

```typescript
import { validateTelegramInitData, getTelegramDeviceId, createUnauthorizedResponse } from '@/lib/telegram-auth';

export async function POST(request: Request) {
  const { telegramInitData } = await request.json();

  if (!telegramInitData) {
    return new Response('Telegram auth required', { status: 400 });
  }

  const validated = validateTelegramInitData(
    telegramInitData,
    process.env.TELEGRAM_BOT_TOKEN!
  );

  if (!validated || !validated.user) {
    return createUnauthorizedResponse();
  }

  const deviceId = getTelegramDeviceId(validated.user);
  const userId = validated.user.id;

  // Use deviceId and userId...
}
```

### Client-side (Telegram Mini App)

```javascript
// Get initData from Telegram WebApp
const initData = window.Telegram.WebApp.initData;

// Send to API
const response = await fetch('/api/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ telegramInitData: initData }),
});

const user = await response.json();
// { id, deviceId, telegramUserId, isPro }
```

---

## Security Headers

### Headers are automatically added by middleware

All responses include:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy: ...`
- `Strict-Transport-Security: ...` (production only)

### Testing headers

```bash
curl -I https://pinglass.app | grep -E "X-Frame|X-Content|Content-Security"
```

---

## Input Validation

### Always validate user input

```typescript
// Check required fields
if (!deviceId || !avatarId || !styleId) {
  return NextResponse.json(
    { error: 'Missing required fields' },
    { status: 400 }
  );
}

// Validate enum values
const validStyles = ['professional', 'lifestyle', 'creative'];
if (!validStyles.includes(styleId)) {
  return NextResponse.json(
    { error: 'Invalid style ID' },
    { status: 400 }
  );
}

// Validate ranges
if (referenceImages.length < 10 || referenceImages.length > 20) {
  return NextResponse.json(
    { error: 'Must provide 10-20 reference images' },
    { status: 400 }
  );
}
```

---

## Database Security

### Always use parameterized queries

```typescript
// GOOD - Parameterized with sql template tag
const user = await sql`
  SELECT * FROM users WHERE device_id = ${deviceId}
`.then(rows => rows[0]);

// BAD - SQL injection vulnerability
const query = `SELECT * FROM users WHERE device_id = '${deviceId}'`;
```

### Safe updates

```typescript
// Parameterized UPDATE
await sql`
  UPDATE users
  SET is_pro = ${isPro}, updated_at = NOW()
  WHERE device_id = ${deviceId}
`;
```

---

## Error Handling

### Don't leak sensitive info in errors

```typescript
// BAD - Exposes internal details
catch (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}

// GOOD - Generic error, log details
catch (error) {
  console.error('[API] Operation failed:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

---

## Logging Best Practices

### Use structured logging

```typescript
// Good logging format
console.log('[User API] Created new user:', deviceId);
console.warn('[Rate Limit] Client exceeded limit:', clientId);
console.error('[Telegram Auth] Validation failed:', error);
```

### Log security events

```typescript
// Rate limit violations
console.warn(`[Rate Limit] ${clientId} exceeded ${type} limit on ${pathname}`);

// Authentication failures
console.warn('[User API] Invalid Telegram initData');

// Suspicious activity
console.warn(`[User API] Device ID mismatch: provided=${deviceId}, telegram=${telegramDeviceId}`);
```

---

## Environment Variables

### Required for security features

```env
# Telegram authentication (optional but recommended)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# App URL for callbacks
NEXT_PUBLIC_APP_URL=https://pinglass.app

# Node environment (enables HSTS in production)
NODE_ENV=production
```

### Check if configured

```typescript
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error('[API] TELEGRAM_BOT_TOKEN not configured');
  return NextResponse.json(
    { error: 'Feature not available' },
    { status: 503 }
  );
}
```

---

## Common Patterns

### API route template with security

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitByType, createRateLimitResponse, getClientIdentifier } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimitByType(`operation:${clientId}`, 'DEFAULT');
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    // 2. Parse and validate input
    const body = await request.json();
    if (!body.requiredField) {
      return NextResponse.json(
        { error: 'Missing required field' },
        { status: 400 }
      );
    }

    // 3. Perform operation (with parameterized queries)
    const result = await sql`
      SELECT * FROM table WHERE id = ${body.requiredField}
    `;

    // 4. Return success
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    // 5. Generic error response, detailed logging
    console.error('[API] Operation failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Testing Commands

### Test rate limiting

```bash
# Should succeed 3 times, fail on 4th
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/generate \
    -H "x-device-id: test-device" \
    -H "Content-Type: application/json" \
    -d '{"deviceId":"test-device","avatarId":"1","styleId":"professional","referenceImages":[]}'
  echo ""
done
```

### Test security headers

```bash
curl -I https://pinglass.app
```

### Test Telegram auth (in browser console)

```javascript
fetch('/api/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    telegramInitData: window.Telegram.WebApp.initData
  }),
}).then(r => r.json()).then(console.log);
```

---

## Troubleshooting

### Rate limit not working
- Check middleware matcher configuration
- Verify `getClientIdentifier()` returns consistent value
- Check if route is excluded from rate limiting

### Telegram auth failing
- Verify `TELEGRAM_BOT_TOKEN` is set correctly
- Check `auth_date` is not too old (>24 hours)
- Ensure `initData` is from `window.Telegram.WebApp.initData`

### Security headers missing
- Middleware only runs on matched routes
- Check matcher pattern in `middleware.ts`
- Verify Next.js is using edge runtime

---

## Quick Reference Links

- Rate Limiter: `lib/rate-limiter.ts`
- Telegram Auth: `lib/telegram-auth.ts`
- Middleware: `middleware.ts`
- Full Documentation: `SECURITY.md`
- Implementation Summary: `docs/security-implementation-summary.md`

---

**Last Updated:** 2025-12-11
