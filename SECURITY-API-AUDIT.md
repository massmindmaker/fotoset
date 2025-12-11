# PinGlass API Security Audit Report

**Date:** 2025-12-11
**Project:** PinGlass (Fotoset)
**Auditor:** Security Specialist Agent
**Scope:** All API endpoints in `/app/api/`

---

## Executive Summary

**Total Endpoints Audited:** 19
**Critical Vulnerabilities:** 3
**High-Risk Issues:** 5
**Medium-Risk Issues:** 6
**Low-Risk Issues:** 5

### Severity Distribution

- **Critical (4):** Insecure Direct Object Reference (IDOR), Missing Authorization
- **High (5):** Rate limiting gaps, Input validation issues
- **Medium (6):** Information disclosure, Error handling
- **Low (5):** REST compliance, Missing security headers

---

## API Endpoints Security Matrix

| Endpoint | Methods | Auth | IDOR Protection | Input Validation | Rate Limit | Error Handling | REST | Severity | Score |
|----------|---------|------|-----------------|------------------|------------|----------------|------|----------|-------|
| `/api/user` | POST | Weak | N/A | Medium | None | Good | C | **CRITICAL** | 3/10 |
| `/api/generate` | POST, GET | Medium | None | Good | Yes | Good | B | **HIGH** | 6/10 |
| `/api/avatars` | GET, POST | Weak | Partial | Medium | None | Good | B | **HIGH** | 5/10 |
| `/api/avatars/[id]` | GET, PATCH, DELETE | Good | **Good** | Good | None | Good | A | **MEDIUM** | 8/10 |
| `/api/avatars/[id]/references` | GET, DELETE | **None** | **Missing** | Medium | None | Good | B | **CRITICAL** | 2/10 |
| `/api/payment/create` | POST | Weak | N/A | Poor | None | Medium | C | **HIGH** | 4/10 |
| `/api/payment/status` | GET | Weak | N/A | Poor | None | Medium | C | **MEDIUM** | 5/10 |
| `/api/payment/webhook` | POST | Good | N/A | Good | None | Good | A | **LOW** | 9/10 |
| `/api/referral/stats` | GET | Weak | None | Medium | None | Good | B | **MEDIUM** | 6/10 |
| `/api/referral/code` | GET | Weak | N/A | Medium | None | Good | B | **MEDIUM** | 6/10 |
| `/api/referral/apply` | POST | Weak | None | Good | None | Good | B | **MEDIUM** | 7/10 |
| `/api/referral/withdraw` | POST, GET | Weak | None | Medium | None | Good | B | **HIGH** | 5/10 |
| `/api/referral/earnings` | GET | Weak | None | Medium | None | Good | B | **MEDIUM** | 6/10 |
| `/api/telegram/auth` | POST | Good | N/A | Good | None | Good | A | **LOW** | 9/10 |
| `/api/telegram/webhook` | POST | N/A | N/A | N/A | None | N/A | N/A | **N/A** | N/A |
| `/api/telegram/webapp-send` | POST | N/A | N/A | N/A | None | N/A | N/A | **N/A** | N/A |
| `/api/telegram/send-photos` | POST | N/A | N/A | N/A | None | N/A | N/A | **N/A** | N/A |
| `/api/jobs/[id]` | GET | **None** | **Missing** | Medium | None | Good | B | **CRITICAL** | 3/10 |
| `/api/test-models` | * | **None** | N/A | N/A | None | N/A | N/A | **INFO** | N/A |

**Legend:**
- **Auth:** None, Weak (deviceId only), Medium (deviceId + validation), Good (cryptographic)
- **IDOR Protection:** None, Partial, Good, N/A
- **Grades:** A (9-10), B (7-8), C (5-6), D (3-4), F (0-2)

---

## Critical Vulnerabilities

### 1. IDOR in `/api/avatars/[id]/references` (CRITICAL)

**File:** `app/api/avatars/[id]/references/route.ts`

**Issue:**
- GET and DELETE methods have **NO authorization checks**
- Any user can access/delete reference photos of any avatar by ID enumeration
- Only checks if avatar exists, not ownership

**Vulnerable Code:**
```typescript
// Lines 19-26: GET method - NO ownership verification
const avatarResult = await query(
  "SELECT id, user_id FROM avatars WHERE id = $1",
  [avatarId]
)
// Returns data without checking user_id matches deviceId

// Lines 58-70: DELETE method - NO authorization at all
const result = await query(
  "DELETE FROM reference_photos WHERE avatar_id = $1 RETURNING id",
  [avatarId]
)
```

**Attack Scenario:**
```bash
# Attacker iterates through avatar IDs
curl "https://pinglass.com/api/avatars/1/references"
curl "https://pinglass.com/api/avatars/2/references"
# ... exposes all users' uploaded photos

# Delete victim's reference photos
curl -X DELETE "https://pinglass.com/api/avatars/123/references"
```

**Impact:**
- **Privacy Breach:** Exposure of all users' uploaded personal photos
- **Data Loss:** Malicious deletion of reference photos
- **GDPR Violation:** Unauthorized access to personal data

**Recommendation:**
```typescript
// Add ownership verification like in /api/avatars/[id]/route.ts
const deviceId = request.headers.get("x-device-id") ||
                 request.nextUrl.searchParams.get("device_id")

if (!deviceId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

const avatar = await query(
  `SELECT a.id FROM avatars a
   JOIN users u ON u.id = a.user_id
   WHERE a.id = $1 AND u.device_id = $2`,
  [avatarId, deviceId]
)

if (avatar.rows.length === 0) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

---

### 2. IDOR in `/api/jobs/[id]` (CRITICAL)

**File:** `app/api/jobs/[id]/route.ts`

**Issue:**
- **NO authorization checks** - anyone can view job details by ID enumeration
- Exposes generated photo URLs, avatar IDs, prompts
- Leaks information about other users' generations

**Vulnerable Code:**
```typescript
// Lines 9-39: NO authentication
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const jobId = parseInt(id, 10)

  // Direct query without ownership check
  const jobResult = await query(
    `SELECT * FROM generation_jobs j WHERE j.id = $1`,
    [jobId]
  )

  // Returns data for ANY job
  return NextResponse.json({ ... })
}
```

**Attack Scenario:**
```bash
# Enumerate job IDs to access all users' photos
for i in {1..10000}; do
  curl "https://pinglass.com/api/jobs/$i" | jq .photos
done
```

**Impact:**
- **Privacy Breach:** Full access to all generated photos
- **Business Logic Bypass:** Free access to paid content
- **Competitive Intelligence:** Competitors can scrape all AI outputs

**Recommendation:**
```typescript
export async function GET(request: NextRequest, { params }: RouteParams) {
  const deviceId = request.headers.get("x-device-id")
  if (!deviceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const jobResult = await query(
    `SELECT j.* FROM generation_jobs j
     JOIN avatars a ON a.id = j.avatar_id
     JOIN users u ON u.id = a.user_id
     WHERE j.id = $1 AND u.device_id = $2`,
    [jobId, deviceId]
  )

  if (jobResult.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  // ...
}
```

---

### 3. Weak Authentication in `/api/user` (CRITICAL)

**File:** `app/api/user/route.ts`

**Issue:**
- Device ID-based authentication is **trivially bypassable**
- No signature verification for non-Telegram users
- Attacker can impersonate any user by guessing/stealing deviceId

**Vulnerable Code:**
```typescript
// Lines 128-155: deviceId-only authentication
if (!deviceId) {
  return NextResponse.json(
    { error: "Device ID or Telegram authentication required" },
    { status: 400 }
  )
}

// NO verification that deviceId belongs to requester
let user = await sql`
  SELECT * FROM users WHERE device_id = ${deviceId}
`.then((rows) => rows[0])
```

**Attack Scenario:**
```bash
# Steal victim's deviceId from localStorage or network traffic
VICTIM_DEVICE_ID="abc123-def456"

# Impersonate victim
curl -X POST https://pinglass.com/api/user \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\": \"$VICTIM_DEVICE_ID\"}"

# Now attacker has full access to victim's account
```

**Impact:**
- **Account Takeover:** Full access to any user account
- **Payment Fraud:** Attacker can use victim's Pro status
- **Privacy Breach:** Access to all victim's avatars and photos

**Recommendation:**
1. Implement session tokens with server-side verification
2. Add CSRF protection
3. Use cryptographic proof of device ownership
4. Consider OAuth 2.0 / JWT tokens

```typescript
// Generate secure session token
import { randomBytes } from 'crypto'

const sessionToken = randomBytes(32).toString('hex')
await sql`
  INSERT INTO sessions (user_id, token, expires_at)
  VALUES (${user.id}, ${sessionToken}, NOW() + INTERVAL '30 days')
`

// Return token to client (store in httpOnly cookie)
return NextResponse.json(
  { userId: user.id },
  {
    headers: {
      'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
    }
  }
)
```

---

## High-Risk Vulnerabilities

### 4. Missing Rate Limiting on Critical Endpoints (HIGH)

**Affected Endpoints:**
- `/api/payment/create` - Payment spam/DDoS
- `/api/avatars` (POST) - Resource exhaustion
- `/api/referral/apply` - Referral fraud
- `/api/referral/withdraw` - Withdrawal request spam
- `/api/user` (POST) - Account creation spam

**Issue:**
- Only `/api/generate` has rate limiting (3/hour)
- All other endpoints can be abused for:
  - DDoS attacks
  - Database pollution
  - Referral fraud
  - Payment system abuse

**Current Implementation:**
```typescript
// Only in /api/generate/route.ts
const RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  keyPrefix: "gen",
}
```

**Attack Scenarios:**

**Payment DDoS:**
```bash
# Create 10,000 pending payments
for i in {1..10000}; do
  curl -X POST https://pinglass.com/api/payment/create \
    -d "{\"deviceId\": \"bot_$i\"}"
done
# Result: T-Bank API overwhelmed, legitimate payments fail
```

**Referral Fraud:**
```bash
# Create fake referrals
for i in {1..1000}; do
  curl -X POST https://pinglass.com/api/referral/apply \
    -d "{\"deviceId\": \"victim_$i\", \"referralCode\": \"ATTACKER_CODE\"}"
done
# Result: Inflate referral count for rewards
```

**Recommendation:**
```typescript
// lib/rate-limiter.ts - Global rate limiting middleware
import { RateLimiter } from '@/lib/rate-limiter'

const rateLimits = {
  '/api/payment/create': { windowMs: 60000, maxRequests: 3 }, // 3/min
  '/api/avatars': { windowMs: 3600000, maxRequests: 10 }, // 10/hour
  '/api/referral/apply': { windowMs: 86400000, maxRequests: 1 }, // 1/day
  '/api/referral/withdraw': { windowMs: 86400000, maxRequests: 3 }, // 3/day
  '/api/user': { windowMs: 3600000, maxRequests: 5 }, // 5/hour
}

// Apply in middleware.ts
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const limit = rateLimits[pathname]

  if (limit) {
    const identifier = getClientIdentifier(request)
    const allowed = await checkRateLimit(identifier, pathname, limit)

    if (!allowed) {
      return new NextResponse('Too Many Requests', { status: 429 })
    }
  }

  return NextResponse.next()
}
```

---

### 5. SQL Injection Risk in Referral Endpoints (HIGH)

**File:** `app/api/referral/stats/route.ts`

**Issue:**
- While using parameterized queries, some dynamic SQL construction exists
- Risk of second-order SQL injection through user-controlled data

**Potentially Vulnerable Code:**
```typescript
// Line 89-98: Complex query with user-controlled data
const referralsResult = await sql`
  SELECT r.id, r.created_at,
         COALESCE(SUM(e.amount), 0) as total_earned
  FROM referrals r
  LEFT JOIN referral_earnings e ON e.referred_id = r.referred_id
  WHERE r.referrer_id = ${userId}  // userId derived from deviceId
  GROUP BY r.id, r.created_at
  ORDER BY r.created_at DESC
  LIMIT 10
`
```

**Attack Scenario:**
```javascript
// Attacker creates deviceId with SQL payload
const maliciousDeviceId = "1'; DROP TABLE users; --"

// If not properly escaped in subsequent queries:
await sql`SELECT * FROM users WHERE device_id = ${maliciousDeviceId}`
// Could lead to SQL injection
```

**Recommendation:**
1. Validate all input formats (deviceId should be UUID/alphanumeric)
2. Use strict TypeScript types
3. Add input sanitization layer

```typescript
// lib/validation.ts
import { z } from 'zod'

export const DeviceIdSchema = z.string()
  .regex(/^[a-zA-Z0-9_-]{10,50}$/, 'Invalid device ID format')

export const ReferralCodeSchema = z.string()
  .regex(/^[A-Z0-9]{6}$/, 'Invalid referral code format')

// In route handler:
const { deviceId } = DeviceIdSchema.parse(body)
```

---

### 6. Payment Amount Manipulation (HIGH)

**File:** `app/api/payment/create/route.ts`

**Issue:**
- Payment amount is **hardcoded** (500 RUB)
- No verification of amount in webhook
- Client-side parameters (tierId, photoCount) are not used for pricing

**Vulnerable Code:**
```typescript
// Line 69-78: Hardcoded amount
const payment = await initPayment(
  500, // amount in rubles - HARDCODED
  orderId,
  "PinGlass Pro - AI Photo Generation",
  successUrl,
  failUrl,
  notificationUrl,
  email,
  paymentMethod,
)
```

**Attack Scenario:**
```bash
# Attacker intercepts payment creation
# Modifies T-Bank request to pay 1 RUB instead of 500 RUB
# If webhook doesn't verify amount, Pro access granted for 1 RUB
```

**Recommendation:**
```typescript
// 1. Define pricing tiers
const PRICING = {
  'pro_month': 500,
  'pro_year': 5000,
  'credit_pack_10': 100,
} as const

// 2. Validate in payment creation
const { tierId } = body
const amount = PRICING[tierId]
if (!amount) {
  return NextResponse.json({ error: "Invalid tier" }, { status: 400 })
}

// 3. Store expected amount in DB
await sql`
  INSERT INTO payments (user_id, tbank_payment_id, amount, expected_amount)
  VALUES (${user.id}, ${paymentId}, 0, ${amount})
`

// 4. Verify in webhook
const payment = await sql`SELECT expected_amount FROM payments WHERE tbank_payment_id = ${paymentId}`
if (notification.Amount !== payment.expected_amount * 100) { // T-Bank uses kopecks
  console.error("Amount mismatch!", { expected: payment.expected_amount, received: notification.Amount / 100 })
  return NextResponse.json({ error: "Amount mismatch" }, { status: 400 })
}
```

---

### 7. Referral Code Enumeration (HIGH)

**File:** `app/api/referral/apply/route.ts`

**Issue:**
- Response differs for valid vs invalid codes
- Attacker can enumerate all valid referral codes
- No rate limiting on code attempts

**Vulnerable Code:**
```typescript
// Lines 49-54: Information disclosure
if (codeResult.rows.length === 0) {
  return NextResponse.json(
    { error: "Invalid referral code", code: "INVALID_CODE" },
    { status: 400 }
  )
}

if (!codeResult.rows[0].is_active) {
  return NextResponse.json(
    { error: "Referral code is inactive", code: "INACTIVE_CODE" },
    { status: 400 }
  )
}
```

**Attack Scenario:**
```python
# Brute force 6-character codes (32^6 = 1 billion combinations)
# But with smart patterns, much less
import itertools

chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
for code in itertools.product(chars, repeat=6):
    test_code = ''.join(code)
    resp = requests.post("https://pinglass.com/api/referral/apply",
                         json={"deviceId": "attacker", "referralCode": test_code})
    if resp.json().get("code") != "INVALID_CODE":
        print(f"Valid code found: {test_code}")
```

**Recommendation:**
1. Add rate limiting (max 5 attempts per hour)
2. Use generic error messages
3. Add CAPTCHA after 3 failed attempts

```typescript
// Unified error response
if (codeResult.rows.length === 0 || !codeResult.rows[0].is_active) {
  // Log for monitoring
  await logFailedReferralAttempt(deviceId, code)

  // Generic response
  return NextResponse.json(
    { error: "Unable to apply referral code" },
    { status: 400 }
  )
}

// Rate limiting
const attempts = await getFailedAttempts(deviceId, Date.now() - 3600000)
if (attempts > 5) {
  return NextResponse.json(
    { error: "Too many attempts. Please try again later." },
    { status: 429 }
  )
}
```

---

### 8. Missing Input Validation (HIGH)

**File:** `app/api/payment/create/route.ts`

**Issue:**
- Email, referralCode not validated
- OrderId format not strictly validated
- No sanitization of user inputs

**Vulnerable Code:**
```typescript
// Lines 7-14: No validation
const { deviceId, email, paymentMethod, tierId, photoCount, referralCode } = await request.json()

if (!deviceId) {
  return NextResponse.json({ error: "Device ID required" }, { status: 400 })
}
// email, referralCode used without validation
```

**Attack Scenario:**
```bash
# XSS via email field (if displayed in admin panel)
curl -X POST /api/payment/create \
  -d '{"deviceId":"test","email":"<script>alert(1)</script>@evil.com"}'

# Invalid referralCode causes silent failure
curl -X POST /api/payment/create \
  -d '{"deviceId":"test","referralCode":"<script>alert(1)</script>"}'
```

**Recommendation:**
```typescript
import { z } from 'zod'

const PaymentRequestSchema = z.object({
  deviceId: z.string().regex(/^[a-zA-Z0-9_-]{10,50}$/),
  email: z.string().email().max(255).optional(),
  paymentMethod: z.enum(['card', 'sbp', 'googlepay', 'applepay']).optional(),
  tierId: z.enum(['pro_month', 'pro_year']).optional(),
  photoCount: z.number().int().min(1).max(100).optional(),
  referralCode: z.string().regex(/^[A-Z0-9]{6}$/).optional(),
})

// In handler:
const validation = PaymentRequestSchema.safeParse(await request.json())
if (!validation.success) {
  return NextResponse.json(
    { error: "Validation failed", details: validation.error.issues },
    { status: 400 }
  )
}

const body = validation.data
```

---

## Medium-Risk Issues

### 9. Information Disclosure in Error Messages (MEDIUM)

**Affected Files:** Multiple endpoints

**Issue:**
- Stack traces exposed in development
- Database error details leaked
- Internal paths revealed

**Example:**
```typescript
// app/api/generate/route.ts:399
catch (err) {
  const errorMessage = err instanceof Error ? err.message : "Unknown error"
  logger.error("Generation request failed", { error: errorMessage })

  return error("GENERATION_FAILED", "Generation failed to start", {
    message: errorMessage,  // Exposes internal error
  })
}
```

**Recommendation:**
```typescript
catch (err) {
  const errorId = generateErrorId()
  logger.error("Generation failed", { errorId, error: err })

  return error(
    "GENERATION_FAILED",
    "Unable to start generation. Please try again.",
    process.env.NODE_ENV === 'development' ? { errorId, debug: err.message } : { errorId }
  )
}
```

---

### 10. Missing CORS Configuration (MEDIUM)

**Issue:**
- No explicit CORS headers set
- Relies on Next.js defaults
- Could allow unauthorized cross-origin requests

**Recommendation:**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const origin = request.headers.get('origin')
  const allowedOrigins = [
    'https://pinglass.com',
    'https://t.me',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
  ].filter(Boolean)

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-device-id')
    response.headers.set('Access-Control-Max-Age', '86400')
  }

  return response
}
```

---

### 11. Insecure Random Code Generation (MEDIUM)

**File:** `app/api/referral/code/route.ts`

**Issue:**
- Uses `Math.random()` for referral code generation
- Not cryptographically secure
- Predictable if seed is known

**Vulnerable Code:**
```typescript
// Lines 5-12
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]  // INSECURE
  }
  return code
}
```

**Recommendation:**
```typescript
import { randomInt } from 'crypto'

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[randomInt(0, chars.length)]  // Cryptographically secure
  }
  return code
}
```

---

### 12. Missing Transaction Handling (MEDIUM)

**File:** `app/api/payment/webhook/route.ts`

**Issue:**
- No database transactions for multi-step operations
- Race conditions possible
- Partial updates on failure

**Vulnerable Code:**
```typescript
// Lines 75-135: Multiple DB operations without transaction
await query("INSERT INTO referral_earnings ...")
await query("UPDATE referral_balances ...")
// If second query fails, earning recorded but balance not updated
```

**Recommendation:**
```typescript
import { sql } from '@/lib/db'

async function processReferralEarning(userId: number, paymentId: string) {
  // Use transaction
  return await sql.begin(async sql => {
    // Check if already processed
    const existing = await sql`SELECT id FROM referral_earnings WHERE payment_id = ${paymentId}`
    if (existing.length > 0) return

    // Get referral info
    const referral = await sql`SELECT referrer_id FROM referrals WHERE referred_id = ${userId}`
    if (referral.length === 0) return

    const referrerId = referral[0].referrer_id

    // Calculate earning
    const payment = await sql`SELECT amount FROM payments WHERE yookassa_payment_id = ${paymentId}`
    const earningAmount = Math.round(Number(payment[0].amount) * 0.10 * 100) / 100

    // Record earning
    await sql`INSERT INTO referral_earnings (referrer_id, referred_id, payment_id, amount)
              VALUES (${referrerId}, ${userId}, ${paymentId}, ${earningAmount})`

    // Update balance
    await sql`INSERT INTO referral_balances (user_id, balance, total_earned)
              VALUES (${referrerId}, ${earningAmount}, ${earningAmount})
              ON CONFLICT (user_id) DO UPDATE SET
                balance = referral_balances.balance + ${earningAmount},
                total_earned = referral_balances.total_earned + ${earningAmount}`
  })
}
```

---

### 13. Insufficient Logging (MEDIUM)

**Issue:**
- Security events not logged consistently
- No audit trail for sensitive operations
- Missing correlation IDs

**Recommendation:**
```typescript
// lib/security-logger.ts
export function logSecurityEvent(event: {
  type: 'AUTH_FAILURE' | 'IDOR_ATTEMPT' | 'RATE_LIMIT' | 'PAYMENT_FRAUD'
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  userId?: number
  deviceId?: string
  ip: string
  endpoint: string
  details: any
}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    correlationId: generateCorrelationId(),
    ...event
  }

  console.log(JSON.stringify(logEntry))

  // Send to SIEM/monitoring
  if (event.severity === 'CRITICAL') {
    alertSecurityTeam(logEntry)
  }
}

// Usage in endpoints:
if (!authorized) {
  logSecurityEvent({
    type: 'IDOR_ATTEMPT',
    severity: 'CRITICAL',
    deviceId,
    ip: request.headers.get('x-forwarded-for'),
    endpoint: request.url,
    details: { avatarId, attemptedAction: 'GET' }
  })
  return error("FORBIDDEN", "Access denied")
}
```

---

### 14. No Request ID Tracking (MEDIUM)

**Issue:**
- Cannot trace requests across microservices
- Difficult to debug issues
- No correlation between frontend and backend logs

**Recommendation:**
```typescript
// middleware.ts
import { v4 as uuidv4 } from 'uuid'

export function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || uuidv4()

  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)

  // Attach to logger context
  global.requestId = requestId

  return response
}

// In api-utils.ts logger:
export const createLogger = (namespace: string) => ({
  info: (msg: string, data?: any) =>
    console.log(JSON.stringify({
      level: 'INFO',
      namespace,
      requestId: global.requestId,
      message: msg,
      ...data
    }))
})
```

---

## Low-Risk Issues

### 15. Missing Security Headers (LOW)

**Issue:**
- No Content-Security-Policy
- No X-Frame-Options
- No X-Content-Type-Options

**Recommendation:**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  // CSP for API
  if (request.nextUrl.pathname.startsWith('/api')) {
    response.headers.set('Content-Security-Policy', "default-src 'none'")
  }

  return response
}
```

---

### 16. Inconsistent REST Patterns (LOW)

**Issue:**
- Inconsistent response formats
- Mixed use of query params vs headers for auth
- Some endpoints don't follow REST conventions

**Example:**
```typescript
// Inconsistent auth parameter location:
// /api/avatars?device_id=xxx (query)
// /api/avatars/[id] x-device-id header OR query
// /api/user deviceId in body
```

**Recommendation:**
- Standardize on header-based auth: `x-device-id`
- Consistent response envelope:
```typescript
{
  success: boolean
  data?: any
  error?: { code: string, message: string }
  meta?: { requestId: string, timestamp: string }
}
```

---

### 17. Missing API Versioning (LOW)

**Issue:**
- No API versioning strategy
- Breaking changes will affect all clients

**Recommendation:**
```typescript
// app/api/v1/...
// app/api/v2/...

// Or header-based:
const apiVersion = request.headers.get('x-api-version') || '1'
```

---

### 18. No Request Size Limits (LOW)

**Issue:**
- No payload size limits
- Potential for DoS via large requests

**Recommendation:**
```typescript
// next.config.js
export default {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

// Or in middleware:
const contentLength = parseInt(request.headers.get('content-length') || '0')
if (contentLength > 10 * 1024 * 1024) { // 10MB
  return new NextResponse('Payload too large', { status: 413 })
}
```

---

### 19. No Health Check Endpoint (LOW)

**Issue:**
- No way to monitor API health
- Cannot detect database connection issues

**Recommendation:**
```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: false,
    redis: false,
    tbank: false,
  }

  try {
    await sql`SELECT 1`
    checks.database = true
  } catch {}

  const allHealthy = Object.values(checks).every(Boolean)

  return NextResponse.json(
    { status: allHealthy ? 'healthy' : 'degraded', checks },
    { status: allHealthy ? 200 : 503 }
  )
}
```

---

## OWASP Top 10 Compliance

| OWASP Category | Status | Findings |
|----------------|--------|----------|
| **A01:2021 - Broken Access Control** | FAIL | IDOR in 3 endpoints, missing authorization checks |
| **A02:2021 - Cryptographic Failures** | PARTIAL | Weak device ID auth, insecure random for codes |
| **A03:2021 - Injection** | PASS | Parameterized queries used, but needs validation |
| **A04:2021 - Insecure Design** | FAIL | No rate limiting, weak session management |
| **A05:2021 - Security Misconfiguration** | PARTIAL | Missing security headers, no health checks |
| **A06:2021 - Vulnerable Components** | N/A | Not assessed (dependency audit needed) |
| **A07:2021 - Identity/Auth Failures** | FAIL | Device ID easily spoofed, no MFA |
| **A08:2021 - Data Integrity Failures** | PARTIAL | No webhook signature verification for some endpoints |
| **A09:2021 - Logging/Monitoring Failures** | FAIL | Insufficient security logging, no alerting |
| **A10:2021 - Server-Side Request Forgery** | PASS | No user-controlled URL requests found |

**Overall OWASP Compliance Score: 3/10 (FAIL)**

---

## Prioritized Remediation Plan

### Phase 1 - Critical (Immediate - Week 1)

1. **Fix IDOR vulnerabilities**
   - Add ownership verification to `/api/avatars/[id]/references`
   - Add ownership verification to `/api/jobs/[id]`
   - Implement middleware helper for IDOR protection

2. **Implement proper authentication**
   - Replace device ID with session tokens
   - Add JWT-based auth for API
   - Implement CSRF protection

3. **Add rate limiting**
   - Implement global rate limiter middleware
   - Apply to all write operations
   - Add exponential backoff

**Estimated Effort:** 40 hours

---

### Phase 2 - High (Week 2-3)

4. **Input validation framework**
   - Install Zod for schema validation
   - Create validation schemas for all endpoints
   - Add sanitization layer

5. **Payment security**
   - Verify payment amounts in webhook
   - Add transaction logging
   - Implement fraud detection

6. **Referral security**
   - Generic error messages
   - Rate limit code attempts
   - Add CAPTCHA

**Estimated Effort:** 32 hours

---

### Phase 3 - Medium (Week 4)

7. **Logging and monitoring**
   - Implement security event logging
   - Add request correlation IDs
   - Set up alerting for suspicious activity

8. **Database security**
   - Add transaction support
   - Implement row-level security
   - Database connection pooling

**Estimated Effort:** 24 hours

---

### Phase 4 - Low (Week 5)

9. **Security hardening**
   - Add security headers
   - Implement health checks
   - API versioning
   - Request size limits

10. **Compliance**
    - GDPR audit trail
    - Data retention policies
    - Security documentation

**Estimated Effort:** 16 hours

---

## Security Testing Recommendations

### 1. Penetration Testing Checklist

- [ ] IDOR testing (enumerate all ID-based endpoints)
- [ ] Authentication bypass attempts
- [ ] SQL injection (second-order)
- [ ] XSS in all input fields
- [ ] CSRF testing
- [ ] Rate limit bypass
- [ ] Payment manipulation
- [ ] Referral fraud
- [ ] Business logic flaws

### 2. Automated Security Scanning

```bash
# Install tools
npm install --save-dev eslint-plugin-security
npm install --save-dev @types/node

# Run SAST
npm run lint:security

# Dependency audit
npm audit --audit-level=moderate

# Run OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://pinglass.com/api \
  -r zap-report.html
```

### 3. Manual Testing Scripts

```bash
# Test IDOR
./scripts/test-idor.sh

# Test rate limiting
./scripts/test-rate-limit.sh

# Test payment flow
./scripts/test-payment-security.sh
```

---

## Code Examples: Secure Implementations

### Secure IDOR Protection Middleware

```typescript
// lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function requireOwnership(
  request: NextRequest,
  resourceType: 'avatar' | 'job' | 'payment',
  resourceId: number
): Promise<{ authorized: boolean; userId?: number }> {
  const deviceId = request.headers.get('x-device-id')

  if (!deviceId) {
    return { authorized: false }
  }

  let query: any

  switch (resourceType) {
    case 'avatar':
      query = await sql`
        SELECT u.id as user_id FROM avatars a
        JOIN users u ON u.id = a.user_id
        WHERE a.id = ${resourceId} AND u.device_id = ${deviceId}
      `
      break
    case 'job':
      query = await sql`
        SELECT u.id as user_id FROM generation_jobs j
        JOIN avatars a ON a.id = j.avatar_id
        JOIN users u ON u.id = a.user_id
        WHERE j.id = ${resourceId} AND u.device_id = ${deviceId}
      `
      break
    case 'payment':
      query = await sql`
        SELECT u.id as user_id FROM payments p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = ${resourceId} AND u.device_id = ${deviceId}
      `
      break
  }

  if (query.length === 0) {
    logSecurityEvent({
      type: 'IDOR_ATTEMPT',
      severity: 'CRITICAL',
      deviceId,
      endpoint: request.url,
      details: { resourceType, resourceId }
    })
    return { authorized: false }
  }

  return { authorized: true, userId: query[0].user_id }
}

// Usage:
export async function GET(request: NextRequest, { params }: RouteParams) {
  const avatarId = parseInt((await params).id)

  const auth = await requireOwnership(request, 'avatar', avatarId)
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Proceed with authorized request
  // ...
}
```

---

### Secure Session Management

```typescript
// lib/session.ts
import { randomBytes } from 'crypto'
import { sql } from '@/lib/db'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function createSession(userId: number, deviceId: string) {
  const sessionId = randomBytes(32).toString('hex')

  // Store session in DB
  await sql`
    INSERT INTO sessions (id, user_id, device_id, expires_at)
    VALUES (${sessionId}, ${userId}, ${deviceId}, NOW() + INTERVAL '30 days')
  `

  // Generate JWT
  const token = await new SignJWT({ userId, sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET)

  return { sessionId, token }
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

    // Check if session still valid in DB
    const session = await sql`
      SELECT s.*, u.device_id FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ${payload.sessionId}
        AND s.expires_at > NOW()
        AND s.revoked_at IS NULL
    `.then(rows => rows[0])

    if (!session) {
      return null
    }

    // Update last activity
    await sql`
      UPDATE sessions SET last_activity = NOW()
      WHERE id = ${payload.sessionId}
    `

    return {
      userId: payload.userId as number,
      sessionId: payload.sessionId as string,
      deviceId: session.device_id
    }
  } catch {
    return null
  }
}

export async function revokeSession(sessionId: string) {
  await sql`
    UPDATE sessions SET revoked_at = NOW()
    WHERE id = ${sessionId}
  `
}
```

---

## Monitoring & Alerting

### Security Metrics to Track

1. **Failed authentication attempts per hour**
   - Alert if > 100/hour from single IP
   - Alert if > 1000/hour globally

2. **IDOR attempt rate**
   - Alert on any 403 responses with correlation to resources

3. **Rate limit hits**
   - Alert if > 50% of requests are rate-limited

4. **Payment anomalies**
   - Alert on amount mismatches
   - Alert on multiple failed payments from same user

5. **Referral fraud indicators**
   - Alert on > 10 referrals in 1 hour
   - Alert on circular referral patterns

### Monitoring Setup

```typescript
// lib/metrics.ts
import { Counter, Histogram, Registry } from 'prom-client'

const register = new Registry()

export const securityMetrics = {
  authFailures: new Counter({
    name: 'auth_failures_total',
    help: 'Total authentication failures',
    labelNames: ['endpoint', 'reason'],
    registers: [register]
  }),

  idorAttempts: new Counter({
    name: 'idor_attempts_total',
    help: 'Total IDOR attempts',
    labelNames: ['resource_type'],
    registers: [register]
  }),

  rateLimitHits: new Counter({
    name: 'rate_limit_hits_total',
    help: 'Total rate limit hits',
    labelNames: ['endpoint'],
    registers: [register]
  }),

  requestDuration: new Histogram({
    name: 'api_request_duration_seconds',
    help: 'API request duration',
    labelNames: ['endpoint', 'method', 'status'],
    registers: [register]
  })
}

// Expose metrics endpoint
// app/api/metrics/route.ts
export async function GET() {
  return new Response(await register.metrics(), {
    headers: { 'Content-Type': register.contentType }
  })
}
```

---

## Compliance Requirements

### GDPR Compliance Checklist

- [ ] **Right to Access**: Implement `/api/user/data-export`
- [ ] **Right to Erasure**: Implement `/api/user/delete-account`
- [ ] **Right to Portability**: Export in JSON format
- [ ] **Consent Management**: Log user consent for data processing
- [ ] **Data Breach Notification**: 72-hour notification process
- [ ] **Privacy by Design**: Minimize data collection
- [ ] **DPA with Processors**: T-Bank, Google Imagen contracts

### PCI-DSS Compliance (for payments)

- [ ] **Never store CVV/CVD**
- [ ] **Never store full PAN** (use T-Bank tokens)
- [ ] **Encrypt cardholder data at rest**
- [ ] **Use strong cryptography** (TLS 1.2+)
- [ ] **Restrict access** to cardholder data
- [ ] **Log all access** to cardholder data
- [ ] **Quarterly security scans**

---

## Conclusion

**Overall Security Posture: HIGH RISK**

The PinGlass API has **3 critical vulnerabilities** that require immediate remediation:

1. **IDOR in reference photos** - Exposes all user uploads
2. **IDOR in generation jobs** - Leaks all AI-generated content
3. **Weak authentication** - Account takeover via device ID spoofing

**Immediate Actions Required:**
1. Take affected endpoints offline or add auth checks (within 24 hours)
2. Implement session-based authentication (within 1 week)
3. Add rate limiting to prevent abuse (within 1 week)
4. Conduct full penetration test (within 2 weeks)

**Estimated Total Remediation Effort:** 112 hours (14 days)

**Recommended Timeline:**
- Week 1: Fix critical IDOR issues, implement auth
- Week 2-3: Add rate limiting, input validation, payment security
- Week 4: Logging, monitoring, database security
- Week 5: Hardening, compliance, documentation

---

## References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [GDPR Official Text](https://gdpr-info.eu/)
- [PCI-DSS v4.0](https://www.pcisecuritystandards.org/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security)

---

**Report Generated:** 2025-12-11
**Auditor:** Security Specialist Agent
**Contact:** security@pinglass.com (if applicable)
