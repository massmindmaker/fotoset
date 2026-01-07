# PinGlass API Reference

Complete API documentation for all endpoints.

---

## Authentication

All API requests must include Telegram user authentication via query parameters or request body.

**Required Parameter:**
- `telegram_user_id` - Telegram User ID from WebApp API

**Example:**
```bash
curl "https://pinglass.vercel.app/api/avatars?telegram_user_id=123456789"
```

---

## Users

### `POST /api/user`

Get or create user by Telegram ID.

**Request Body:**
```json
{
  "telegramUserId": 123456789
}
```

**Response (200):**
```json
{
  "id": 1,
  "telegram_user_id": 123456789,
  "created_at": "2024-12-19T10:00:00Z",
  "updated_at": "2024-12-19T10:00:00Z"
}
```

**Errors:**
- `400` - Missing telegramUserId
- `500` - Database error

---

## Avatars

### `GET /api/avatars`

List all avatars for a user.

**Query Parameters:**
- `telegram_user_id` (required) - Telegram User ID

**Example:**
```bash
curl "https://pinglass.vercel.app/api/avatars?telegram_user_id=123456789"
```

**Response (200):**
```json
{
  "avatars": [
    {
      "id": 1,
      "user_id": 1,
      "name": "Мой аватар",
      "status": "ready",
      "thumbnail_url": "https://...",
      "created_at": "2024-12-19T10:00:00Z",
      "updated_at": "2024-12-19T10:00:00Z"
    }
  ]
}
```

**Errors:**
- `400` - Missing telegram_user_id
- `500` - Database error

---

### `POST /api/avatars`

Create a new avatar.

**Request Body:**
```json
{
  "telegramUserId": 123456789,
  "name": "Профессиональные фото"
}
```

**Response (201):**
```json
{
  "id": 1,
  "user_id": 1,
  "name": "Профессиональные фото",
  "status": "draft",
  "thumbnail_url": null,
  "created_at": "2024-12-19T10:00:00Z",
  "updated_at": "2024-12-19T10:00:00Z"
}
```

**Errors:**
- `400` - Missing required fields
- `401` - User not found
- `500` - Database error

---

### `POST /api/avatars/[id]/references`

Upload reference photos for an avatar.

**URL Parameters:**
- `id` - Avatar ID

**Request Body:**
```json
{
  "telegramUserId": 123456789,
  "referenceImages": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "uploadedUrls": [
    "https://storage.googleapis.com/...",
    "https://storage.googleapis.com/..."
  ]
}
```

**Errors:**
- `400` - Invalid avatar ID or missing images
- `401` - Unauthorized (not your avatar)
- `500` - Upload failed

---

## Generation

### `POST /api/generate`

Generate 23 AI photos for an avatar.

**Request Body:**
```json
{
  "telegramUserId": 123456789,
  "avatarId": 1,
  "styleId": "professional",
  "photoCount": 23,
  "referenceImages": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  ]
}
```

**Parameters:**
- `telegramUserId` (required) - Telegram User ID
- `avatarId` (required) - Avatar ID to generate for
- `styleId` (required) - Style preset: `"professional"`, `"lifestyle"`, or `"creative"`
- `photoCount` (optional) - Number of photos to generate (default: 23)
- `referenceImages` (optional) - Array of base64-encoded images or URLs

**Response (200):**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "photosGenerated": 23,
  "photos": [
    "https://storage.googleapis.com/photo1.jpg",
    "https://storage.googleapis.com/photo2.jpg",
    "..."
  ],
  "avatarStatus": "ready"
}
```

**Response (202) - Processing:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": "Generation started. Check back in a few minutes."
}
```

**Errors:**
- `400` - Missing required fields or invalid styleId
- `401` - User is not Pro or unauthorized
- `404` - Avatar not found
- `500` - Generation failed

**Style IDs:**
- `professional` - Business portraits (9 prompts)
- `lifestyle` - Social media photos (9 prompts)
- `creative` - Artistic portraits (9 prompts)

**Notes:**
- Generation takes 5-10 minutes for 23 photos
- Some photos may fail (API errors), but generation continues
- Final count may be less than 23 if errors occur

---

## Payments

### `POST /api/payment/create`

Create a new payment order.

**Request Body:**
```json
{
  "telegramUserId": 123456789,
  "avatarId": 1
}
```

**Response (200):**
```json
{
  "paymentId": "7586227553",
  "confirmationUrl": "https://securepay.tinkoff.ru/...",
  "amount": 500,
  "currency": "RUB",
  "status": "pending",
  "testMode": false
}
```

**Errors:**
- `400` - Missing telegramUserId
- `401` - User not found
- `500` - Payment creation failed

**Notes:**
- Amount is fixed at 500 RUB for Pro subscription
- Test mode available with special Terminal Key
- Payment expires after 30 minutes

---

### `GET /api/payment/status`

Check payment status and Pro subscription.

**Query Parameters:**
- `telegram_user_id` (required) - Telegram User ID
- `payment_id` (optional) - T-Bank Payment ID

**Example:**
```bash
curl "https://pinglass.vercel.app/api/payment/status?telegram_user_id=123456789&payment_id=7586227553"
```

**Response (200):**
```json
{
  "paid": true,
  "status": "succeeded",
  "paymentId": "7586227553",
  "amount": 500,
  "currency": "RUB"
}
```

**Errors:**
- `400` - Missing telegram_user_id
- `404` - Payment not found
- `500` - Database error

**Payment Statuses:**
- `pending` - Awaiting payment
- `succeeded` - Payment successful, user is Pro
- `canceled` - Payment canceled by user
- `expired` - Payment expired (30 min timeout)

---

### `POST /api/payment/webhook`

T-Bank webhook handler for payment notifications.

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: <SHA256 signature>
```

**Request Body (Example):**
```json
{
  "TerminalKey": "YOUR_TERMINAL_KEY",
  "OrderId": "550e8400-e29b-41d4-a716-446655440000",
  "Success": true,
  "Status": "CONFIRMED",
  "PaymentId": "7586227553",
  "ErrorCode": "0",
  "Amount": 50000,
  "Token": "<calculated_signature>"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Errors:**
- `400` - Invalid signature or missing fields
- `500` - Database update failed

**Notes:**
- Webhook must be registered in T-Bank dashboard
- Signature is verified using SHA256 hash
- Amount is in kopecks (50000 = 500 RUB)
- Updates `payments.status` (payment status determines paid status)

---

## Error Responses

All endpoints return standardized error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

**Error Codes:**
- `UNAUTHORIZED` - Missing or invalid authentication
- `BAD_REQUEST` - Invalid request parameters
- `NOT_FOUND` - Resource not found
- `FORBIDDEN` - Insufficient permissions
- `SERVER_ERROR` - Internal server error
- `RATE_LIMIT` - Too many requests (not implemented)

---

## Rate Limits

**Current Status:** Not implemented

**Recommended Limits:**
- User API: 100 requests/minute
- Generation API: 5 requests/hour per user
- Payment API: 10 requests/minute per user

---

## Testing

### Test Endpoints

`POST /api/test-models` - Test Google Imagen API connectivity

**Request Body:**
```json
{
  "prompt": "Professional headshot of a person",
  "referenceImages": []
}
```

**Response:**
```json
{
  "success": true,
  "imageUrl": "https://storage.googleapis.com/...",
  "model": "imagen-3.0-generate-001"
}
```

---

**Last Updated:** December 19, 2024
**API Version:** 2.0
