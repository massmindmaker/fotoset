# PinGlass E2E Test Plan

## Overview
Comprehensive end-to-end testing strategy for PinGlass Telegram Mini App covering all user workflows from onboarding to photo generation.

**Test Environment:** https://pinglass.ru
**Platform:** Telegram Mini App (WebApp)
**Key Flows:** Onboarding → Avatar Creation → Upload → Tier Selection → Payment → Generation → Results

---

## 1. Test Data & Configuration

### Pricing Tiers
```typescript
const PRICING_TIERS = {
  starter: { id: "starter", photos: 7, price: 499 },
  standard: { id: "standard", photos: 15, price: 999, popular: true },
  premium: { id: "premium", photos: 23, price: 1499 }
}
```

### Test Payment Cards (T-Bank Test Mode)
- **Success:** 4111 1111 1111 1111
- **Failure:** 5555 5555 5555 5599
- **CVV:** Any 3 digits
- **Expiry:** Any future date

### Test Users
- **New User:** No localStorage, no Telegram history
- **Returning User:** Has `pinglass_onboarding_complete=true`
- **Pro User:** Has avatars with generated photos
- **Telegram User:** Launched via @Pinglass_bot with initData

### Generation Styles
- **pinglass:** All 23 prompts (default premium)
- **professional:** Business portraits (Forbes/GQ style)
- **lifestyle:** Social media photos (Vogue/Elle style)
- **creative:** Artistic portraits (Harper's Bazaar style)

---

## 2. Happy Path Tests

### Test Suite 2.1: New User First-Time Journey
**ID:** E2E-HP-001
**Priority:** P0 (Critical)
**Duration:** ~15-20 minutes (with photo generation)

#### Pre-conditions
- User launches app via Telegram @Pinglass_bot
- No localStorage data
- Telegram.WebApp.initDataUnsafe.user.id available

#### Test Steps

**Step 1: Onboarding**
```gherkin
Given user opens PinGlass via Telegram
When app loads for first time
Then should display ONBOARDING view with 3-step carousel
And should show "Начать" button
And should display auth status indicator

When user clicks "Начать"
Then should call POST /api/user with telegramInitData
And should set localStorage "pinglass_onboarding_complete" = "true"
And should navigate to DASHBOARD view
And should log Telegram user ID to console
```

**Assertions:**
- [ ] Telegram SDK loads within 2 seconds
- [ ] `authStatus` changes from 'pending' → 'success'
- [ ] User record created in database with telegram_user_id
- [ ] No JavaScript errors in console
- [ ] Loading state shows before DASHBOARD

**Step 2: Avatar Creation & Photo Upload**
```gherkin
Given user is on DASHBOARD view
When user clicks "Создать первый аватар"
Then should create temporary persona with id "temp_{timestamp}"
And should navigate to CREATE_PERSONA_UPLOAD view
And should display upload zone with drag-n-drop

When user uploads 12 photos (JPEG/PNG)
Then should display 12 preview thumbnails
And should show progress indicator during upload
And each photo should be resizable with delete button

When user clicks "Продолжить" (after ≥10 photos)
Then should call syncPersonaToServer()
And should create avatar in DB via POST /api/avatars
And should upload photos to R2 via POST /api/upload (14 max)
And should save R2 URLs via POST /api/avatars/{id}/references
And should update persona.id with DB ID (numeric)
And should navigate to SELECT_TIER view with DB persona ID
```

**Assertions:**
- [ ] Minimum 10 photos required (error if < 10)
- [ ] Maximum 20 photos enforced
- [ ] Photos converted to base64 successfully
- [ ] Persona ID changes from temp_* to numeric DB ID
- [ ] Loading state shows "Сохранение..." during sync
- [ ] R2 upload completes for all photos (or fallback to DB)
- [ ] Console logs confirm avatar creation and photo upload

**Step 3: Tier Selection**
```gherkin
Given user is on SELECT_TIER view
Then should display 3 pricing tiers:
  | Tier      | Photos | Price  | Label      |
  |-----------|--------|--------|------------|
  | starter   | 7      | 499₽   | -          |
  | standard  | 15     | 999₽   | Популярный |
  | premium   | 23     | 1499₽  | -          |

And "standard" tier should be pre-selected (popular: true)

When user selects "premium" tier
Then tier should highlight with primary border
And should display checkmark icon
And button should show "Оплатить и получить 23 фото"

When user clicks "Оплатить и получить 23 фото"
Then should open PaymentModal
```

**Assertions:**
- [ ] All 3 tiers visible with correct prices
- [ ] Popular badge on "standard" tier
- [ ] Price per photo calculated correctly
- [ ] Selection state persists on tier change
- [ ] Back button returns to CREATE_PERSONA_UPLOAD

**Step 4: Payment Flow**
```gherkin
Given PaymentModal is open
Then should display:
  - Tier price (1499₽) prominently
  - "PinGlass Pro — 23 AI-фотографий" description
  - 3 payment methods: card/sbp/tpay
  - Email input field (required, red asterisk)
  - "Оплатить 1499 ₽" button (disabled if no email)

When user selects payment method "card"
Then method should highlight with primary color
And radio button should show checkmark

When user enters email "test@example.com"
Then email validation should pass (regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
And button should enable

When user clicks "Оплатить 1499 ₽"
Then should validate email is not empty
And should call POST /api/payment/create with:
  {
    "telegramUserId": 123456789,
    "deviceId": "tg_123456789",
    "email": "test@example.com",
    "paymentMethod": "card",
    "tierId": "premium",
    "photoCount": 23,
    "referralCode": undefined
  }
And should receive response:
  {
    "paymentId": "u123t1a2b3c4",
    "confirmationUrl": "https://securepay.tinkoff.ru/...",
    "testMode": true,
    "telegramUserId": 123456789
  }
And should set step = "REDIRECT"
And should redirect to confirmationUrl (T-Bank payment page)
```

**Assertions:**
- [ ] Email field is required (error if empty)
- [ ] Email validation prevents invalid formats
- [ ] Payment creation logs orderId and paymentId
- [ ] Redirect happens within 2 seconds
- [ ] Test mode badge visible if IS_TEST_MODE
- [ ] Receipt includes 54-ФЗ fiscal data

**Step 5: T-Bank Payment Page**
```gherkin
Given user is on T-Bank payment page
When user enters test card "4111 1111 1111 1111"
And enters CVV "123"
And enters expiry "12/25"
And clicks "Оплатить"
Then T-Bank should process payment
And should redirect to /payment/callback?telegram_user_id={id}&payment_id={id}
```

**Assertions:**
- [ ] T-Bank test card accepted
- [ ] No errors on payment submission
- [ ] Callback URL includes telegram_user_id parameter
- [ ] User returns to PinGlass domain

**Step 6: Payment Callback & Status Polling**
```gherkin
Given user is redirected to /payment/callback
Then should display "Проверяем оплату..." with spinner
And should extract telegram_user_id from URL params
And should poll GET /api/payment/status every 1-2 seconds

When status response returns { "paid": true }
Then should display "Оплата успешна!" with green checkmark
And should wait 2 seconds
And should redirect to "/?resume_payment=true&telegram_user_id={id}"
```

**Assertions:**
- [ ] Polling starts immediately on load
- [ ] Maximum 30 attempts (test mode) or 60 (production)
- [ ] Status "success" shows after payment confirmation
- [ ] Timeout shows "Проверить снова" button after max attempts
- [ ] telegram_user_id preserved through redirect

**Step 7: Resume Payment & Generation Start**
```gherkin
Given user returns to app with "?resume_payment=true&telegram_user_id={id}"
Then should detect resume_payment flag
And should reload avatars with URL telegram_user_id
And should find most recent draft avatar
And should set view to RESULTS with personaId
And should set isGenerating = true
And should call POST /api/generate with:
  {
    "telegramUserId": 123456789,
    "deviceId": "tg_123456789",
    "avatarId": "456",
    "styleId": "pinglass",
    "photoCount": 23,
    "useStoredReferences": true
  }

And should start polling GET /api/generate?job_id={jobId} every 3 seconds
```

**Assertions:**
- [ ] resume_payment flag detected correctly
- [ ] Avatar with draft status found
- [ ] Generation starts automatically (no manual trigger)
- [ ] Progress shows "0/23 фото"
- [ ] useStoredReferences=true (photos from R2)
- [ ] Console logs job ID and status

**Step 8: Photo Generation Progress**
```gherkin
Given generation job is running
When polling returns progress updates:
  {
    "status": "processing",
    "progress": { "completed": 5, "total": 23 },
    "photos": ["url1", "url2", ...]
  }

Then should update generationProgress state
And should display new photos in RESULTS gallery
And should update persona.generatedAssets array
And should set persona.thumbnailUrl to first photo

When all photos complete:
  {
    "status": "completed",
    "progress": { "completed": 23, "total": 23 },
    "photos": [23 URLs]
  }

Then should stop polling
And should set isGenerating = false
And should set persona.status = "ready"
And should display all 23 photos in grid
```

**Assertions:**
- [ ] Progress updates in real-time (every 3s)
- [ ] Photos appear incrementally in gallery
- [ ] Polling stops after "completed" status
- [ ] Generation completes within 15 minutes (safety timeout)
- [ ] All 23 photos have valid URLs
- [ ] Thumbnail set correctly

**Step 9: Results View**
```gherkin
Given all photos are generated
Then should display RESULTS view with:
  - 23 photos in masonry grid
  - Download button on each photo hover
  - "Назад" button to DASHBOARD
  - "Сгенерировать ещё" button

When user clicks download on photo
Then should download image with filename "pinglass-{index}.jpg"

When user clicks "Назад"
Then should navigate to DASHBOARD
And should show avatar card with thumbnail and "23 фото" badge
```

**Assertions:**
- [ ] All 23 photos render correctly
- [ ] Download works for each photo
- [ ] Photos display in high quality
- [ ] No broken image links
- [ ] Avatar status = "ready" in dashboard

---

### Test Suite 2.2: Returning User Journey
**ID:** E2E-HP-002
**Priority:** P0 (Critical)

#### Pre-conditions
- User has `pinglass_onboarding_complete=true`
- User has existing avatars in database
- Telegram authentication succeeds

#### Test Steps

**Step 1: Skip Onboarding**
```gherkin
Given user opens app with onboarding complete
When app loads
Then should detect localStorage flag OR existing avatars
And should skip ONBOARDING view
And should load avatars from server
And should navigate directly to DASHBOARD
```

**Assertions:**
- [ ] No onboarding carousel shown
- [ ] Avatars load from /api/avatars?include_photos=true
- [ ] Loading spinner shows during avatar fetch
- [ ] Dashboard shows all existing avatars

**Step 2: View Existing Avatar**
```gherkin
Given user has avatar with status="ready"
When user clicks avatar card
Then should navigate to RESULTS view
And should display all generated photos
And should allow downloads
```

**Step 3: Create New Avatar**
```gherkin
Given user is on DASHBOARD
When user clicks "Создать" button (header) or "Новый аватар" card
Then should create new temporary persona
And should navigate to CREATE_PERSONA_UPLOAD
And should follow standard upload → tier → payment flow
```

**Assertions:**
- [ ] Multiple avatars supported per user
- [ ] Each avatar has independent photo set
- [ ] No conflicts between avatar IDs

---

### Test Suite 2.3: Payment Tier Variations
**ID:** E2E-HP-003
**Priority:** P1 (High)

#### Test Cases

**Case 3A: Starter Tier (7 photos, 499₽)**
```gherkin
When user selects "starter" tier
Then payment should create order for 499₽
And generation should produce exactly 7 photos
And price per photo should be ~71₽
```

**Case 3B: Standard Tier (15 photos, 999₽)**
```gherkin
When user selects "standard" tier (popular)
Then payment should create order for 999₽
And generation should produce exactly 15 photos
And price per photo should be ~67₽
```

**Case 3C: Premium Tier (23 photos, 1499₽)**
```gherkin
When user selects "premium" tier
Then payment should create order for 1499₽
And generation should produce exactly 23 photos
And price per photo should be ~65₽
```

**Assertions:**
- [ ] PhotoCount parameter matches tier.photos
- [ ] T-Bank receipt shows correct amount
- [ ] Generation completes with exact photo count
- [ ] No partial results

---

## 3. Error Handling Tests

### Test Suite 3.1: Upload Validation
**ID:** E2E-ERR-001
**Priority:** P1 (High)

**Case 1A: Insufficient Photos**
```gherkin
Given user uploads only 8 photos
When user clicks "Продолжить"
Then should show Telegram alert "Загрузите минимум 10 фото"
And should remain on CREATE_PERSONA_UPLOAD view
And should not call syncPersonaToServer()
```

**Case 1B: Invalid File Format**
```gherkin
Given user tries to upload .txt or .pdf file
Then upload should reject with error
And should not add to preview gallery
```

**Case 1C: File Size Limit**
```gherkin
Given user uploads photo >10MB
Then should reject or compress automatically
And should log warning in console
```

**Assertions:**
- [ ] Minimum 10 photos enforced
- [ ] Only image files accepted (JPEG/PNG)
- [ ] File size validation prevents crashes

---

### Test Suite 3.2: Payment Failures
**ID:** E2E-ERR-002
**Priority:** P0 (Critical)

**Case 2A: Failed Payment Card**
```gherkin
Given user enters test card "5555 5555 5555 5599" (decline)
When T-Bank processes payment
Then should redirect to /payment/callback
And should poll status endpoint
And should timeout after 30 attempts
And should display "Оплата обрабатывается" with retry button
```

**Case 2B: User Cancels Payment**
```gherkin
Given user is on T-Bank payment page
When user clicks "Отменить" or closes browser
Then should redirect to /payment/fail
And should show error message
And should allow return to dashboard
And should NOT create generation job
```

**Case 2C: Missing Email**
```gherkin
Given PaymentModal is open
When user clicks "Оплатить" without entering email
Then button should be disabled
And should show "Введите email для получения чека" error
```

**Case 2D: Payment System Unavailable**
```gherkin
Given T-Bank API returns 503 error
When user clicks "Оплатить"
Then should show error "Payment system not configured"
And should display "Попробовать снова" button
```

**Assertions:**
- [ ] Failed payments don't grant Pro status
- [ ] User can retry payment
- [ ] Email validation prevents 54-ФЗ compliance issues
- [ ] Error messages are user-friendly (in Russian)

---

### Test Suite 3.3: Generation Failures
**ID:** E2E-ERR-003
**Priority:** P1 (High)

**Case 3A: Partial Generation Failure**
```gherkin
Given generation job fails for 3 out of 23 photos (Imagen API error)
When polling returns partial results
Then should display 20 successfully generated photos
And should log error for failed photos
And should complete with status="completed" (not failed)
```

**Case 3B: Complete Generation Failure**
```gherkin
Given Imagen API is down
When generation starts
Then should return status="failed" with error message
And should stop polling
And should show alert with error
And should allow user to retry or return to dashboard
```

**Case 3C: Generation Timeout**
```gherkin
Given generation exceeds 15 minutes
Then should stop polling (safety timeout)
And should set isGenerating = false
And should log timeout warning
```

**Assertions:**
- [ ] Partial failures don't block entire generation
- [ ] Timeouts prevent infinite polling
- [ ] Error messages explain what happened
- [ ] Users can navigate away during generation

---

### Test Suite 3.4: Telegram Integration Errors
**ID:** E2E-ERR-004
**Priority:** P0 (Critical)

**Case 4A: Telegram SDK Not Loaded**
```gherkin
Given user opens app but Telegram.WebApp is undefined
When initApp() runs
Then should wait up to 2 seconds for SDK
And should set authStatus = 'not_in_telegram'
And should display error "Откройте приложение через Telegram @Pinglass_bot"
```

**Case 4B: No Telegram User ID**
```gherkin
Given Telegram.WebApp exists but initDataUnsafe.user is undefined
Then should set authStatus = 'failed'
And should show error message
And should not proceed with user creation
```

**Case 4C: Telegram SDK Delayed Load**
```gherkin
Given SDK loads after 500ms delay
When app waits for SDK initialization
Then should detect user ID after polling interval
And should proceed with authentication
And should log "SDK ready after X ms"
```

**Assertions:**
- [ ] App gracefully handles missing Telegram context
- [ ] 2-second wait prevents false negatives
- [ ] Error messages guide user to correct entry point
- [ ] Logs help diagnose SDK issues

---

## 4. Edge Cases & Race Conditions

### Test Suite 4.1: Concurrent User Actions
**ID:** E2E-EDGE-001
**Priority:** P2 (Medium)

**Case 1A: Multiple Payment Attempts**
```gherkin
Given user clicks "Оплатить" button twice rapidly
Then should prevent duplicate payment creation
And should only create one T-Bank order
And should disable button during processing
```

**Case 1B: Navigation During Generation**
```gherkin
Given generation is in progress
When user clicks "Назад" to dashboard
Then generation should continue in background
And polling should stop (cleanup)
And dashboard should show avatar with status="processing"
```

**Case 1C: Page Reload During Generation**
```gherkin
Given generation job is running
When user refreshes page
Then should restore state from localStorage
And should resume polling if jobId exists
OR should show dashboard with processing status
```

**Assertions:**
- [ ] Duplicate submissions prevented
- [ ] Background jobs clean up properly
- [ ] State persists across refreshes

---

### Test Suite 4.2: Persona State Management
**ID:** E2E-EDGE-002
**Priority:** P2 (Medium)

**Case 2A: Deleted Persona During Upload**
```gherkin
Given user has draft persona with temp ID
When user deletes persona before syncing
Then should remove from personas array
And should redirect to DASHBOARD
And should not create DB record
```

**Case 2B: Missing Persona on View Load**
```gherkin
Given viewState references non-existent personaId
When view tries to render persona
Then should show loading spinner for 500ms
And should redirect to DASHBOARD if still missing
And should log warning in console
```

**Assertions:**
- [ ] Recovery mechanism prevents blank screens
- [ ] Deleted personas don't cause crashes
- [ ] State sync happens within 500ms grace period

---

### Test Suite 4.3: Network Resilience
**ID:** E2E-EDGE-003
**Priority:** P2 (Medium)

**Case 3A: Slow Network During Upload**
```gherkin
Given network latency is 5+ seconds
When user uploads 14 photos to R2
Then should show "Сохранение..." loading state
And should not timeout before upload completes
And should handle ECONNRESET gracefully
```

**Case 3B: Offline During Generation**
```gherkin
Given generation polling is active
When network goes offline
Then polling should fail silently
And should retry when network returns
OR should show offline indicator
```

**Assertions:**
- [ ] Upload timeout > 30 seconds for 14 photos
- [ ] Polling errors don't crash app
- [ ] Network errors logged but don't block UX

---

## 5. Cross-Device & Telegram Context Tests

### Test Suite 5.1: Telegram WebApp Features
**ID:** E2E-TG-001
**Priority:** P1 (High)

**Case 1A: Referral Code via start_param**
```gherkin
Given user opens app with t.me link containing start_param="ABC123"
When Telegram.WebApp.initDataUnsafe.start_param is read
Then should save to sessionStorage "pinglass_referral_code"
And should include in payment creation request
And should link referral in database after payment
```

**Case 1B: Telegram Alerts Instead of window.alert**
```gherkin
Given app needs to show error message
When showMessage() is called
Then should use Telegram.WebApp.showAlert() if available
And should fallback to window.alert() if not in Telegram
```

**Case 1C: Telegram Main Button**
```gherkin
Given app is in Telegram context
Then Telegram.WebApp.ready() should be called
And Telegram.WebApp.expand() should maximize viewport
And MainButton should be hidden (not used currently)
```

**Assertions:**
- [ ] Referral codes tracked correctly
- [ ] Alerts work in both Telegram and web
- [ ] Telegram UI integrations don't break web version

---

### Test Suite 5.2: Cross-Device Sync
**ID:** E2E-TG-002
**Priority:** P1 (High)

**Case 2A: Same Telegram User, Different Devices**
```gherkin
Given user with telegram_user_id=123 creates avatar on Device A
When same user opens app on Device B (different device_id)
Then should load same avatars (synced via telegram_user_id)
And should show all generated photos
And should allow creating new avatars
```

**Case 2B: Device ID Fallback (Web Users)**
```gherkin
Given user opens app in browser (not Telegram)
When no telegram_user_id available
Then should generate and store device_id in localStorage
And should use device_id for all API calls
And should support all features (except referrals)
```

**Assertions:**
- [ ] telegram_user_id is primary identifier
- [ ] device_id works as fallback
- [ ] Avatars sync across devices for Telegram users

---

## 6. Performance & Load Tests

### Test Suite 6.1: Photo Generation Performance
**ID:** E2E-PERF-001
**Priority:** P2 (Medium)

**Metrics to Track:**
- Generation time per photo: Target <20s average
- Total generation time (23 photos): Target <10 minutes
- Upload time (14 photos to R2): Target <30 seconds
- Polling frequency: 3 seconds (balance freshness vs load)

**Load Scenarios:**
```gherkin
Scenario: 10 concurrent users generating photos
  Given 10 users start generation simultaneously
  Then all jobs should complete within 15 minutes
  And API should not return 429 Too Many Requests
  And database should not hit connection limits

Scenario: Single user with slow connection
  Given network throttled to 3G speed
  When user uploads 14 photos
  Then upload should complete without timeout
  And should show progress indicator
```

---

### Test Suite 6.2: App Load Performance
**ID:** E2E-PERF-002
**Priority:** P2 (Medium)

**Metrics:**
- Initial page load: Target <3s (with Turbopack)
- Telegram SDK ready: Target <2s
- Avatar loading (include_photos=true): Target <5s for 10 avatars
- Image lazy loading: Photos should load on scroll

**Tests:**
```gherkin
When user opens dashboard with 5 avatars
Then should show placeholders immediately
And should lazy load thumbnails on viewport entry
And should not load all 115 photos upfront (5 avatars × 23 photos)
```

---

## 7. Security & Privacy Tests

### Test Suite 7.1: Authentication Security
**ID:** E2E-SEC-001
**Priority:** P0 (Critical)

**Case 1A: Telegram initData Validation**
```gherkin
Given malicious user tries to forge Telegram data
When server receives POST /api/user with invalid signature
Then should reject with 401 Unauthorized
And should log security warning
```

**Case 1B: Cross-User Data Access**
```gherkin
Given User A has telegram_user_id=111
And User B has telegram_user_id=222
When User A tries to access User B's avatars via API
Then should return 403 Forbidden or empty array
And should not expose other user's photos
```

**Assertions:**
- [ ] Server validates Telegram initData hash
- [ ] User can only access own avatars
- [ ] device_id cannot be forged to access others' data

---

### Test Suite 7.2: Payment Security
**ID:** E2E-SEC-002
**Priority:** P0 (Critical)

**Case 2A: Webhook Signature Verification**
```gherkin
Given T-Bank sends payment.succeeded webhook
When server receives POST /api/payment/webhook
Then should verify SHA256 signature with TerminalKey
And should reject unsigned or forged webhooks
```

**Case 2B: Payment Amount Tampering**
```gherkin
Given user modifies payment request to change amount client-side
When server creates payment
Then should use server-side TIER_PRICES only
And should ignore any client-provided amounts
```

**Assertions:**
- [ ] All payments verified via webhook signature
- [ ] Client cannot manipulate pricing
- [ ] Payments logged with orderId for auditing

---

### Test Suite 7.3: Data Privacy (GDPR/54-ФЗ)
**ID:** E2E-SEC-003
**Priority:** P1 (High)

**Case 3A: Fiscal Receipt Compliance**
```gherkin
Given user completes payment
Then receipt should include:
  - User email (for 54-ФЗ)
  - Service description "PinGlass - X AI фото"
  - ИП Бобров С.Н. ИНН 772790586848
  - Tax system: УСН Доходы-Расходы
And should send to email via T-Bank
```

**Case 3B: Photo Storage Privacy**
```gherkin
Given user uploads reference photos to R2
Then photos should be stored with private ACL
And URLs should be signed/temporary (or behind auth)
And photos should not be publicly listable
```

**Assertions:**
- [ ] Receipts sent to all paying users
- [ ] Uploaded photos not publicly accessible
- [ ] No PII logged to client console

---

## 8. UI/UX & Accessibility Tests

### Test Suite 8.1: Responsive Design
**ID:** E2E-UX-001
**Priority:** P2 (Medium)

**Devices to Test:**
- Mobile: iPhone 13 (390×844), Android (360×740)
- Tablet: iPad (768×1024)
- Desktop: 1920×1080

**Cases:**
```gherkin
Scenario: Mobile layout
  Given viewport width 390px
  Then payment modal should be full-screen bottom sheet
  And tier cards should stack vertically
  And header should show compact logo
  And footer should adjust to safe-area-inset-bottom

Scenario: Desktop layout
  Given viewport width 1920px
  Then content should center with max-width 5xl (1024px)
  And photo grid should show 4-5 columns
  And modals should not be full-screen
```

---

### Test Suite 8.2: Dark/Light Theme
**ID:** E2E-UX-002
**Priority:** P2 (Medium)

**Tests:**
```gherkin
When user toggles theme button
Then document.documentElement should toggle "light" class
And localStorage "pinglass_theme" should update
And all components should switch colors
And theme should persist on page reload
```

---

### Test Suite 8.3: Keyboard Navigation
**ID:** E2E-UX-003
**Priority:** P3 (Low)

**Tests:**
```gherkin
When user navigates with Tab key
Then all interactive elements should be focusable
And focus ring should be visible (outline)
And modal close should work with Escape key
```

---

## 9. Automated Test Implementation

### Recommended Tools
1. **Playwright** - Primary E2E framework
2. **Telegram Bot API** - For simulating Telegram context
3. **Neon DB** - Test database instance
4. **T-Bank Sandbox** - Test payment environment

### Test Structure
```
tests/
├── e2e/
│   ├── setup/
│   │   ├── telegram-mock.ts      # Mock Telegram WebApp SDK
│   │   ├── test-data.ts          # Fixtures (users, photos, tiers)
│   │   └── database-helpers.ts   # DB cleanup utilities
│   ├── specs/
│   │   ├── 01-onboarding.spec.ts
│   │   ├── 02-upload.spec.ts
│   │   ├── 03-payment.spec.ts
│   │   ├── 04-generation.spec.ts
│   │   ├── 05-results.spec.ts
│   │   └── 06-errors.spec.ts
│   ├── page-objects/
│   │   ├── onboarding.page.ts
│   │   ├── dashboard.page.ts
│   │   ├── upload.page.ts
│   │   ├── tier-select.page.ts
│   │   ├── payment-modal.page.ts
│   │   └── results.page.ts
│   └── helpers/
│       ├── telegram.ts           # Telegram SDK helpers
│       ├── payment.ts            # T-Bank test helpers
│       └── assertions.ts         # Custom matchers
```

### Sample Playwright Test
```typescript
// tests/e2e/specs/01-onboarding.spec.ts
import { test, expect } from '@playwright/test'
import { TelegramMock } from '../setup/telegram-mock'
import { OnboardingPage } from '../page-objects/onboarding.page'

test.describe('New User Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Telegram WebApp mock
    await TelegramMock.initialize(page, {
      userId: 123456789,
      username: 'testuser'
    })
  })

  test('E2E-HP-001: Complete first-time user journey', async ({ page }) => {
    const onboarding = new OnboardingPage(page)

    // Step 1: Load app and see onboarding
    await page.goto('/')
    await expect(onboarding.carousel).toBeVisible()
    await expect(onboarding.startButton).toBeEnabled()

    // Step 2: Start onboarding
    await onboarding.clickStart()

    // Step 3: Verify navigation to dashboard
    await expect(page).toHaveURL(/dashboard/)
    await expect(page.locator('h1')).toContainText('Мои аватары')

    // Step 4: Verify localStorage
    const onboardingComplete = await page.evaluate(() =>
      localStorage.getItem('pinglass_onboarding_complete')
    )
    expect(onboardingComplete).toBe('true')
  })
})
```

---

## 10. Test Execution Plan

### Test Phases

**Phase 1: Smoke Tests (Daily)**
- E2E-HP-001: New user journey
- E2E-HP-002: Returning user journey
- E2E-ERR-002: Payment failures
- E2E-SEC-001: Auth security

**Phase 2: Regression (Pre-Deploy)**
- All Happy Path tests
- All Error Handling tests
- Payment tier variations
- Telegram integration tests

**Phase 3: Performance (Weekly)**
- E2E-PERF-001: Generation performance
- E2E-PERF-002: App load performance
- Load testing with 10+ concurrent users

**Phase 4: Manual Exploratory (Ad-hoc)**
- New features
- UI/UX validation
- Cross-browser testing
- Accessibility audit

### CI/CD Integration
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: pnpm install
      - name: Run Playwright tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          TBANK_TERMINAL_KEY: ${{ secrets.TEST_TBANK_KEY }}
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 11. Test Data Management

### Sample Test Photos
Store in `tests/fixtures/photos/`:
- `portrait-1.jpg` through `portrait-14.jpg`
- Various aspect ratios (3:4, 1:1, 16:9)
- File sizes: 500KB - 3MB
- Formats: JPEG, PNG

### Database Cleanup Strategy
```typescript
// tests/setup/database-helpers.ts
export async function cleanupTestData(telegramUserId: number) {
  await sql`DELETE FROM generated_photos WHERE avatar_id IN (
    SELECT id FROM avatars WHERE user_id IN (
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    )
  )`
  await sql`DELETE FROM avatars WHERE user_id IN (
    SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
  )`
  await sql`DELETE FROM payments WHERE user_id IN (
    SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
  )`
  await sql`DELETE FROM users WHERE telegram_user_id = ${telegramUserId}`
}
```

---

## 12. Success Criteria

### Quality Gates
- **Pass Rate:** >95% on main branch
- **Flaky Test Rate:** <5% of total suite
- **Execution Time:** Full suite <20 minutes
- **Coverage:** All critical paths (P0/P1) covered
- **Bug Escape Rate:** <2 critical bugs per release

### Test Metrics Dashboard
Track in CI/CD:
- Total tests: ~50-60 test cases
- P0 Critical: 15 tests (must pass)
- P1 High: 20 tests (should pass)
- P2 Medium: 15 tests (nice to have)
- P3 Low: 10 tests (exploratory)

---

## 13. Known Limitations & Exclusions

### Out of Scope (Manual Testing Only)
1. **Email Delivery:** T-Bank sends receipts (verify manually)
2. **Bank Statement Verification:** Real payment flow confirmation
3. **Image Quality Assessment:** Visual inspection of generated photos
4. **Referral Rewards:** Multi-user referral chain testing
5. **Browser Compatibility:** Chrome only (Playwright default)

### Telegram-Specific Constraints
- Cannot fully simulate Telegram Mini App environment locally
- initData validation requires real Telegram backend
- Some tests require actual @Pinglass_bot deployment

---

## 14. Test Maintenance

### Weekly Review
- Update test data if prompts change
- Verify payment tiers match pricing
- Check for new error scenarios
- Review flaky test patterns

### Monthly Audit
- Remove obsolete tests
- Refactor duplicated code
- Update page objects for UI changes
- Validate test execution time

### Post-Release
- Analyze production errors
- Add regression tests for bugs
- Update documentation with new flows

---

## Appendix A: Test Environment Setup

### Local Testing
```bash
# 1. Install dependencies
pnpm install

# 2. Set up test database
createdb pinglass_test
pnpm drizzle-kit push --config drizzle.config.test.ts

# 3. Configure environment
cp .env.example .env.test
# Edit: DATABASE_URL, TBANK_TERMINAL_KEY (test), GOOGLE_API_KEY

# 4. Run tests
pnpm test:e2e

# 5. View report
pnpm playwright show-report
```

### Telegram Bot Setup
1. Create test bot via @BotFather
2. Set webhook: `https://pinglass.ru/api/telegram/webhook`
3. Add bot to test group
4. Use bot link with start_param for referrals

---

## Appendix B: Troubleshooting Guide

### Common Issues

**Issue:** Telegram SDK not loading
- **Solution:** Check `window.Telegram?.WebApp` in console, verify script tag in layout.tsx

**Issue:** Payment webhook not firing
- **Solution:** Verify T-Bank notification URL, check server logs, confirm signature validation

**Issue:** Photos not uploading to R2
- **Solution:** Check Cloudflare R2 credentials, verify CORS settings, test /api/upload directly

**Issue:** Generation timeout
- **Solution:** Check Imagen API quota, verify YeScale proxy status, review API logs

---

**Document Version:** 1.0
**Last Updated:** 2025-12-19
**Owner:** QA Test Engineer
**Review Cycle:** Weekly
