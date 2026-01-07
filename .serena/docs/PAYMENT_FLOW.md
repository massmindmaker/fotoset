# Fotoset Payment Flow

## Overview

**Provider:** T-Bank (Tinkoff) Payment API
**Amount:** 500 RUB (one-time, unlocks Pro)

---

## Payment Modes

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Production** | Has credentials | Real T-Bank payment |
| **Test** | `TBANK_TEST_MODE=true` | Mock instant success |
| **Demo** | No credentials | Demo payment page |

---

## Payment Flow

```
1. User clicks "Pay 500₽"
         ↓
2. POST /api/payment/create
   - Find/create user
   - Apply referral code
   - Init T-Bank or Demo
         ↓
3. Redirect to confirmationUrl
   - T-Bank: securepay.tinkoff.ru
   - Demo: /payment/demo
         ↓
4. User completes payment
         ↓
5. T-Bank Webhook → /api/payment/webhook
   - Verify signature (SHA256)
   - Update status to 'succeeded'
   - Process referral earning (10%)
         ↓
6. Frontend polls /api/payment/status
         ↓
7. Update localStorage (paid status cached)
```

---

## T-Bank Integration

**File:** `lib/tbank.ts`

```typescript
// Configuration
const TBANK_API_URL = "https://securepay.tinkoff.ru/v2"
const TBANK_TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY
const TBANK_PASSWORD = process.env.TBANK_PASSWORD

// Functions
initPayment(amount, orderId, description, urls)
getPaymentState(paymentId)
verifyWebhookSignature(notification, token)
```

---

## Webhook Verification

```typescript
function verifyWebhookSignature(notification, receivedToken) {
  // 1. Remove Token from params
  // 2. Add Password
  // 3. Sort keys alphabetically
  // 4. Concatenate values
  // 5. SHA256 hash
  // 6. Compare with received token
}
```

---

## T-Bank Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| NEW | Payment created | Awaiting |
| CONFIRMED | Success | Mark payment succeeded |
| AUTHORIZED | Card authorized | Mark payment succeeded |
| REJECTED | Failed | Keep pending |

---

## Referral Processing

On payment success:
```typescript
// 10% of payment amount
const REFERRAL_RATE = 0.10;
const earningAmount = 500 * 0.10; // = 50 RUB

// Update referrer balance
await sql`
  UPDATE referral_balances
  SET balance = balance + ${earningAmount}
  WHERE user_id = ${referrerId}
`;
```

---

## Demo Mode

When no T-Bank credentials:

1. Payment redirects to `/payment/demo`
2. User sees payment details
3. Clicks "Confirm Payment"
4. Status updated to succeeded
5. Redirects to callback

---

## Receipt Format (ФЗ-54)

```typescript
Receipt: {
  Email: user.email,
  Taxation: "usn_income",
  Items: [{
    Name: "Генерация AI-фотографий",
    Price: 50000,      // копейки
    Quantity: 1,
    Amount: 50000,
    Tax: "none",
    PaymentMethod: "full_payment",
    PaymentObject: "service"
  }]
}
```

---

## Environment Variables

```env
TBANK_TERMINAL_KEY=1234567890ABCDEF
TBANK_PASSWORD=TinkoffPassword123
TBANK_TEST_MODE=true          # For testing
NEXT_PUBLIC_APP_URL=https://fotoset.app
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook not firing | Check NEXT_PUBLIC_APP_URL |
| Invalid signature | Verify TBANK_PASSWORD |
| Payment stuck | Increase polling timeout |
