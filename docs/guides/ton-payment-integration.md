# TON Payment Integration Guide

## Overview

This guide explains how to integrate TON cryptocurrency payments into the PinGlass application, covering payment creation, status checking, and user experience.

## Payment Flow

```
┌─────────────────┐
│ User selects    │
│ TON payment     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST /api/      │  Creates payment with locked rate
│ payment/create  │  Returns: wallet, amount, comment
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ User opens TON  │  Displays payment instructions:
│ wallet app      │  - Amount: 4.5 TON
└────────┬────────┘  - Wallet: UQC...
         │           - Comment: PG123
         │           - Expires: 30 minutes
         ▼
┌─────────────────┐
│ User sends TON  │  CRITICAL: Must include comment!
│ with comment    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Poll /api/      │  Every 10 seconds until:
│ payment/ton/    │  - status: succeeded
│ status          │  - isExpired: true
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
 Success    Expired
    │          │
    ▼          ▼
┌──────────┐  ┌──────────┐
│ Grant    │  │ Show     │
│ access   │  │ retry    │
└──────────┘  └──────────┘
```

## API Endpoints

### 1. Create TON Payment

```typescript
const response = await fetch('/api/payment/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    telegramUserId: user.id,
    paymentMethod: 'ton',
    tierId: 'premium', // starter | standard | premium
    email: user.email, // Required for receipt
  }),
})

const data = await response.json()
// {
//   paymentId: 123,
//   providerPaymentId: "PG123",
//   walletAddress: "UQC...",
//   amount: 4.5,
//   currency: "TON",
//   amountRub: 1499,
//   exchangeRate: 333.11,
//   expiresAt: "2026-01-06T14:30:00.000Z"
// }
```

### 2. Check Payment Status

```typescript
const response = await fetch(
  `/api/payment/ton/status?telegram_user_id=${user.id}&payment_id=${paymentId}`
)

const data = await response.json()
// {
//   paymentId: 123,
//   status: "pending" | "processing" | "succeeded" | "expired",
//   amount: { rub: 1499, ton: 4.5 },
//   comment: "PG123",
//   walletAddress: "UQC...",
//   expiresAt: "2026-01-06T14:30:00.000Z",
//   isExpired: false,
//   transaction?: {
//     hash: "abc123...",
//     confirmations: 5,
//     requiredConfirmations: 10
//   }
// }
```

## React Component Example

```typescript
import { useState, useEffect } from 'react'

interface TonPaymentProps {
  userId: number
  tierId: 'starter' | 'standard' | 'premium'
  onSuccess: () => void
}

export function TonPayment({ userId, tierId, onSuccess }: TonPaymentProps) {
  const [payment, setPayment] = useState<any>(null)
  const [status, setStatus] = useState<string>('creating')
  const [error, setError] = useState<string | null>(null)

  // Create payment on mount
  useEffect(() => {
    createPayment()
  }, [])

  // Poll status every 10 seconds
  useEffect(() => {
    if (!payment?.paymentId) return

    const interval = setInterval(() => {
      checkStatus()
    }, 10000)

    return () => clearInterval(interval)
  }, [payment?.paymentId])

  async function createPayment() {
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: userId,
          paymentMethod: 'ton',
          tierId,
          email: 'user@example.com',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create payment')
      }

      const data = await response.json()
      setPayment(data)
      setStatus('pending')
    } catch (err) {
      setError(err.message)
    }
  }

  async function checkStatus() {
    try {
      const response = await fetch(
        `/api/payment/ton/status?telegram_user_id=${userId}&payment_id=${payment.paymentId}`
      )

      if (!response.ok) {
        throw new Error('Failed to check status')
      }

      const data = await response.json()

      if (data.status === 'succeeded') {
        setStatus('succeeded')
        onSuccess()
      } else if (data.isExpired) {
        setStatus('expired')
      } else if (data.status === 'processing') {
        setStatus('processing')
        setPayment((prev) => ({ ...prev, transaction: data.transaction }))
      }
    } catch (err) {
      console.error('Status check failed:', err)
    }
  }

  if (error) {
    return <div className="error">Error: {error}</div>
  }

  if (status === 'creating') {
    return <div className="loading">Creating payment...</div>
  }

  if (status === 'succeeded') {
    return (
      <div className="success">
        <h3>✅ Payment Confirmed!</h3>
        <p>Your pro access has been activated.</p>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="expired">
        <h3>⏰ Payment Expired</h3>
        <p>The exchange rate expired. Please create a new payment.</p>
        <button onClick={createPayment}>Create New Payment</button>
      </div>
    )
  }

  return (
    <div className="payment-instructions">
      <h3>Send TON Payment</h3>

      <div className="payment-details">
        <div className="detail">
          <label>Amount:</label>
          <code>{payment.amount} TON</code>
        </div>

        <div className="detail">
          <label>Wallet Address:</label>
          <code>{payment.walletAddress}</code>
          <button onClick={() => navigator.clipboard.writeText(payment.walletAddress)}>
            Copy
          </button>
        </div>

        <div className="detail">
          <label>Comment (IMPORTANT!):</label>
          <code>{payment.providerPaymentId}</code>
          <button onClick={() => navigator.clipboard.writeText(payment.providerPaymentId)}>
            Copy
          </button>
        </div>

        <div className="detail">
          <label>Expires:</label>
          <span>{new Date(payment.expiresAt).toLocaleTimeString()}</span>
        </div>
      </div>

      {status === 'processing' && (
        <div className="confirmations">
          <p>Transaction detected! Waiting for confirmations...</p>
          <progress
            value={payment.transaction?.confirmations || 0}
            max={payment.transaction?.requiredConfirmations || 10}
          />
          <span>
            {payment.transaction?.confirmations || 0} /{' '}
            {payment.transaction?.requiredConfirmations || 10}
          </span>
        </div>
      )}

      <div className="warning">
        ⚠️ Make sure to include the comment when sending payment!
        <br />
        Without the correct comment, we cannot match your payment.
      </div>
    </div>
  )
}
```

## Important Notes

### 1. Comment is CRITICAL
The comment field (`PG123` format) is used to match blockchain transactions to payments. Without it, the payment cannot be verified.

```typescript
// ❌ WRONG - No comment
await tonWallet.send({
  to: walletAddress,
  amount: tonAmount,
})

// ✅ CORRECT - With comment
await tonWallet.send({
  to: walletAddress,
  amount: tonAmount,
  comment: paymentComment, // PG123
})
```

### 2. Exchange Rate Expiration
Exchange rates are locked for 30 minutes. After expiration:
- Payment status becomes `expired`
- User must create fresh payment with new rate
- Old payment cannot be completed

### 3. Transaction Confirmations
TON payments require 10 blockchain confirmations:
- 0-9 confirmations: `processing`
- 10+ confirmations: `succeeded`
- Each confirmation takes ~5 seconds

### 4. Automatic Referral Processing
When payment succeeds:
- Referral earnings are automatically calculated
- Referrer gets credited (10% regular, 50% partner)
- Processing is idempotent (safe to retry)

## Telegram Bot Integration

```typescript
// Telegram bot handler for /pay command
bot.onText(/\/pay/, async (msg) => {
  const userId = msg.from.id

  // Create payment
  const payment = await fetch('/api/payment/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUserId: userId,
      paymentMethod: 'ton',
      tierId: 'premium',
      email: 'telegram@user.com',
    }),
  }).then((r) => r.json())

  // Send payment instructions
  await bot.sendMessage(
    msg.chat.id,
    `
💎 TON Payment Instructions

Send exactly: ${payment.amount} TON
To wallet: \`${payment.walletAddress}\`
Comment: \`${payment.providerPaymentId}\`

⚠️ IMPORTANT: Include the comment or we cannot verify your payment!

⏰ Expires: ${new Date(payment.expiresAt).toLocaleString()}

We'll notify you when payment is confirmed (takes ~1-2 minutes).
  `,
    { parse_mode: 'Markdown' }
  )

  // Start polling for status
  pollPaymentStatus(msg.chat.id, userId, payment.paymentId)
})

async function pollPaymentStatus(chatId: number, userId: number, paymentId: number) {
  const interval = setInterval(async () => {
    const status = await fetch(
      `/api/payment/ton/status?telegram_user_id=${userId}&payment_id=${paymentId}`
    ).then((r) => r.json())

    if (status.status === 'succeeded') {
      await bot.sendMessage(chatId, '✅ Payment confirmed! Your pro access is now active.')
      clearInterval(interval)
    } else if (status.isExpired) {
      await bot.sendMessage(chatId, '⏰ Payment expired. Use /pay to create a new one.')
      clearInterval(interval)
    } else if (status.status === 'processing') {
      await bot.sendMessage(
        chatId,
        `⏳ Transaction detected! Confirmations: ${status.transaction.confirmations}/10`
      )
    }
  }, 10000)

  // Stop polling after 35 minutes (5 minutes past expiration)
  setTimeout(() => clearInterval(interval), 35 * 60 * 1000)
}
```

## Error Handling

```typescript
async function handleTonPayment(userId: number, tierId: string) {
  try {
    // Create payment
    const createResponse = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId: userId,
        paymentMethod: 'ton',
        tierId,
        email: 'user@example.com',
      }),
    })

    if (!createResponse.ok) {
      const error = await createResponse.json()

      if (error.error === 'TON wallet address not configured') {
        alert('TON payments are currently unavailable. Please try another payment method.')
        return
      }

      throw new Error(error.error || 'Failed to create payment')
    }

    const payment = await createResponse.json()

    // Check status
    const statusResponse = await fetch(
      `/api/payment/ton/status?telegram_user_id=${userId}&payment_id=${payment.paymentId}`
    )

    if (!statusResponse.ok) {
      const error = await statusResponse.json()

      if (error.error === 'User not found') {
        alert('Please register first')
        return
      }

      if (error.error === 'Payment does not belong to this user') {
        alert('Security error: Invalid payment access')
        return
      }

      throw new Error(error.error || 'Failed to check status')
    }

    const status = await statusResponse.json()
    return status
  } catch (err) {
    console.error('TON payment error:', err)
    alert('Payment error. Please try again or contact support.')
  }
}
```

## Testing

### Manual Testing
1. Create payment: `POST /api/payment/create`
2. Copy wallet address and comment
3. Send TON from test wallet
4. Poll status: `GET /api/payment/ton/status`
5. Verify status changes: `pending` → `processing` → `succeeded`

### Integration Tests
```bash
npm run test tests/integration/payment/ton-status.test.ts
```

### Test Coverage
- ✅ Missing `telegram_user_id` validation
- ✅ User not found handling
- ✅ Latest payment lookup
- ✅ Specific payment lookup
- ✅ Payment ownership verification
- ✅ Expiration handling
- ✅ Transaction confirmation tracking
- ✅ Referral earning processing

## Security Considerations

### Authentication
- Telegram-only (no device ID)
- User verification required
- Payment ownership check

### Data Protection
- Wallet address from admin settings
- No hardcoded credentials
- Exchange rates locked at creation

### Transaction Matching
- Unique comment per payment
- Amount verification (1% tolerance)
- Duplicate transaction prevention

## Related Documentation

- [TON Payment Status API](../api/payment-ton-status.md)
- [Payment Provider Types](../../lib/payments/types.ts)
- [TON Provider Implementation](../../lib/payments/providers/ton.ts)
- [Referral Earnings System](../../lib/referral-earnings.ts)

## Support

For issues or questions:
- Backend API: `/api/payment/ton/status`
- Blockchain monitoring: `/api/cron/ton-monitor`
- Admin settings: TON wallet configuration
