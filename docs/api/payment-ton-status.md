# TON Payment Status Endpoint

## Overview

The TON payment status endpoint allows checking the current status of TON cryptocurrency payments, including payment details needed for manual completion and referral processing.

## Endpoint

```
GET /api/payment/ton/status
```

## Authentication

Requires `telegram_user_id` query parameter (Telegram-based authentication).

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `telegram_user_id` | string | **Yes** | Telegram user ID for authentication |
| `payment_id` | string | No | Specific payment ID to check. If omitted, returns latest TON payment for user |

## Response Format

### Success Response (200 OK)

```json
{
  "paymentId": 123,
  "status": "pending",
  "provider": "ton",
  "amount": {
    "rub": 1499,
    "ton": 4.5
  },
  "exchangeRate": 333.11,
  "comment": "PG123",
  "walletAddress": "UQC...",
  "expiresAt": "2026-01-06T14:30:00.000Z",
  "isExpired": false,
  "createdAt": "2026-01-06T14:00:00.000Z",
  "updatedAt": "2026-01-06T14:00:00.000Z",
  "transaction": {
    "hash": "abc123...",
    "confirmations": 5,
    "requiredConfirmations": 10
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `paymentId` | number | Database payment ID |
| `status` | string | Payment status: `pending`, `processing`, `succeeded`, `expired` |
| `provider` | string | Always `"ton"` |
| `amount.rub` | number | Amount in Russian rubles |
| `amount.ton` | number | Amount in TON cryptocurrency |
| `exchangeRate` | number | TON/RUB exchange rate used |
| `comment` | string | Payment comment for manual verification (format: `PG<paymentId>`) |
| `walletAddress` | string \| null | Wallet address to send payment to |
| `expiresAt` | string \| null | ISO timestamp when exchange rate expires |
| `isExpired` | boolean | Whether the payment has expired |
| `createdAt` | string | ISO timestamp when payment was created |
| `updatedAt` | string | ISO timestamp when payment was last updated |
| `transaction` | object \| undefined | Transaction details (only if payment is processing/succeeded) |
| `transaction.hash` | string | TON transaction hash |
| `transaction.confirmations` | number | Current blockchain confirmations |
| `transaction.requiredConfirmations` | number | Confirmations needed for success (10) |

## Payment Status Values

| Status | Description |
|--------|-------------|
| `pending` | Payment created, awaiting blockchain transaction |
| `processing` | Transaction detected, waiting for confirmations |
| `succeeded` | Transaction confirmed (10+ confirmations) |
| `expired` | Payment expired (30 minutes passed since creation) |

## Error Responses

### 400 Bad Request
Missing or invalid `telegram_user_id`:
```json
{
  "error": "telegram_user_id is required"
}
```

### 404 Not Found
User not found:
```json
{
  "error": "User not found"
}
```

No TON payments found:
```json
{
  "status": "no_payment",
  "message": "No TON payments found for this user"
}
```

Payment ID not found:
```json
{
  "error": "TON payment not found"
}
```

### 403 Forbidden
Payment belongs to different user:
```json
{
  "error": "Payment does not belong to this user"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to check TON payment status",
  "message": "Detailed error message"
}
```

## Payment Flow

### 1. Payment Creation
User creates TON payment via `/api/payment/create`:
- Server locks exchange rate (30 minute expiration)
- Generates unique comment: `PG<paymentId>`
- Returns wallet address and amount

### 2. User Sends TON
User manually sends TON to wallet address with comment:
- Amount: `amount.ton` from response
- Comment: `comment` from response (CRITICAL for matching)
- Destination: `walletAddress` from response

### 3. Blockchain Monitoring
Cron job (`/api/cron/ton-monitor`) checks blockchain:
- Matches transaction by comment
- Verifies amount (1% tolerance)
- Updates payment status
- Tracks confirmations

### 4. Payment Confirmation
After 10 confirmations:
- Payment status → `succeeded`
- Referral earnings processed automatically
- User gets pro access

## Automatic Processing

### Expiration Handling
If payment is `pending` and `rate_expires_at` has passed:
- Status automatically updated to `expired`
- User must create new payment with fresh rate

### Referral Processing
When payment status is `succeeded`:
- Automatically calls `processReferralEarning()`
- Credits referrer (10% regular, 50% partner)
- Idempotent (safe to call multiple times)

## Example Usage

### Check Latest TON Payment
```bash
curl "https://api.example.com/api/payment/ton/status?telegram_user_id=123456789"
```

### Check Specific Payment
```bash
curl "https://api.example.com/api/payment/ton/status?telegram_user_id=123456789&payment_id=456"
```

### Client-Side Polling
```typescript
async function pollTonPaymentStatus(telegramUserId: number, paymentId?: number) {
  const params = new URLSearchParams({
    telegram_user_id: telegramUserId.toString(),
  })

  if (paymentId) {
    params.append('payment_id', paymentId.toString())
  }

  const response = await fetch(`/api/payment/ton/status?${params}`)
  const data = await response.json()

  if (data.status === 'succeeded') {
    console.log('Payment confirmed!')
    return true
  }

  if (data.isExpired) {
    console.log('Payment expired, create new one')
    return false
  }

  if (data.status === 'processing') {
    console.log(`Waiting for confirmations: ${data.transaction.confirmations}/10`)
  }

  return false
}

// Poll every 10 seconds
const interval = setInterval(async () => {
  const completed = await pollTonPaymentStatus(123456789, 456)
  if (completed) {
    clearInterval(interval)
  }
}, 10000)
```

## Security

### Authentication
- **Telegram-only**: Requires valid `telegram_user_id`
- **User verification**: Ensures user exists in database
- **Payment ownership**: Verifies payment belongs to authenticated user

### Data Protection
- Payment details only accessible by owner
- Wallet address from admin settings (not hardcoded)
- Exchange rates locked at creation time

## Implementation Notes

### Exchange Rate Expiration
- Rates valid for 30 minutes (configurable via `PAYMENT_EXPIRATION_MS`)
- Automatic status update to `expired` when checking expired pending payment
- Users must create fresh payment after expiration

### Comment Format
- Format: `PG<paymentId>` (e.g., `PG123`)
- CRITICAL for transaction matching
- Must be included exactly when sending TON
- Case-sensitive

### Transaction Matching
TON monitor matches transactions by:
1. Payment comment (`PG<paymentId>`)
2. Amount verification (1% tolerance)
3. Rate expiration check

### Confirmations
- Required: 10 confirmations (from `ton.ts`)
- Status `processing` until 10 confirmations
- Status `succeeded` after 10 confirmations

## Related Endpoints

- `POST /api/payment/create` - Create TON payment
- `GET /api/cron/ton-monitor` - Blockchain monitoring cron
- `GET /api/payment/status` - Multi-provider status (T-Bank, Stars, TON)

## Database Schema

```sql
-- Key fields used by this endpoint
SELECT
  id,
  status,                  -- pending, processing, succeeded, expired
  amount,                  -- RUB amount
  ton_amount,             -- TON amount
  provider_payment_id,    -- Comment for transaction (PG<id>)
  ton_tx_hash,            -- Transaction hash (when processed)
  ton_confirmations,      -- Blockchain confirmations
  exchange_rate,          -- TON/RUB rate
  rate_expires_at,        -- Rate expiration timestamp
  created_at,
  updated_at,
  user_id
FROM payments
WHERE provider = 'ton'
```

## Changelog

### v1.0.0 (2026-01-06)
- Initial implementation
- Support for latest payment lookup
- Automatic expiration handling
- Referral earnings integration
- Transaction confirmation tracking
