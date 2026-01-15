# Payment System Architecture

## Supported Providers

### 1. T-Bank (Primary)
- Russian payment provider
- Card payments, SBP
- Webhook notifications with SHA256 signature verification
- Test mode available via `TBANK_TEST_MODE=true`

### 2. Telegram Stars
- In-app currency for Telegram Mini Apps
- Handled via Telegram Bot API
- `telegram_charge_id` for transaction tracking

### 3. TON Crypto
- TON blockchain payments
- `ton_tx_hash` for transaction verification
- `ton_amount` in nanotons

## Database Schema

```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  payment_id VARCHAR(255),
  provider VARCHAR(20) DEFAULT 'tbank', -- tbank, stars, ton
  amount DECIMAL(10,2),
  status VARCHAR(20), -- pending, succeeded, canceled, refunded
  
  -- Stars-specific
  telegram_charge_id VARCHAR(255) UNIQUE,
  stars_amount INTEGER,
  
  -- TON-specific
  ton_tx_hash CHAR(64) UNIQUE,
  ton_amount DECIMAL(20,9),
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Payment Flow

1. User clicks "Pay" → `POST /api/payment/create`
2. Backend creates order with provider
3. User redirected to payment page
4. On success → redirect to `/payment/callback`
5. Callback page polls `/api/payment/status`
6. On `succeeded` → redirect to generation

## Critical Rules

```typescript
// ❌ NEVER hardcode prices
const PRICE = 499;

// ✅ Read from pricing_tiers or admin settings
const price = await getPricingTier(tierId);
```

## Webhook Security

```typescript
// T-Bank webhook verification
const expectedSignature = crypto
  .createHash('sha256')
  .update(password + JSON.stringify(sortedData))
  .digest('hex');
```

## Relations
@structure/api/endpoints
@code_style/patterns/error-handling
@bug_fixes/known-issues/payment-edge-cases
