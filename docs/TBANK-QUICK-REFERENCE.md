# T-Bank Payment Quick Reference

**Quick lookup guide for common T-Bank payment integration tasks**

---

## Environment Setup

### Minimal (Demo Mode)
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...
# Leave T-Bank vars empty for demo mode
```

### Test Mode
```bash
TBANK_TERMINAL_KEY=YourTerminalDEMO  # Must contain "DEMO" or "Test"
TBANK_PASSWORD=your_test_password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production
```bash
TBANK_TERMINAL_KEY=YourProductionKey  # No "DEMO" or "Test"
TBANK_PASSWORD=your_production_password
NEXT_PUBLIC_APP_URL=https://your-domain.com  # HTTPS only
```

---

## Error Quick Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Неверные параметры" | Wrong token signature | Check password, don't include Receipt in token |
| "Терминал не найден" | Invalid terminal key | Verify in merchant dashboard |
| Webhook not received | URL unreachable | Use ngrok, check HTTPS, verify webhook URL |
| Payment stuck in pending | Webhook not processed | Check webhook logs, verify signature |
| Test mode not working | Terminal key wrong format | Add "DEMO" suffix or set `TBANK_TEST_MODE=true` |

---

## Token Generation Algorithm

```typescript
// 1. Add password to params
params.Password = TBANK_PASSWORD

// 2. Sort keys alphabetically
const sorted = Object.keys(params).sort()

// 3. Concatenate VALUES only (not keys)
const concatenated = sorted.map(key => params[key]).join("")

// 4. SHA-256 hash
const token = crypto.createHash("sha256").update(concatenated).digest("hex")
```

**CRITICAL:** Never include `Receipt`, `DATA`, or `Token` in token calculation!

---

## Security Checklist

- [ ] Verify webhook signatures in production
- [ ] Use HTTPS for webhook URL
- [ ] Never log passwords or tokens
- [ ] Validate all input parameters
- [ ] Use SQL parameterized queries
- [ ] Keep credentials in environment variables only
- [ ] Exclude complex objects from token generation

---

## Test Cards (T-Bank Sandbox)

| Card | Result |
|------|--------|
| 4300000000000777 | Success |
| 4111111111111111 | Success |
| 5555555555554444 | Success |
| 4300000000000000 | Insufficient funds |
| 4300000000000001 | Card blocked |

**CVV:** 123, **Expiry:** 12/25

---

## Testing Webhooks

```bash
# 1. Start ngrok
ngrok http 3000

# 2. Test webhook manually
curl -X POST https://your-ngrok.ngrok.io/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "TerminalKey": "test",
    "PaymentId": "test_123",
    "Status": "CONFIRMED",
    "Amount": 50000,
    "Token": "test_token"
  }'
```

---

## Common SQL Queries

```sql
-- Check recent payments
SELECT id, yookassa_payment_id, status, created_at
FROM payments
ORDER BY created_at DESC
LIMIT 10;

-- Find stuck payments
SELECT * FROM payments
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '1 hour';

-- Manual status update (dev only)
UPDATE payments
SET status = 'succeeded', updated_at = NOW()
WHERE yookassa_payment_id = 'your_payment_id';
```

---

## File Locations

| File | Purpose |
|------|---------|
| `lib/tbank.ts` | Core payment logic, token generation |
| `app/api/payment/create/route.ts` | Payment creation endpoint |
| `app/api/payment/webhook/route.ts` | Webhook handler |
| `app/api/payment/status/route.ts` | Status polling endpoint |

---

## Mode Detection

```typescript
// Demo Mode: No credentials set
IS_DEMO_MODE = !TBANK_TERMINAL_KEY || !TBANK_PASSWORD

// Test Mode: Terminal contains "DEMO" or "Test"
IS_TEST_MODE = TBANK_TERMINAL_KEY.includes("DEMO") ||
               TBANK_TERMINAL_KEY.toLowerCase().includes("test")

// Production Mode: Valid credentials, no test indicators
!IS_DEMO_MODE && !IS_TEST_MODE
```

---

## Webhook Response Requirements

T-Bank requires exact response:
```json
{"success": true}
```

HTTP Status: 200

**If webhook fails, T-Bank will retry multiple times.**

---

## Amount Conversion

```typescript
// Always convert rubles to kopeks
const rubles = 500
const kopeks = rubles * 100 // 50000

// T-Bank API expects kopeks
{ Amount: 50000 } // 500 rubles
```

---

## Production Deployment Steps

1. Get production credentials from T-Bank
2. Set environment variables (no "DEMO" in terminal key)
3. Configure webhook URL in merchant dashboard: `https://your-domain.com/api/payment/webhook`
4. Enable HTTPS (required)
5. Test with small real payment
6. Monitor webhook delivery
7. Set up error tracking

---

## Emergency Rollback

If production fails:

```bash
# Option 1: Enable demo mode
TBANK_TERMINAL_KEY=
TBANK_PASSWORD=

# Option 2: Force test mode
TBANK_TEST_MODE=true
```

---

## Support

- **Full Documentation:** `docs/TBANK-PAYMENT-GUIDE.md`
- **T-Bank API Docs:** https://www.tbank.ru/kassa/dev/
- **T-Bank Support:** support@tbank.ru

---

**Version:** 1.0
**Last Updated:** 2025-12-11
