# T-Bank Payment Integration Guide

**Version:** 1.0
**Last Updated:** 2025-12-11
**Application:** PinGlass (Fotoset)

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Configuration](#environment-configuration)
3. [Operating Modes](#operating-modes)
4. [Security Implementation](#security-implementation)
5. [Common Errors and Solutions](#common-errors-and-solutions)
6. [Payment Flow Architecture](#payment-flow-architecture)
7. [Testing Guide](#testing-guide)
8. [Production Deployment Checklist](#production-deployment-checklist)

---

## Overview

PinGlass uses T-Bank (formerly Tinkoff) payment gateway for processing payments. The integration supports three operational modes:

- **Demo Mode** - No credentials required, simulates payments locally
- **Test Mode** - Uses T-Bank test credentials, interacts with sandbox API
- **Production Mode** - Live payments with real credentials

### Key Features

- Webhook-based payment confirmation
- Signature verification for security
- Automatic fallback to demo mode on API failures
- Support for multiple payment methods (card, SBP, T-Pay)
- ФЗ-54 compliant receipt generation
- Referral system integration

---

## Environment Configuration

### Required Environment Variables

```bash
# T-Bank Payment Credentials
TBANK_TERMINAL_KEY=your_terminal_key_here
TBANK_PASSWORD=your_password_here

# App URL (critical for callbacks)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Database (required for production)
DATABASE_URL=postgresql://...
```

### Terminal Key Format

#### Production Terminal Key
```
TinkoffBankTest  # Standard format
MyCompany_Prod   # Custom format
```

#### Test Terminal Key (contains "DEMO" or "Test")
```
TinkoffBankTestDEMO
TestTerminal1234567890
MyCompany_DEMO
```

**IMPORTANT:** The system automatically detects test mode when the terminal key contains:
- `DEMO` (case-insensitive)
- `Test` (case-insensitive)

#### Demo Mode (No Credentials)
When `TBANK_TERMINAL_KEY` or `TBANK_PASSWORD` is empty/missing, the system runs in demo mode with local simulation.

### Configuration Validation

```typescript
// File: lib/tbank.ts (lines 8-19)

// Test mode detection
export const IS_TEST_MODE =
  process.env.TBANK_TEST_MODE === "true" ||
  TBANK_TERMINAL_KEY.includes("DEMO") ||
  TBANK_TERMINAL_KEY.toLowerCase().includes("test")

// Demo mode detection
export const IS_DEMO_MODE = !TBANK_TERMINAL_KEY || !TBANK_PASSWORD
```

### Checking Current Mode

The system logs the current mode on startup:

```
[T-Bank] Mode: DEMO        # No credentials set
[T-Bank] Mode: TEST        # Test credentials detected
[T-Bank] Mode: PRODUCTION  # Live credentials
```

---

## Operating Modes

### 1. Demo Mode

**When:** `TBANK_TERMINAL_KEY` or `TBANK_PASSWORD` is empty

**Behavior:**
- No external API calls
- Creates local payment IDs: `demo_{timestamp}_{random}`
- Redirects to `/payment/demo` page
- Manual confirmation via button click
- All transactions succeed instantly

**Files:**
- `lib/tbank.ts` (lines 14, 98-101)
- `app/api/payment/create/route.ts` (lines 41-59, 96-103)

**Use Cases:**
- Local development without credentials
- UI/UX testing
- Demo presentations

### 2. Test Mode

**When:** Terminal key contains "DEMO" or "Test", or `TBANK_TEST_MODE=true`

**Behavior:**
- Uses T-Bank sandbox API
- Creates test payment IDs: `test_{timestamp}_{random}`
- Webhook signature validation skipped
- Redirects to actual T-Bank test payment page
- Test cards work (see Testing Guide)

**Files:**
- `lib/tbank.ts` (lines 9-11, 98-101, 195-203, 233-235)
- `app/api/payment/status/route.ts` (lines 59-68)

**Use Cases:**
- Integration testing
- Staging environment
- Pre-production verification

### 3. Production Mode

**When:** Valid production credentials set, no "DEMO"/"Test" in terminal key

**Behavior:**
- Full T-Bank API integration
- Real payment processing
- Strict webhook signature verification
- Receipt generation (ФЗ-54)
- All security checks enabled

**Files:**
- All payment routes when `IS_TEST_MODE = false` and `IS_DEMO_MODE = false`

**Use Cases:**
- Live production environment
- Real customer payments

---

## Security Implementation

### 1. Token Generation (Request Signing)

**Algorithm:** SHA-256 hash of concatenated sorted parameters + password

```typescript
// File: lib/tbank.ts (lines 52-66)

function generateToken(params: Record<string, string | number>): string {
  // 1. Add password to params
  const values = {
    ...params,
    Password: TBANK_PASSWORD || "test_password",
  }

  // 2. Sort keys alphabetically
  const sortedKeys = Object.keys(values).sort()

  // 3. Concatenate values (WITHOUT keys)
  const concatenated = sortedKeys.map((key) => values[key]).join("")

  // 4. Generate SHA-256 hash
  return crypto.createHash("sha256").update(concatenated).digest("hex")
}
```

**Example:**

```javascript
// Input params
{
  TerminalKey: "MyTerminal",
  Amount: 50000,
  OrderId: "order_123_1234567890",
  Description: "Test payment"
}

// Step 1: Add password
{
  TerminalKey: "MyTerminal",
  Amount: 50000,
  OrderId: "order_123_1234567890",
  Description: "Test payment",
  Password: "mySecretPassword"
}

// Step 2: Sort keys
["Amount", "Description", "OrderId", "Password", "TerminalKey"]

// Step 3: Concatenate values
"50000Test paymentorder_123_1234567890mySecretPasswordMyTerminal"

// Step 4: SHA-256
"a3f8c1b2e..." // Final token
```

### 2. Webhook Signature Verification

**Purpose:** Verify that webhook notifications actually come from T-Bank

```typescript
// File: lib/tbank.ts (lines 232-249)

export function verifyWebhookSignature(
  notification: Record<string, unknown>,
  receivedToken: string
): boolean {
  if (IS_TEST_MODE) {
    return true // Skip verification in test mode
  }

  // 1. Extract all params except Token
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(notification)) {
    if (key !== "Token" && value !== null && value !== undefined) {
      params[key] = String(value)
    }
  }

  // 2. Calculate expected token
  const calculatedToken = generateToken(params)

  // 3. Compare with received token
  return calculatedToken === receivedToken
}
```

**Usage in Webhook Handler:**

```typescript
// File: app/api/payment/webhook/route.ts (lines 12-19)

const notification = await request.json()
const receivedToken = notification.Token || ""
const isValid = verifyWebhookSignature(notification, receivedToken)

if (!isValid) {
  console.error("Invalid webhook signature")
  return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
}
```

### 3. Security Best Practices Implemented

#### Credential Protection
- Environment variables only (never hardcoded)
- No credentials in client-side code
- Password excluded from logs

#### Request Security
- HTTPS required for production webhooks
- Signature verification on all webhooks
- Token generation for all API requests

#### Input Validation
```typescript
// File: app/api/payment/create/route.ts (lines 16-18)

if (!deviceId) {
  return NextResponse.json({ error: "Device ID required" }, { status: 400 })
}
```

#### Error Handling
```typescript
// File: lib/tbank.ts (lines 182-191)

if (!data.Success) {
  console.error("T-Bank payment init error:", data.Message, data.ErrorCode)
  throw new Error(`T-Bank payment creation failed: ${data.Message || data.ErrorCode}`)
}
```

#### Sensitive Data Exclusion from Token
```typescript
// File: lib/tbank.ts (lines 146-147)

// Token is generated WITHOUT Receipt and DATA objects
const token = generateToken(params)

// Receipt and DATA are added AFTER token generation
requestBody.Receipt = receipt
requestBody.DATA = { Email: customerEmail }
```

### 4. What NOT to Include in Token

According to T-Bank API documentation, exclude these from token calculation:

- `Receipt` - Complex object with items
- `DATA` - Additional data fields
- `Token` itself
- Any null/undefined values

**Example:**

```typescript
// CORRECT: Basic params only
const params = {
  TerminalKey: "...",
  Amount: 50000,
  OrderId: "...",
  Description: "...",
  PayType: "O"
}
const token = generateToken(params)

// Add complex objects AFTER token generation
requestBody.Token = token
requestBody.Receipt = { /* complex object */ }
requestBody.DATA = { Email: "..." }
```

---

## Common Errors and Solutions

### Error 1: "Неверные параметры" (Invalid Parameters)

**Cause:** Token signature mismatch

**Common Reasons:**
1. Wrong password used
2. Terminal key mismatch
3. Including Receipt/DATA in token calculation
4. Parameter values changed after token generation

**Solution:**
```typescript
// WRONG: Including Receipt in token
const params = { TerminalKey, Amount, OrderId, Receipt }
const token = generateToken(params) // ❌

// CORRECT: Exclude complex objects
const params = { TerminalKey, Amount, OrderId }
const token = generateToken(params) // ✅
requestBody.Receipt = receipt // Add after
```

**Debug Checklist:**
- [ ] Verify `TBANK_PASSWORD` matches merchant dashboard
- [ ] Check `TBANK_TERMINAL_KEY` is correct (no extra spaces)
- [ ] Ensure parameters aren't modified after token generation
- [ ] Confirm you're using production credentials (not test)
- [ ] Check parameter values are correct types (number vs string)

### Error 2: "Терминал не найден" (Terminal Not Found)

**Cause:** Invalid or non-existent terminal key

**Solutions:**
1. Verify terminal key in T-Bank merchant dashboard
2. Ensure no whitespace/special characters
3. Check you're using the correct environment (test vs production)
4. Confirm terminal key is activated

```bash
# Check for whitespace
echo "$TBANK_TERMINAL_KEY" | cat -A

# Should show clean string without trailing spaces
TinkoffBankTest$
```

### Error 3: Webhook Not Received

**Cause:** T-Bank cannot reach your webhook URL

**Common Reasons:**
1. Localhost URL in production
2. HTTPS not configured
3. Firewall blocking T-Bank IPs
4. Incorrect webhook URL in merchant settings

**Solution:**
```bash
# Development: Use ngrok
ngrok http 3000

# Update webhook URL in T-Bank dashboard
https://your-ngrok-url.ngrok.io/api/payment/webhook

# Verify NEXT_PUBLIC_APP_URL
echo $NEXT_PUBLIC_APP_URL
# Should be: https://your-domain.com (NOT http, NOT localhost)
```

**Webhook Testing:**
```bash
# Test webhook endpoint manually
curl -X POST https://your-domain.com/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "TerminalKey": "test",
    "PaymentId": "test_123",
    "Status": "CONFIRMED",
    "Token": "test_token"
  }'

# Expected response
{"success":true}
```

### Error 4: Payment Stuck in "pending"

**Cause:** Webhook not processed or database not updated

**Debug Steps:**

```typescript
// 1. Check webhook logs
// File: app/api/payment/webhook/route.ts
console.log("Webhook received:", notification)

// 2. Verify database update
// File: app/api/payment/webhook/route.ts (lines 27-31)
await sql`
  UPDATE payments
  SET status = 'succeeded', updated_at = NOW()
  WHERE yookassa_payment_id = ${paymentId}
`

// 3. Check payment status endpoint
curl "https://your-domain.com/api/payment/status?device_id=XXX&payment_id=YYY"
```

**Manual Fix (Development Only):**
```sql
-- Update payment status manually
UPDATE payments
SET status = 'succeeded', updated_at = NOW()
WHERE yookassa_payment_id = 'your_payment_id';
```

### Error 5: Test Mode Not Working

**Cause:** Terminal key doesn't contain "DEMO" or "Test"

**Solution:**
```bash
# Option 1: Add to terminal key
TBANK_TERMINAL_KEY=MyTerminalDEMO

# Option 2: Force test mode
TBANK_TEST_MODE=true

# Option 3: Use demo mode (no credentials)
TBANK_TERMINAL_KEY=
TBANK_PASSWORD=
```

**Verification:**
```bash
# Check logs on app start
[T-Bank] Mode: TEST  # Should see this
```

### Error 6: Amount Mismatch

**Cause:** T-Bank expects amount in kopeks (1/100 of ruble)

**Solution:**
```typescript
// WRONG
const amount = 500 // 500 kopeks = 5 rubles ❌

// CORRECT
const amountInRubles = 500
const amountInKopeks = amountInRubles * 100 // 50000 kopeks ✅
```

**File:** `lib/tbank.ts` (line 103)
```typescript
const amountInKopeks = amount * 100
```

### Error 7: Duplicate Payment Prevention

**Symptom:** User clicks "Pay" multiple times, creates duplicate orders

**Solution:**
```typescript
// Add idempotency check
const existingPayment = await sql`
  SELECT * FROM payments
  WHERE user_id = ${userId}
    AND status = 'pending'
    AND created_at > NOW() - INTERVAL '15 minutes'
`

if (existingPayment.length > 0) {
  return NextResponse.json({
    paymentId: existingPayment[0].yookassa_payment_id,
    confirmationUrl: existingPayment[0].confirmation_url,
    message: "Payment already in progress"
  })
}
```

---

## Payment Flow Architecture

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INITIATES PAYMENT                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/payment/create                                        │
│  Body: { deviceId, email?, paymentMethod? }                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                   ┌─────────┴─────────┐
                   │  Mode Detection   │
                   └─────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
     ┌──────────┐     ┌──────────┐    ┌──────────┐
     │   DEMO   │     │   TEST   │    │   PROD   │
     │   MODE   │     │   MODE   │    │   MODE   │
     └─────┬────┘     └─────┬────┘    └─────┬────┘
           │                │               │
           │                │               │
           ▼                ▼               ▼
    ┌───────────┐    ┌───────────┐   ┌───────────┐
    │ Create    │    │ Call      │   │ Call      │
    │ demo_xxx  │    │ T-Bank    │   │ T-Bank    │
    │ payment   │    │ Init API  │   │ Init API  │
    │ locally   │    │ (sandbox) │   │ (live)    │
    └─────┬─────┘    └─────┬─────┘   └─────┬─────┘
          │                │               │
          │                │               │
          ▼                ▼               ▼
    ┌──────────────────────────────────────────┐
    │  Save to Database (payments table)       │
    │  status = 'pending'                      │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────┐
    │  Return Payment URL to Frontend          │
    │  { paymentId, confirmationUrl }          │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────┐
    │  User Redirected to Payment Page         │
    └────────────────┬─────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
    ┌──────────┐          ┌──────────┐
    │ SUCCESS  │          │  CANCEL  │
    └─────┬────┘          └─────┬────┘
          │                     │
          │                     │
          ▼                     ▼
    ┌──────────────────────────────────────────┐
    │  Redirect to /payment/callback           │
    │  Query: ?device_id=XXX&status=success    │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────┐
    │  Frontend Polls /api/payment/status      │
    │  Every 2 seconds until paid=true         │
    └────────────────┬─────────────────────────┘
                     │
                     │
    ┌────────────────┴─────────────────────────┐
    │                                           │
    │  MEANWHILE: T-Bank sends webhook          │
    │  POST /api/payment/webhook                │
    │                                           │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────┐
    │  Verify Webhook Signature                │
    │  verifyWebhookSignature(notification)    │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────┐
    │  Update Database                         │
    │  SET status = 'succeeded'                │
    │  WHERE yookassa_payment_id = paymentId   │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────┐
    │  Process Referral Earning (if applicable)│
    │  Credit 10% to referrer                  │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────┐
    │  Return "OK" to T-Bank                   │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────┐
    │  Frontend Detects paid=true              │
    │  Redirect to Dashboard                   │
    └──────────────────────────────────────────┘
```

### File-by-File Breakdown

#### 1. Payment Creation
**File:** `app/api/payment/create/route.ts`

```typescript
// Lines 5-103: Main payment creation logic

POST /api/payment/create
├─ Validate deviceId (line 16-18)
├─ Get/Create user (lines 20-30)
├─ Apply referral code if provided (lines 32-35)
├─ Determine base URL (line 38)
├─ DEMO MODE (lines 41-60)
│  ├─ Create demo_xxx payment ID
│  ├─ Save to database
│  └─ Return demo URL
├─ Prepare callback URLs (lines 62-64)
├─ Generate unique OrderId (line 67)
├─ Call initPayment() (lines 72-81)
│  └─ Fallback to demo on error (lines 96-103)
├─ Save payment to database (lines 84-87)
└─ Return paymentId + confirmationUrl (lines 91-95)
```

#### 2. Payment Initialization
**File:** `lib/tbank.ts`

```typescript
// Lines 88-192: initPayment function

initPayment()
├─ Check IS_TEST_MODE (lines 98-101)
│  └─ Return mock payment if true
├─ Convert amount to kopeks (line 103)
├─ Create Receipt object (lines 106-122)
├─ Build params object (lines 125-144)
├─ Generate token (line 147)
├─ Build request body (lines 150-165)
├─ Call T-Bank API (lines 170-176)
├─ Parse response (line 178)
├─ Check Success flag (lines 182-185)
└─ Return payment data (line 187)
```

#### 3. Webhook Processing
**File:** `app/api/payment/webhook/route.ts`

```typescript
// Lines 8-57: Webhook handler

POST /api/payment/webhook
├─ Parse notification (line 10)
├─ Verify signature (lines 12-19)
│  └─ Return 403 if invalid
├─ Extract paymentId and status (lines 21-22)
├─ Handle CONFIRMED/AUTHORIZED (lines 25-42)
│  ├─ Update payment status (lines 27-31)
│  ├─ Get payment details (lines 34-37)
│  └─ Process referral earning (line 41)
├─ Handle REJECTED (lines 43-48)
│  └─ Update status to 'canceled'
└─ Return success=true (line 52)
```

#### 4. Status Checking
**File:** `app/api/payment/status/route.ts`

```typescript
// Lines 5-98: Status check handler

GET /api/payment/status
├─ Validate deviceId (lines 12-14)
├─ Get/Create user (lines 22-37)
├─ Handle no paymentId (lines 39-42)
├─ Handle demo mode (lines 44-56)
├─ Handle test mode (lines 59-68)
├─ Check T-Bank API (lines 71-82)
│  └─ Fallback to DB on error (lines 84-92)
└─ Return payment status (lines 79-82, 89-92)
```

---

## Testing Guide

### Local Development Testing

#### 1. Demo Mode (No Credentials Required)

```bash
# .env.local
# Leave these empty or comment out
# TBANK_TERMINAL_KEY=
# TBANK_PASSWORD=

NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...
```

**Test Flow:**
1. Start app: `pnpm dev`
2. Click "Pay 500₽"
3. Redirected to `/payment/demo`
4. Click "Confirm Payment"
5. Status updates to paid=true
6. Redirected to dashboard

**Expected Logs:**
```
[T-Bank] Mode: DEMO
[Payment] Demo mode: created demo payment
```

#### 2. Test Mode (With Test Credentials)

```bash
# .env.local
TBANK_TERMINAL_KEY=TinkoffBankTestDEMO
TBANK_PASSWORD=test_password

NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...
```

**Test Flow:**
1. Start app: `pnpm dev`
2. Click "Pay 500₽"
3. Mock payment created (no redirect)
4. Status immediately shows paid=true

**Expected Logs:**
```
[T-Bank] Mode: TEST
[T-Bank] Test mode: creating mock payment
```

### Webhook Testing

#### Using ngrok (Recommended)

```bash
# 1. Start ngrok
ngrok http 3000

# Output:
# Forwarding https://abc123.ngrok.io -> http://localhost:3000

# 2. Update webhook URL in T-Bank dashboard
https://abc123.ngrok.io/api/payment/webhook

# 3. Test webhook manually
curl -X POST https://abc123.ngrok.io/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "TerminalKey": "TinkoffBankTestDEMO",
    "PaymentId": "test_12345",
    "Status": "CONFIRMED",
    "Amount": 50000,
    "OrderId": "order_1_1234567890",
    "Token": "test_token"
  }'
```

#### Manual Webhook Simulation

```typescript
// File: scripts/test-webhook.ts

import { sql } from "@/lib/db"

async function testWebhook(paymentId: string) {
  await sql`
    UPDATE payments
    SET status = 'succeeded', updated_at = NOW()
    WHERE yookassa_payment_id = ${paymentId}
  `
  console.log("Payment marked as succeeded:", paymentId)
}

testWebhook("test_12345")
```

### Test Cards (T-Bank Sandbox)

When using actual T-Bank test terminal:

| Card Number         | CVV | Expiry | Result         |
|---------------------|-----|--------|----------------|
| 4300000000000777    | 123 | 12/25  | Success        |
| 4111111111111111    | 123 | 12/25  | Success        |
| 5555555555554444    | 123 | 12/25  | Success        |
| 4300000000000000    | 123 | 12/25  | Insufficient funds |
| 4300000000000001    | 123 | 12/25  | Card blocked   |

### Testing Checklist

- [ ] Demo mode payment creation
- [ ] Demo mode manual confirmation
- [ ] Test mode payment creation
- [ ] Test mode automatic confirmation
- [ ] Webhook signature verification
- [ ] Payment status polling
- [ ] Referral earning calculation
- [ ] Error handling (invalid payment ID)
- [ ] Multiple payment prevention
- [ ] Database transaction integrity

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] Obtain production T-Bank credentials
  - [ ] Terminal Key (without "DEMO" or "Test")
  - [ ] Password
  - [ ] Merchant ID
- [ ] Register domain in T-Bank merchant dashboard
- [ ] Configure SSL certificate (HTTPS required)
- [ ] Set up PostgreSQL database
- [ ] Configure environment variables

### Environment Variables

```bash
# Production .env
TBANK_TERMINAL_KEY=YourProductionTerminal  # NO "DEMO"
TBANK_PASSWORD=your_secure_password
NEXT_PUBLIC_APP_URL=https://your-domain.com  # HTTPS only
DATABASE_URL=postgresql://production_db_url
GOOGLE_API_KEY=...
```

### T-Bank Dashboard Configuration

1. Login to T-Bank merchant dashboard
2. Navigate to Settings > API
3. Set webhook URL:
   ```
   https://your-domain.com/api/payment/webhook
   ```
4. Enable webhook events:
   - ✅ Payment Confirmed
   - ✅ Payment Authorized
   - ✅ Payment Rejected
5. Save and test webhook

### Security Hardening

- [ ] Enable HTTPS only (no HTTP)
- [ ] Set secure CORS headers
- [ ] Implement rate limiting
- [ ] Add request logging (without sensitive data)
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure database backups

### Post-Deployment Testing

1. Create real test payment (small amount)
2. Complete payment flow
3. Verify webhook received
4. Check database updated
5. Confirm referral earning calculated
6. Test payment cancellation
7. Verify error handling

### Monitoring

```typescript
// Add to webhook handler
console.log("[Webhook] Received:", {
  paymentId: notification.PaymentId,
  status: notification.Status,
  amount: notification.Amount,
  timestamp: new Date().toISOString()
})
```

**Monitor:**
- Webhook delivery success rate
- Payment completion time
- Failed payment reasons
- Duplicate payment attempts
- Signature verification failures

### Rollback Plan

If production issues occur:

1. Enable demo mode temporarily:
   ```bash
   TBANK_TERMINAL_KEY=
   TBANK_PASSWORD=
   ```

2. Or force test mode:
   ```bash
   TBANK_TEST_MODE=true
   ```

3. Investigate issues without blocking users

---

## Security Vulnerabilities to Avoid

### 1. Never Log Sensitive Data

```typescript
// ❌ WRONG
console.log("Payment request:", {
  password: TBANK_PASSWORD,
  token: generatedToken
})

// ✅ CORRECT
console.log("Payment request:", {
  orderId,
  amount,
  testMode: IS_TEST_MODE
})
```

### 2. Always Verify Webhook Signatures

```typescript
// ❌ WRONG - Blindly trusting webhooks
export async function POST(request: NextRequest) {
  const notification = await request.json()
  // Directly update database without verification
  await updatePayment(notification.PaymentId)
}

// ✅ CORRECT
export async function POST(request: NextRequest) {
  const notification = await request.json()
  const isValid = verifyWebhookSignature(notification, notification.Token)
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }
  await updatePayment(notification.PaymentId)
}
```

### 3. Never Expose Credentials Client-Side

```typescript
// ❌ WRONG
// components/payment-form.tsx
const TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY // Exposed to client!

// ✅ CORRECT
// All payment logic in API routes only
// components/payment-form.tsx makes API calls to backend
```

### 4. Prevent SQL Injection

```typescript
// ❌ WRONG
const query = `UPDATE payments SET status = '${status}' WHERE id = ${paymentId}`

// ✅ CORRECT (using Neon sql template)
await sql`UPDATE payments SET status = ${status} WHERE id = ${paymentId}`
```

### 5. Validate All Inputs

```typescript
// ❌ WRONG
const { deviceId, amount } = await request.json()
await createPayment(deviceId, amount)

// ✅ CORRECT
const { deviceId, amount } = await request.json()

if (!deviceId || typeof deviceId !== 'string') {
  return NextResponse.json({ error: "Invalid device ID" }, { status: 400 })
}

if (amount !== 500) { // Fixed amount only
  return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
}

await createPayment(deviceId, amount)
```

---

## Troubleshooting Commands

### Check Environment Variables

```bash
# Verify variables are set
node -e "console.log(process.env.TBANK_TERMINAL_KEY?.substring(0, 5) + '...')"
node -e "console.log(process.env.TBANK_PASSWORD ? '[SET]' : '[EMPTY]')"
node -e "console.log(process.env.NEXT_PUBLIC_APP_URL)"
```

### Database Inspection

```sql
-- Check recent payments
SELECT
  id,
  user_id,
  yookassa_payment_id,
  amount,
  status,
  created_at
FROM payments
ORDER BY created_at DESC
LIMIT 10;

-- Find stuck payments
SELECT * FROM payments
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '1 hour';

-- Check referral earnings
SELECT
  r.referrer_id,
  COUNT(*) as successful_referrals,
  SUM(re.amount) as total_earned
FROM referrals r
JOIN referral_earnings re ON re.referrer_id = r.referrer_id
GROUP BY r.referrer_id;
```

### API Testing

```bash
# Test payment creation
curl -X POST http://localhost:3000/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test_device_123","email":"test@example.com"}'

# Test payment status
curl "http://localhost:3000/api/payment/status?device_id=test_device_123&payment_id=test_12345"

# Test webhook (manual trigger)
curl -X POST http://localhost:3000/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "TerminalKey": "test",
    "PaymentId": "test_12345",
    "Status": "CONFIRMED",
    "Token": "test_token"
  }'
```

---

## Additional Resources

### Official Documentation
- [T-Bank API Documentation](https://www.tbank.ru/kassa/dev/payments/)
- [T-Bank Webhook Guide](https://www.tbank.ru/kassa/dev/notifications/)
- [T-Bank Test Environment](https://www.tbank.ru/kassa/dev/sandbox/)

### Related Files in Project

| File | Purpose |
|------|---------|
| `C:/Users/bob/Projects/Fotoset/lib/tbank.ts` | Core payment logic |
| `C:/Users/bob/Projects/Fotoset/app/api/payment/create/route.ts` | Payment creation endpoint |
| `C:/Users/bob/Projects/Fotoset/app/api/payment/webhook/route.ts` | Webhook handler |
| `C:/Users/bob/Projects/Fotoset/app/api/payment/status/route.ts` | Status checking endpoint |
| `C:/Users/bob/Projects/Fotoset/.env.example` | Environment template |

### Support Contacts
- T-Bank Support: support@tbank.ru
- T-Bank Tech Support: https://www.tbank.ru/kassa/help/

---

**Document Version:** 1.0
**Last Updated:** 2025-12-11
**Maintained By:** Security Specialist
**Status:** Active
