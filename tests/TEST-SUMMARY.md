# PinGlass E2E Test Plan - Executive Summary

## Overview
Comprehensive end-to-end testing strategy for PinGlass Telegram Mini App covering complete user journeys from onboarding through photo generation.

**Full Documentation:** `tests/e2e-test-plan.md`

---

## Quick Test Coverage

### Critical User Flows (P0)
1. **New User Journey** (E2E-HP-001)
   - Onboarding → Dashboard → Upload → Tier Select → Payment → Generation → Results
   - Duration: ~15-20 minutes
   - **Pass Criteria:** All 23 photos generated successfully

2. **Returning User Journey** (E2E-HP-002)
   - Skip onboarding → View existing avatars → Create new avatar
   - **Pass Criteria:** Multiple avatars supported, no conflicts

3. **Payment Flow** (E2E-ERR-002)
   - 3 tiers: Starter (499₽), Standard (999₽), Premium (1499₽)
   - T-Bank integration with test cards
   - **Pass Criteria:** Payment succeeds, receipt sent, generation starts

4. **Telegram Integration** (E2E-ERR-004)
   - WebApp SDK loading
   - User authentication via initDataUnsafe
   - **Pass Criteria:** Auth completes within 2 seconds

---

## Test Pyramid

```
        /\
       /  \    E2E Tests (50-60 test cases)
      /____\   - Happy paths (3 suites)
     /      \  - Error handling (4 suites)
    /________\ - Edge cases (3 suites)
   Integration Tests (API endpoints)
  Unit Tests (Components, utilities)
```

---

## Key Test Scenarios

### Happy Path
- ✅ New user completes full journey
- ✅ Returning user creates additional avatar
- ✅ Payment succeeds for all 3 tiers
- ✅ Generation produces exact photo count

### Error Handling
- ❌ Upload <10 photos → Show error
- ❌ Payment fails → Allow retry
- ❌ Generation timeout → Stop polling
- ❌ Telegram SDK missing → Show error message

### Edge Cases
- 🔄 Concurrent payment attempts → Prevent duplicates
- 🔄 Page reload during generation → Resume or show status
- 🔄 Missing persona on view load → Redirect to dashboard
- 🔄 Slow network → Show loading states, don't timeout

---

## Test Environment Setup

### Prerequisites
```bash
# 1. Install Playwright
pnpm add -D @playwright/test

# 2. Create test database
createdb pinglass_test

# 3. Configure .env.test
DATABASE_URL=postgresql://...
TBANK_TERMINAL_KEY=test_terminal_key
GOOGLE_API_KEY=your_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run Tests
```bash
# All tests
pnpm test:e2e

# Specific suite
pnpm test:e2e -- tests/e2e/specs/01-onboarding.spec.ts

# Debug mode
pnpm test:e2e -- --debug

# Generate report
pnpm playwright show-report
```

---

## Test Data

### T-Bank Test Cards
- **Success:** `4111 1111 1111 1111`
- **Failure:** `5555 5555 5555 5599`
- **CVV:** Any 3 digits
- **Expiry:** Any future date

### Test Users
- **New User:** No localStorage, first launch
- **Returning User:** Has `pinglass_onboarding_complete=true`
- **Pro User:** Has avatars with generated photos

### Sample Photos
Store 14 test photos in `tests/fixtures/photos/`:
- Portraits: `portrait-1.jpg` through `portrait-14.jpg`
- File sizes: 500KB - 3MB
- Formats: JPEG, PNG

---

## Test Metrics & Goals

### Quality Gates
| Metric | Target |
|--------|--------|
| Pass Rate | >95% |
| Flaky Tests | <5% |
| Execution Time | <20 min |
| Critical Coverage | 100% (P0 tests) |
| Bug Escape Rate | <2 per release |

### Test Distribution
- **P0 Critical:** 15 tests (must pass)
- **P1 High:** 20 tests (should pass)
- **P2 Medium:** 15 tests (nice to have)
- **P3 Low:** 10 tests (exploratory)

**Total:** 60 test cases

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          TBANK_TERMINAL_KEY: ${{ secrets.TEST_TBANK_KEY }}
      - uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### Test Phases
1. **Smoke Tests (Daily):** Critical paths only (~5 min)
2. **Regression (Pre-Deploy):** All tests (~20 min)
3. **Performance (Weekly):** Load & stress tests (~30 min)
4. **Manual Exploratory (Ad-hoc):** New features, edge cases

---

## Page Object Model Structure

```
tests/e2e/
├── page-objects/
│   ├── onboarding.page.ts       # Carousel, start button
│   ├── dashboard.page.ts        # Avatar cards, create button
│   ├── upload.page.ts           # Drag-n-drop, photo previews
│   ├── tier-select.page.ts      # Pricing tiers, selection
│   ├── payment-modal.page.ts    # Email input, payment methods
│   └── results.page.ts          # Photo grid, download buttons
├── specs/
│   ├── 01-onboarding.spec.ts
│   ├── 02-upload.spec.ts
│   ├── 03-payment.spec.ts
│   ├── 04-generation.spec.ts
│   ├── 05-results.spec.ts
│   └── 06-errors.spec.ts
└── setup/
    ├── telegram-mock.ts         # Mock Telegram WebApp SDK
    ├── test-data.ts             # Fixtures (users, photos)
    └── database-helpers.ts      # Cleanup utilities
```

---

## Critical Test Flows

### Flow 1: First-Time User (E2E-HP-001)
```
ONBOARDING (3 steps)
    ↓
DASHBOARD (empty state)
    ↓
CREATE_PERSONA_UPLOAD (drag-n-drop 12 photos)
    ↓
syncPersonaToServer() → DB avatar created + R2 upload
    ↓
SELECT_TIER (choose Premium 1499₽)
    ↓
PAYMENT_MODAL (email + card selection)
    ↓
T-Bank Payment Page (test card 4111...)
    ↓
/payment/callback (poll status every 2s)
    ↓
Resume Payment (/?resume_payment=true)
    ↓
RESULTS (generate 23 photos, poll every 3s)
    ↓
DASHBOARD (avatar with "23 фото" badge)
```

**Duration:** 15-20 minutes
**Assertions:** 30+ checkpoints

---

### Flow 2: Payment Tiers (E2E-HP-003)

| Tier | Price | Photos | Price/Photo | Test Card |
|------|-------|--------|-------------|-----------|
| Starter | 499₽ | 7 | ~71₽ | 4111... |
| Standard | 999₽ | 15 | ~67₽ | 4111... |
| Premium | 1499₽ | 23 | ~65₽ | 4111... |

**Test Each Tier:**
1. Select tier in UI
2. Verify price in PaymentModal
3. Confirm T-Bank order amount
4. Validate exact photo count in generation
5. Check receipt via email

---

### Flow 3: Error Scenarios

**Upload Errors:**
- Upload 8 photos → Error: "Загрузите минимум 10 фото"
- Upload .txt file → Rejected
- Upload 25MB photo → Compressed or rejected

**Payment Errors:**
- Test card 5555... → Payment declined → Retry available
- Cancel on T-Bank → Redirect to /payment/fail
- Missing email → Button disabled
- API down → Error: "Payment system not configured"

**Generation Errors:**
- Imagen API fails for 3 photos → Show 20 photos, log errors
- Complete API failure → Status "failed", show error message
- 15-minute timeout → Stop polling, allow retry

---

## Telegram WebApp Testing

### Mock Telegram SDK
```typescript
// tests/setup/telegram-mock.ts
export class TelegramMock {
  static async initialize(page: Page, user: { userId: number, username: string }) {
    await page.addInitScript((userData) => {
      window.Telegram = {
        WebApp: {
          initData: `user=${encodeURIComponent(JSON.stringify(userData))}`,
          initDataUnsafe: {
            user: { id: userData.userId, username: userData.username }
          },
          ready: () => console.log('[TG Mock] Ready'),
          expand: () => console.log('[TG Mock] Expanded'),
          showAlert: (msg: string) => alert(msg)
        }
      }
    }, user)
  }
}
```

### Telegram-Specific Tests
- ✅ SDK loads within 2 seconds
- ✅ User ID extracted from initDataUnsafe
- ✅ Referral code from start_param
- ✅ Alerts use Telegram.WebApp.showAlert()
- ✅ Cross-device sync via telegram_user_id

---

## Security Testing Checklist

### Authentication (E2E-SEC-001)
- [ ] Telegram initData signature validated
- [ ] Users can only access own avatars
- [ ] device_id cannot access other users' data
- [ ] Invalid signatures rejected with 401

### Payment (E2E-SEC-002)
- [ ] Webhook signatures verified (SHA256)
- [ ] Client cannot tamper with pricing
- [ ] Payments logged with orderId
- [ ] No payment without valid user

### Privacy (E2E-SEC-003)
- [ ] Fiscal receipts sent (54-ФЗ)
- [ ] R2 photos stored privately
- [ ] No PII in client logs
- [ ] GDPR-compliant data handling

---

## Performance Benchmarks

### Photo Generation
- **Per Photo:** <20s average (Imagen API)
- **Total (23 photos):** <10 minutes
- **Polling Interval:** 3 seconds
- **Max Timeout:** 15 minutes

### Uploads
- **14 Photos to R2:** <30 seconds
- **Single Photo:** <3 seconds
- **Fallback to DB:** If R2 fails

### App Load
- **Initial Load:** <3s (with Turbopack)
- **Telegram SDK Ready:** <2s
- **Avatar Loading:** <5s for 10 avatars

---

## Known Limitations

### Manual Testing Required
1. Email receipt delivery (T-Bank)
2. Bank statement verification
3. Visual quality of generated photos
4. Referral reward calculations
5. Cross-browser compatibility

### Telegram Constraints
- Cannot fully simulate Mini App locally
- initData validation requires real Telegram
- Some features need actual bot deployment

---

## Maintenance Schedule

### Weekly
- [ ] Update test data for prompt changes
- [ ] Verify pricing tiers match production
- [ ] Review flaky test patterns
- [ ] Check CI/CD pipeline status

### Monthly
- [ ] Remove obsolete tests
- [ ] Refactor page objects
- [ ] Update documentation
- [ ] Audit test execution time

### Post-Release
- [ ] Analyze production errors
- [ ] Add regression tests for bugs
- [ ] Update test data with real scenarios

---

## Quick Start Guide

### 1. Setup (5 min)
```bash
git clone <repo>
cd Fotoset
pnpm install
cp .env.example .env.test
# Edit DATABASE_URL, TBANK_TERMINAL_KEY
```

### 2. Run Smoke Tests (5 min)
```bash
pnpm test:e2e -- tests/e2e/specs/01-onboarding.spec.ts
```

### 3. Full Regression (20 min)
```bash
pnpm test:e2e
```

### 4. View Results
```bash
pnpm playwright show-report
```

---

## Support & Escalation

### Test Failures
1. Check test logs in `playwright-report/`
2. Review console errors in browser
3. Verify test data is clean
4. Run single test with `--debug` flag

### Flaky Tests
1. Add retry logic (max 3 attempts)
2. Increase timeouts for slow operations
3. Add explicit waits for animations
4. Log all state changes for debugging

### Contact
- **Owner:** QA Test Engineer
- **Review Cycle:** Weekly
- **Document Version:** 1.0
- **Last Updated:** 2025-12-19

---

**Next Steps:**
1. Implement Playwright test structure
2. Create page object classes
3. Set up CI/CD pipeline
4. Run initial smoke tests
5. Iterate based on findings

**Full Details:** See `tests/e2e-test-plan.md`
