# API Reference

## Base URL

```
Development: http://localhost:3000/api
Production:  https://your-domain.com/api
```

---

## User Management

### POST /api/user

**File:** `app/api/user/route.ts` (35 lines)

Get or create user by device ID.

**Request:**
```json
{
  "deviceId": "string (UUID)"
}
```

**Response:**
```json
{
  "id": 1,
  "deviceId": "abc123-def456",
  "paid": false
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing deviceId
- `500` - Database error

---

## Photo Generation

### POST /api/generate

**File:** `app/api/generate/route.ts` (264 lines)

Generate AI photos for a persona.

**Request:**
```json
{
  "deviceId": "string",
  "avatarId": "string",
  "styleId": "pinglass",
  "photoCount": 7 | 15 | 23,
  "referenceImages": ["base64-image-data", "..."]
}
```

**Response (Success):**
```json
{
  "success": true,
  "photos": [
    "data:image/png;base64,iVBORw0...",
    "data:image/png;base64,iVBORw0...",
    "..."
  ]
}
```

**Response (Error):**
```json
{
  "error": "User has not paid"
}
```

**Status Codes:**
- `200` - Generation successful
- `400` - Invalid request (missing fields)
- `403` - User has not paid
- `500` - Generation failed

**Notes:**
- Requires user to have completed payment
- Uses first 5 reference images for AI consistency
- Generates N photos based on `photoCount` parameter
- Uses prompts from `lib/prompts.ts`

**Photo Count Options:**

| Tier | Photos | Prompts Used |
|------|--------|--------------|
| Starter | 7 | First 7 from 23 |
| Standard | 15 | First 15 from 23 |
| Premium | 23 | All 23 prompts |

---

## Payment System

### POST /api/payment/create

**File:** `app/api/payment/create/route.ts` (73 lines)

Create a new payment order.

**Request:**
```json
{
  "deviceId": "string",
  "amount": 499 | 999 | 1499,
  "description": "PinGlass - 7 photos"
}
```

**Response:**
```json
{
  "paymentId": "payment_123",
  "confirmationUrl": "https://securepay.tinkoff.ru/...",
  "testMode": false
}
```

**Test Mode Response:**
```json
{
  "paymentId": "test_123",
  "confirmationUrl": "http://localhost:3000/payment/callback?payment_id=test_123&test=true",
  "testMode": true
}
```

**Status Codes:**
- `200` - Payment created
- `400` - Missing deviceId or already paid
- `500` - Payment creation failed

**Notes:**
- Test mode activates when T-Bank credentials are missing
- Redirects user to T-Bank payment page

---

### GET /api/payment/status

**File:** `app/api/payment/status/route.ts` (88 lines)

Check payment status.

**Query Parameters:**
- `device_id` (required) - User's device ID
- `payment_id` (optional) - Specific payment to check
- `test` (optional) - Set to "true" for test mode

**Response:**
```json
{
  "paid": true,
  "status": "succeeded"
}
```

**Status Values:**
- `succeeded` - Payment confirmed
- `pending` - Payment in progress
- `canceled` - Payment failed/canceled

**Status Codes:**
- `200` - Success
- `400` - Missing device_id
- `500` - Status check failed

**Example:**
```typescript
const params = new URLSearchParams({
  device_id: deviceId,
  payment_id: paymentId
})
const response = await fetch(`/api/payment/status?${params}`)
const { paid, status } = await response.json()
```

---

### POST /api/payment/webhook

**File:** `app/api/payment/webhook/route.ts` (58 lines)

Handle T-Bank payment notifications.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "TerminalKey": "terminal_key",
  "OrderId": "order_123",
  "Success": true,
  "Status": "CONFIRMED",
  "PaymentId": 123456789,
  "ErrorCode": "0",
  "Amount": 49900,
  "Token": "signature_token"
}
```

**Response:**
```json
{
  "success": true
}
```

**Status Values:**
- `CONFIRMED` - Payment successful
- `REJECTED` - Payment rejected
- `AUTHORIZED` - Payment authorized (pre-auth)

**Security:**
- Webhook signature verified using T-Bank token
- Invalid signatures return 403

---

## Testing

### GET /api/test-models

**File:** `app/api/test-models/route.ts` (31 lines)

Test API availability.

**Response:**
```json
{
  "models": ["imagen-3.0"],
  "status": "ok"
}
```

**Status Codes:**
- `200` - API accessible
- `500` - API unavailable

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Missing deviceId" | No device ID provided | Include deviceId in request |
| "User has not paid" | Generation without payment | Complete payment first |
| "User has already paid" | Duplicate payment attempt | Refresh page |
| "Payment creation failed" | T-Bank API error | Check credentials |
| "Invalid request" | Missing required fields | Check request body |

---

## Rate Limits

Currently no rate limiting implemented.

**Recommended limits for production:**
- `/api/generate` - 10 requests/hour per user
- `/api/payment/create` - 5 requests/minute per user
- `/api/user` - 60 requests/minute per IP

---

## TypeScript Types

```typescript
// Pricing Tiers
interface PricingTier {
  id: string       // "starter" | "standard" | "premium"
  photos: number   // 7 | 15 | 23
  price: number    // 499 | 999 | 1499
  popular?: boolean
}

// Request/Response types
interface UserRequest {
  deviceId: string
}

interface UserResponse {
  id: number
  deviceId: string
  hasPaid: boolean
}

interface GenerateRequest {
  deviceId: string
  avatarId: string
  styleId: "pinglass"
  photoCount: 7 | 15 | 23
  referenceImages: string[]  // base64 encoded
}

interface GenerateResponse {
  success: boolean
  photos: string[]  // base64 data URLs
}

interface PaymentCreateRequest {
  deviceId: string
  amount: number
  description?: string
}

interface PaymentCreateResponse {
  paymentId: string
  confirmationUrl: string
  testMode: boolean
}

interface PaymentStatusResponse {
  paid: boolean
  status: "succeeded" | "pending" | "canceled"
}
```

---

## Environment Variables

```env
# Database (Required)
DATABASE_URL=postgresql://user:pass@host/db

# Google AI (Required for generation)
GOOGLE_API_KEY=AIza...

# T-Bank Payment (Optional - test mode without)
TBANK_TERMINAL_KEY=...
TBANK_PASSWORD=...

# YeScale Proxy (Optional)
YESCALE_API_KEY=...

# App URL (Required for callbacks)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```
