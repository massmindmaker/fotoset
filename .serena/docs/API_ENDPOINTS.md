# Fotoset API Endpoints

## Base URL
- Production: `https://fotoset.app`
- Development: `http://localhost:3000`

## Authentication
Device ID-based (stored in localStorage). No session tokens required.

---

## Avatars

### GET /api/avatars
**Get all avatars for user with generated photos**

Query: `device_id` (required)

Response:
```json
{
  "success": true,
  "data": {
    "avatars": [{
      "id": 1,
      "name": "My Avatar",
      "status": "ready",
      "thumbnailUrl": "https://...",
      "photoCount": 23,
      "generatedPhotos": [...]
    }],
    "isPro": true
  }
}
```

### POST /api/avatars
**Create new avatar**

Body: `{ "deviceId": "...", "name": "..." }`

### DELETE /api/avatars/[id]
**Delete avatar and all photos**

### GET /api/avatars/[id]/references
**Get reference images for avatar**

---

## Generation

### POST /api/generate
**Start photo generation (returns immediately)**

Body:
```json
{
  "deviceId": "abc123",
  "avatarId": "1704067200000",
  "styleId": "professional|lifestyle|creative",
  "referenceImages": ["data:image/jpeg;base64,..."]
}
```

Response:
```json
{
  "success": true,
  "data": {
    "jobId": 42,
    "status": "processing",
    "totalPhotos": 23
  }
}
```

### GET /api/generate
**Check generation status (polling)**

Query: `job_id` or `avatar_id`

Response:
```json
{
  "success": true,
  "data": {
    "jobId": 42,
    "status": "completed",
    "progress": { "completed": 23, "total": 23 },
    "photos": ["https://..."]
  }
}
```

---

## Payment

### POST /api/payment/create
**Initiate payment**

Body:
```json
{
  "deviceId": "abc123",
  "email": "user@example.com",
  "referralCode": "ABC123"
}
```

Response:
```json
{
  "paymentId": "644427052993",
  "confirmationUrl": "https://securepay.tinkoff.ru/...",
  "testMode": false
}
```

### GET /api/payment/status
**Check payment status**

Query: `device_id`, `payment_id`

Response:
```json
{
  "isPro": true,
  "status": "succeeded",
  "amount": 50000
}
```

### POST /api/payment/webhook
**T-Bank webhook handler**

Body (from T-Bank):
```json
{
  "TerminalKey": "...",
  "OrderId": "...",
  "Status": "CONFIRMED",
  "PaymentId": "...",
  "Amount": 50000,
  "Token": "sha256..."
}
```

---

## Referral

### POST /api/referral/code
**Generate referral code**

Body: `{ "deviceId": "..." }`

### POST /api/referral/apply
**Apply referral code**

Body: `{ "deviceId": "...", "code": "ABC123" }`

### GET /api/referral/earnings
**Get referral earnings**

Query: `device_id`

### POST /api/referral/withdraw
**Request withdrawal**

Body:
```json
{
  "deviceId": "...",
  "amount": 5000,
  "method": "card|sbp",
  "cardNumber": "4111...",
  "recipientName": "..."
}
```

---

## User

### GET /api/user
**Get user profile**

Query: `device_id`

### POST /api/user
**Update user**

Body: `{ "deviceId": "...", "telegramUserId": 123456789 }`

---

## Telegram

### POST /api/telegram/send-photos
**Send photos to Telegram**

Body: `{ "deviceId": "...", "avatarId": 5, "photoIds": [1,2,3] }`

---

## Error Response Format

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}
```

Error codes:
- `VALIDATION_ERROR` - Invalid input
- `RATE_LIMIT_ERROR` - Too many requests (3/hour for generate)
- `UNAUTHORIZED` - Auth failed
- `NOT_FOUND` - Resource not found
- `GENERATION_FAILED` - AI provider error
- `PAYMENT_FAILED` - Payment error
