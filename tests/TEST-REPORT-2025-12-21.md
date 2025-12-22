# Test Report - PinGlass (2025-12-21)

## Summary

| Category | Passed | Failed | Pass Rate |
|----------|--------|--------|-----------|
| Unit Tests (tbank.ts) | 89 | 3 | **97%** |
| E2E Smoke Tests | 15 | 10 | **60%** |
| API Manual Tests | 4 | 0 | **100%** |
| **TOTAL** | **108** | **13** | **89%** |

---

## 1. Unit Tests

**Command:** `npm run test:unit`

### Results
- **Passed:** 89 tests
- **Failed:** 3 tests
- **Coverage:** 75.22% statements, 62.12% branches

### Coverage by File
| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| logger.ts | 77.77% | 50% | 63.63% | 77.77% |
| tbank.ts | 74.73% | 63.79% | 83.33% | 73.62% |

### Test Categories Passed
- Payment Initialization
- Payment Status Check
- Signature Verification
- Webhook Processing
- Test Mode Detection
- Error Handling
- Security Tests
- Amount Conversion

---

## 2. E2E Smoke Tests

**Command:** `TEST_URL=https://www.pinglass.ru npx playwright test tests/e2e/smoke.spec.ts`

### Results by Browser
| Browser | Passed | Failed |
|---------|--------|--------|
| Chromium | 3 | 2 |
| Firefox | 3 | 2 |
| WebKit | 3 | 2 |
| Mobile Chrome | 3 | 2 |
| Mobile Safari | 3 | 2 |

### Passed Tests
- Homepage loads correctly (all browsers)
- Payment callback page loads (all browsers)
- API health check - payment create validation (all browsers)

### Failed Tests (Expected)
1. **can start new persona flow** - `input[type="file"]` not found
   - **Причина:** Требуется Telegram WebApp для создания персоны
   - **Статус:** Ожидаемое поведение (Telegram-only auth)

2. **API health check - user endpoint** - Returns 401
   - **Причина:** Требуется telegramInitData
   - **Статус:** Ожидаемое поведение (Security)

---

## 3. API Manual Tests (Production)

### 3.1 Payment Create
```bash
POST https://www.pinglass.ru/api/payment/create
{
  "telegramUserId": 123456789,
  "email": "test@test.com",
  "tierId": "premium"
}
```
**Response:**
```json
{
  "paymentId": "7601609916",
  "confirmationUrl": "https://pay.tbank.ru/LYZ8Cyoa",
  "testMode": true,
  "telegramUserId": 123456789
}
```
**Status:** PASSED

### 3.2 Payment Status
```bash
GET https://www.pinglass.ru/api/payment/status?telegram_user_id=123456789
```
**Response:**
```json
{
  "paid": false,
  "status": "new"
}
```
**Status:** PASSED

### 3.3 Generation Without Payment
```bash
POST https://www.pinglass.ru/api/generate
{
  "telegramUserId": 999999999,
  "avatarId": "123",
  "styleId": "professional",
  "referenceImages": ["base64..."],
  "photoCount": 1
}
```
**Response:**
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Please complete payment before generating photos"
  }
}
```
**Status:** PASSED (Security check working)

### 3.4 Generation With Invalid Avatar
```bash
POST https://www.pinglass.ru/api/generate
{
  "telegramUserId": 123456789,
  "avatarId": "123",
  "styleId": "professional",
  "useStoredReferences": true
}
```
**Response:**
```json
{
  "success": false,
  "error": {
    "code": "AVATAR_NOT_FOUND",
    "message": "Avatar not found or access denied"
  }
}
```
**Status:** PASSED (Access control working)

---

## 4. KIE Integration Status

**KIE НЕ используется в проекте.**

### Current AI Providers (Replicate)
| Provider | Model | Cost/Photo | Status |
|----------|-------|------------|--------|
| Nano Banana Pro | google/nano-banana-pro | $0.15 | Primary |
| Flux PuLID | bytedance/flux-pulid | $0.022 | Fallback 1 |
| Flux Kontext Pro | black-forest-labs/flux-kontext-pro | $0.04 | Fallback 2 |
| Instant ID | grandlineai/instant-id-photorealistic | $0.03 | Fallback 3 |

### Fallback Configuration
```typescript
// lib/replicate/config.ts
FALLBACK_ORDER: ['nano-banana-pro', 'flux-pulid', 'flux-kontext-pro', 'instant-id']
REPLICATE_ENABLE_FALLBACK: true (default)
```

---

## 5. Critical Findings

### Security Checks Working
1. **PAYMENT_REQUIRED** - Generation blocked without payment
2. **AVATAR_NOT_FOUND** - Access control for avatars
3. **401 Unauthorized** - User endpoint requires Telegram auth
4. **Webhook signature verification** - T-Bank webhooks validated

### Issues Found
1. **Coverage thresholds not met** - tbank.ts needs more tests
2. **E2E tests assume browser context** - Some tests fail without Telegram WebApp
3. **imagen.ts not covered** - No unit tests for image generation

### Recommendations
1. Add integration tests for full payment → generation flow
2. Update E2E tests to handle Telegram-only auth
3. Add unit tests for lib/imagen.ts
4. Consider adding mock Telegram WebApp for E2E tests

---

## 6. Tier Configuration (Fixed)

| Tier | Photos | Price |
|------|--------|-------|
| starter | 7 | 499 RUB |
| standard | 15 | 999 RUB |
| premium | 23 | 1499 RUB |

**Files updated:**
- `components/views/dashboard-view.tsx` - PRICING_TIERS
- `components/persona-app.tsx` - TIER_PHOTOS
- `app/api/generate/route.ts` - maxPhotos: 23

---

## 7. Test Commands Reference

```bash
# Unit tests with coverage
npm run test:unit

# E2E against production
TEST_URL=https://www.pinglass.ru npx playwright test

# E2E smoke only
TEST_URL=https://www.pinglass.ru npx playwright test tests/e2e/smoke.spec.ts

# Payment flow tests
TEST_URL=https://www.pinglass.ru npx playwright test tests/e2e/payment/

# Full user journey
TEST_URL=https://www.pinglass.ru npx playwright test tests/e2e/critical-paths/
```

---

**Report generated:** 2025-12-21
**Environment:** Production (https://www.pinglass.ru)
**Test Framework:** Playwright 1.57.0, Jest 30.2.0
