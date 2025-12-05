# API Reference

## Base URL

```
Development: http://localhost:3000/api
Production:  https://your-domain.com/api
```

---

## User Management

### POST /api/user

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
  "isPro": false
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing deviceId
- `500` - Database error

**Example:**
```typescript
const response = await fetch('/api/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceId: 'my-device-id' })
})
const user = await response.json()
```

---

## Photo Generation

### POST /api/generate

Generate 23 AI photos for a persona.

**Request:**
```json
{
  "deviceId": "string",
  "avatarId": "string",
  "styleId": "professional" | "lifestyle" | "creative",
  "referenceImages": ["base64-image-data", "..."]
}
```

**Response (Success):**
```json
{
  "success": true,
  "jobId": "123",
  "photosGenerated": 23,
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
  "error": "User is not Pro"
}
```

**Status Codes:**
- `200` - Generation successful
- `400` - Invalid request (missing fields)
- `403` - User is not Pro
- `500` - Generation failed

**Notes:**
- Requires user to have Pro status
- Uses first reference image for AI consistency
- Generates 9 photos based on selected style
- Each style has different prompt configurations

**Style Configurations:**

| Style | Prompt Indices | Description |
|-------|----------------|-------------|
| professional | 3,4,11,6,18,21,0,19,7 | Business portraits, clean backgrounds |
| lifestyle | 1,2,4,5,8,12,15,16,22 | Casual, natural locations |
| creative | 9,13,16,17,10,20,14,7,6 | Artistic, dramatic lighting |

---

## Payment System

### POST /api/payment/create

Create a new payment order.

**Request:**
```json
{
  "deviceId": "string",
  "avatarId": "string (optional)"
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
- `400` - Missing deviceId or already Pro
- `500` - Payment creation failed

**Notes:**
- Amount: 500 RUB
- Test mode activates when T-Bank credentials are missing
- Redirects user to T-Bank payment page

---

### GET /api/payment/status

Check payment status and Pro subscription.

**Query Parameters:**
- `device_id` (required) - User's device ID
- `payment_id` (optional) - Specific payment to check
- `test` (optional) - Set to "true" for test mode

**Response:**
```json
{
  "isPro": true,
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
const { isPro, status } = await response.json()
```

---

### POST /api/payment/webhook

Handle T-Bank payment notifications.

**Request Headers:**
```
Content-Type: application/json
X-Signature: sha256-signature
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
  "Amount": 50000,
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

Test YeScale API availability.

**Response:**
```json
{
  "models": ["gemini-1.5-flash", "imagen-3.0"],
  "testResponse": {
    "text": "Hello from Gemini!"
  }
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
| "User is not Pro" | Generation without Pro status | Complete payment first |
| "User is already Pro" | Duplicate payment attempt | Refresh page |
| "Payment creation failed" | T-Bank API error | Check credentials |

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
// Request/Response types

interface UserRequest {
  deviceId: string
}

interface UserResponse {
  id: number
  deviceId: string
  isPro: boolean
}

interface GenerateRequest {
  deviceId: string
  avatarId: string
  styleId: 'professional' | 'lifestyle' | 'creative'
  referenceImages: string[]
}

interface GenerateResponse {
  success: boolean
  jobId: string
  photosGenerated: number
  photos: string[]
}

interface PaymentCreateRequest {
  deviceId: string
  avatarId?: string
}

interface PaymentCreateResponse {
  paymentId: string
  confirmationUrl: string
  testMode: boolean
}

interface PaymentStatusResponse {
  isPro: boolean
  status: 'succeeded' | 'pending' | 'canceled'
}

type StyleId = 'professional' | 'lifestyle' | 'creative'
```
