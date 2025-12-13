# PinGlass Comprehensive Test Plan

## Executive Summary

**Testing Framework:** Playwright (E2E), Jest (Unit), React Testing Library (Component)
**Target Coverage:** >80% for critical paths, >60% overall
**Pass Rate Goal:** >95% in CI
**Execution Time:** <10 minutes for full suite

---

## 1. Critical User Paths (E2E Tests)

### Priority 1: Revenue-Critical Paths

#### Path 1: First-Time User → Payment → Generation
**Test:** `tests/e2e/critical-paths/full-user-journey.spec.ts`

**Steps:**
1. Land on homepage (first-time user)
2. Complete onboarding (3 steps)
3. Upload 10-20 photos
4. Select style (Professional/Lifestyle/Creative)
5. Encounter payment modal
6. Complete T-Bank payment
7. Wait for generation (23 photos)
8. View results gallery
9. Download photos

**Success Criteria:**
- All steps complete without errors
- Payment webhook processed
- 23 photos generated
- Photos downloadable

**Flaky Prevention:**
- Explicit waits for payment redirect
- Polling for payment status (not fixed timeout)
- Retry on network errors (generation API)
- Screenshot on each critical step

#### Path 2: Returning Pro User → Quick Generation
**Test:** `tests/e2e/critical-paths/returning-user.spec.ts`

**Steps:**
1. Load app with Pro status in localStorage
2. Skip onboarding → Dashboard
3. Create new persona
4. Upload photos
5. Select style
6. Immediate generation (no payment)
7. View results

**Success Criteria:**
- No payment modal shown
- Dashboard displays existing personas
- Generation starts immediately
- Results accessible

---

### Priority 2: Payment Flow (Revenue Protection)

#### Test Suite: `tests/e2e/payment/payment-flow.spec.ts`

**Tests:**
1. **Payment Modal Display**
   - Trigger: Non-pro user selects style
   - Verify: Modal shows 500₽ offer, features list

2. **T-Bank Integration**
   - Click payment button
   - Verify: POST to `/api/payment/create`
   - Verify: Redirect to T-Bank URL
   - Mock: Payment success callback

3. **Payment Status Polling**
   - After callback return
   - Poll `/api/payment/status` every 2s
   - Stop when `isPro: true`
   - Update localStorage

4. **Payment Failure Handling**
   - Mock: Payment canceled
   - Verify: User returned to app
   - Verify: Can retry payment

5. **Webhook Processing**
   - Mock: T-Bank webhook `payment.succeeded`
   - Verify: User Pro status updated in DB
   - Verify: Payment record created

**Edge Cases:**
- Network timeout during payment
- User closes payment window
- Duplicate webhook delivery
- Invalid signature verification

---

### Priority 3: Photo Upload & Validation

#### Test Suite: `tests/e2e/upload/photo-upload.spec.ts`

**Tests:**
1. **Upload Minimum (10 photos)**
   - Upload exactly 10 photos
   - Verify: Next button enabled

2. **Upload Maximum (20 photos)**
   - Upload 20 photos
   - Verify: Upload disabled or warning shown

3. **Upload Below Minimum**
   - Upload 5 photos
   - Verify: Next button disabled
   - Verify: Error message displayed

4. **Photo Preview & Deletion**
   - Upload photos
   - Delete specific photo
   - Verify: Count updates
   - Verify: Next button state updates

5. **File Type Validation**
   - Upload invalid file (PDF, TXT)
   - Verify: Error message
   - Verify: File rejected

6. **File Size Validation**
   - Upload oversized image (>10MB)
   - Verify: Error or compression warning

7. **Drag & Drop**
   - Simulate drag-and-drop upload
   - Verify: Photos added to list

8. **Progress Indicator**
   - Upload multiple files
   - Verify: Progress bar visible during upload

---

### Priority 4: AI Generation

#### Test Suite: `tests/e2e/generation/ai-generation.spec.ts`

**Tests:**
1. **Generation Start**
   - Trigger: Pro user selects style
   - Verify: POST to `/api/generate`
   - Verify: Payload contains deviceId, avatarId, styleId, references

2. **Progress Indicator**
   - Verify: Generating spinner visible
   - Verify: Progress updates (if implemented)

3. **Generation Complete (23 photos)**
   - Wait for completion (timeout: 10 min)
   - Verify: 23 photos in results
   - Verify: All URLs valid

4. **Partial Generation Failure**
   - Mock: Only 15/23 photos generated
   - Verify: User sees available photos
   - Verify: Warning about missing photos

5. **Complete Generation Failure**
   - Mock: API error during generation
   - Verify: Error message displayed
   - Verify: User can retry

6. **Generation Timeout**
   - Mock: Very slow API (>10 min)
   - Verify: Timeout error
   - Verify: User can leave page and return

---

## 2. API Integration Tests

### Test Suite: `tests/e2e/pinglass-api.spec.ts` (EXISTING - Enhanced)

**Coverage:**
- All API endpoints (user, payment, generate, webhooks)
- Error handling (400, 403, 500)
- Security (SQL injection, XSS, signature validation)
- Performance (<1s for user API, <500ms for status checks)
- Rate limiting (if implemented)

**Additions Needed:**
- Test Telegram integration endpoints
- Test referral system APIs
- Test file upload endpoint

---

## 3. Component Unit Tests (React Testing Library + Jest)

### 3.1 PersonaApp Component

**File:** `tests/unit/components/persona-app.test.tsx`

**Tests:**
1. **Initial Render**
   - First-time user: Shows onboarding
   - Returning user (not Pro): Shows dashboard
   - Returning user (Pro): Shows dashboard

2. **View State Management**
   - Transitions: ONBOARDING → UPLOAD → STYLE → GENERATING → RESULTS
   - State persistence in localStorage

3. **Pro Status Logic**
   - Non-pro triggers payment modal
   - Pro bypasses payment
   - Pro status read from localStorage

4. **Device ID Generation**
   - Creates device ID on first load
   - Persists across sessions
   - Uses existing ID if present

5. **Error Boundaries**
   - API errors display user-friendly messages
   - Component doesn't crash on unexpected data

---

### 3.2 PaymentModal Component

**File:** `tests/unit/components/payment-modal.test.tsx`

**Tests:**
1. **Modal Display States**
   - OFFER: Shows features list, price, pay button
   - PROCESSING: Shows loading spinner
   - SUCCESS: Shows success message
   - ERROR: Shows error message with retry

2. **Payment Initiation**
   - Click pay button → Calls `/api/payment/create`
   - Receives paymentId and confirmationUrl
   - Opens redirect in new window/tab

3. **Status Polling**
   - Starts polling after redirect
   - Polls every 2s
   - Stops when isPro = true
   - Updates parent component

4. **Error Handling**
   - Network error: Shows retry option
   - Payment canceled: Returns to offer state
   - Invalid response: Shows error message

5. **Accessibility**
   - Modal traps focus
   - ESC key closes modal
   - Proper ARIA labels

---

### 3.3 Upload View Component

**File:** `tests/unit/components/views/upload-view.test.tsx`

**Tests:**
1. **File Input Handling**
   - Multiple file selection
   - Drag-and-drop simulation
   - File count validation (10-20)

2. **Photo Preview**
   - Displays thumbnails
   - Shows delete button per photo
   - Updates count on deletion

3. **Progress Indicator**
   - Shows during upload
   - Hides when complete
   - Shows percentage (if implemented)

4. **Next Button State**
   - Disabled when <10 photos
   - Enabled when 10-20 photos
   - Disabled when >20 photos

---

### 3.4 Results Gallery Component

**File:** `tests/unit/components/results-gallery.test.tsx`

**Tests:**
1. **Photo Grid Display**
   - Renders 23 photos
   - Responsive grid layout
   - Lazy loading for performance

2. **Photo Download**
   - Individual photo download
   - Download all (ZIP)
   - Filename format

3. **Image Loading States**
   - Skeleton/placeholder while loading
   - Error state for failed loads
   - Retry for failed images

4. **Generate More Action**
   - Button visible after results
   - Navigates back to style selection
   - Preserves uploaded photos

---

## 4. Library/Utility Unit Tests

### 4.1 T-Bank Payment Library

**File:** `tests/unit/lib/tbank.test.ts`

**Tests:**
1. **Signature Generation**
   - `generateSignature()` produces correct SHA256
   - Matches T-Bank's expected format
   - Handles all parameter types

2. **Signature Verification**
   - `verifySignature()` validates webhook signatures
   - Rejects invalid signatures
   - Handles missing Token parameter

3. **Payment Initialization**
   - `initPayment()` creates payment order
   - Sends correct parameters to T-Bank API
   - Returns paymentId and confirmationUrl

4. **Payment Status Check**
   - `getPaymentStatus()` retrieves status
   - Parses response correctly
   - Handles API errors

5. **Test Mode Detection**
   - Uses test credentials when env vars missing
   - Flags testMode: true in responses

---

### 4.2 Google Imagen Library

**File:** `tests/unit/lib/imagen.test.ts`

**Tests:**
1. **API Client Initialization**
   - Uses GOOGLE_API_KEY from env
   - Throws error if key missing

2. **Generate Image Function**
   - `generateImage()` sends correct prompt
   - Includes reference images
   - Returns image URL or base64

3. **Batch Generation**
   - `generateBatch()` handles 23 prompts
   - Continues on individual failures
   - Returns successful results + errors list

4. **Error Handling**
   - Network errors retry 3x
   - API quota errors surface to user
   - Invalid response format handled

5. **Rate Limiting Respect**
   - Doesn't exceed API rate limits
   - Implements backoff on 429 errors

---

### 4.3 Database Client

**File:** `tests/unit/lib/db.test.ts`

**Tests:**
1. **Connection Pool**
   - Uses Neon serverless driver
   - Handles connection errors gracefully

2. **User CRUD**
   - `createUser()` inserts new user
   - `getUserByDeviceId()` retrieves existing
   - Handles duplicate device IDs

3. **Avatar CRUD**
   - `createAvatar()` inserts avatar
   - `getAvatarsByUserId()` lists user's avatars
   - `updateAvatarStatus()` transitions states

4. **Payment Records**
   - `createPayment()` inserts payment
   - `updatePaymentStatus()` updates on webhook
   - Links to user correctly

5. **Generated Photos**
   - `saveGeneratedPhotos()` bulk inserts 23 URLs
   - Associates with avatarId
   - Stores style and prompt metadata

6. **SQL Injection Protection**
   - Parameterized queries only
   - No string concatenation in queries
   - Tests with malicious inputs

---

### 4.4 Prompts Library

**File:** `tests/unit/lib/prompts.test.ts`

**Tests:**
1. **Prompt Count**
   - Exactly 23 prompts defined
   - All prompts are strings
   - No empty prompts

2. **Style Configurations**
   - Professional: Correct prompt indices
   - Lifestyle: Correct prompt indices
   - Creative: Correct prompt indices

3. **Prompt Quality**
   - No duplicates
   - All include style-specific keywords
   - Reasonable length (not too short/long)

---

### 4.5 Image Utilities

**File:** `tests/unit/lib/image-utils.test.ts`

**Tests:**
1. **Base64 Encoding**
   - `fileToBase64()` converts correctly
   - Handles different formats (JPG, PNG)

2. **Image Compression**
   - `compressImage()` reduces file size
   - Maintains acceptable quality
   - Respects max dimensions

3. **URL Validation**
   - `isValidImageUrl()` validates URLs
   - Rejects non-image URLs
   - Handles edge cases (data URLs, etc.)

---

## 5. Integration Tests

### 5.1 Full API Flow

**File:** `tests/integration/full-api-flow.test.ts`

**Test:**
1. Create user via `/api/user`
2. Create payment via `/api/payment/create`
3. Simulate webhook to `/api/payment/webhook`
4. Verify user isPro updated
5. Upload photos via `/api/upload`
6. Trigger generation via `/api/generate`
7. Wait for job completion
8. Verify 23 photos saved to DB

**Environment:** Requires real database (test DB)

---

### 5.2 Payment Webhook → Generation Flow

**File:** `tests/integration/payment-to-generation.test.ts`

**Test:**
1. Non-pro user attempts generation → 403
2. Process payment webhook → user becomes Pro
3. Same user attempts generation → Success
4. Verify generation job created

---

## 6. CI/CD Pipeline Configuration

### 6.1 GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

**Stages:**
1. **Lint & Type Check** (1-2 min)
   - ESLint
   - TypeScript compilation
   - No runtime required

2. **Unit Tests** (2-3 min)
   - Jest with React Testing Library
   - No external dependencies
   - Parallel execution

3. **Integration Tests** (3-4 min)
   - Requires test database
   - Seed with test data
   - Sequential execution

4. **E2E Tests** (5-10 min)
   - Playwright on 3 browsers (Chromium, Firefox, WebKit)
   - Parallel execution per browser
   - Video recording on failure
   - Screenshots on failure

5. **Test Report Generation** (1 min)
   - HTML report published to GitHub Pages
   - JUnit XML for CI integration
   - Coverage report (Codecov integration)

**Total Estimated Time:** 12-20 minutes

**Optimizations:**
- Cache node_modules
- Cache Playwright browsers
- Run unit tests in parallel with lint
- Skip E2E on draft PRs

---

### 6.2 Test Environment Setup

**Requirements:**
- Test database (Neon branch or local Postgres)
- Mock T-Bank API (avoid real payments in tests)
- Mock Google Imagen API (avoid costs)
- Test localStorage (JSDOM)

**Environment Variables:**
```env
# CI Test Environment
DATABASE_URL=postgresql://test_db...
GOOGLE_API_KEY=test_key_mock
TBANK_TERMINAL_KEY=test_terminal
TBANK_PASSWORD=test_password
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=test
```

---

## 7. Test Data & Fixtures

### 7.1 Test Photos

**Location:** `tests/fixtures/test-photos/`

**Contents:**
- 20 sample portrait photos (various genders, ages, ethnicities)
- Different formats: JPG, PNG
- Different sizes: small (<1MB), medium (2-5MB), large (>5MB)
- Edge cases: very low resolution, very high resolution

### 7.2 Mock API Responses

**Location:** `tests/fixtures/api-responses/`

**Files:**
- `user-response.json`: Sample user object
- `payment-create-response.json`: Sample payment response
- `payment-webhook-success.json`: Sample webhook payload
- `generate-response-success.json`: 23 photo URLs
- `generate-response-partial.json`: Only 15 photos

### 7.3 Database Seeds

**Location:** `tests/fixtures/db-seeds/`

**Seeds:**
- `users.sql`: 10 test users (5 pro, 5 non-pro)
- `avatars.sql`: 20 test avatars with various statuses
- `generated_photos.sql`: Sample generated photos

---

## 8. Flaky Test Prevention Strategy

### Known Flaky Patterns

#### Pattern 1: Payment Redirect Race Condition
**Problem:** Test clicks pay button, but redirect happens before event listener attached

**Solution:**
```typescript
// Bad
await paymentButton.click();
const popup = await context.waitForEvent('page'); // Might miss it

// Good
const popupPromise = context.waitForEvent('page'); // Promise created first
await paymentButton.click();
const popup = await popupPromise; // Then wait
```

#### Pattern 2: Generation Polling Timeout
**Problem:** Fixed 60s timeout too short for real API

**Solution:**
- Use exponential backoff: 2s, 4s, 8s, 16s intervals
- Max timeout: 10 minutes
- Check for explicit "completed" status, not just timeout

#### Pattern 3: Network-Dependent Tests
**Problem:** Tests fail on slow networks

**Solution:**
- Mock all external APIs in unit tests
- Use `page.waitForLoadState('networkidle')` in E2E
- Increase timeout for known slow operations
- Retry 2x on network failures in CI

#### Pattern 4: Animation-Dependent Clicks
**Problem:** Click on element before CSS animation completes

**Solution:**
```typescript
// Bad
await button.click(); // Might be transitioning

// Good
await expect(button).toBeVisible();
await expect(button).toBeEnabled();
await button.click({ force: false }); // Wait for actionable
```

---

## 9. Test Coverage Goals

| Component/Library | Target Coverage | Priority |
|-------------------|-----------------|----------|
| Payment flow (E2E + Unit) | 95% | Critical |
| Generation API | 90% | Critical |
| Upload component | 85% | High |
| T-Bank library | 95% | Critical |
| Imagen library | 90% | High |
| Database queries | 80% | High |
| UI components | 70% | Medium |
| Utilities | 60% | Medium |

**Overall Target:** >80% critical paths, >60% overall

---

## 10. Test Execution Strategy

### Local Development
```bash
# Unit tests (fast feedback)
npm run test:unit

# Unit tests in watch mode
npm run test:unit:watch

# E2E tests (headed mode for debugging)
npm run test:e2e:headed

# Specific test file
npx jest tests/unit/lib/tbank.test.ts
npx playwright test tests/e2e/payment/payment-flow.spec.ts
```

### Pre-Commit
```bash
# Run lint + unit tests (fast)
npm run test:pre-commit
```

### Pre-Push
```bash
# Run all tests except slow E2E
npm run test:pre-push
```

### CI (Pull Request)
```bash
# Run everything
npm run test:ci
```

### Nightly / Weekly
```bash
# Extended E2E suite with multiple browsers and devices
npm run test:e2e:full
```

---

## 11. Test Maintenance

### Test Review Checklist
- [ ] Test names describe behavior, not implementation
- [ ] Each test is independent (no shared state)
- [ ] Tests use Page Object Model for E2E
- [ ] No hardcoded timeouts (use explicit waits)
- [ ] Mock external APIs in unit tests
- [ ] Clean up test data after integration tests
- [ ] Screenshot/video on failure
- [ ] Test covers happy path + edge cases

### Quarterly Test Audit
- Review flaky test rate (should be <5%)
- Remove obsolete tests
- Update fixtures to match production data
- Review coverage gaps
- Update test documentation

---

## 12. Metrics & Reporting

### CI Metrics to Track
1. **Pass Rate:** % of test runs that pass all tests
   - Goal: >95%

2. **Flaky Test Rate:** % of tests that fail intermittently
   - Goal: <5%

3. **Execution Time:** Time to run full suite
   - Goal: <10 minutes

4. **Coverage:** % of code covered by tests
   - Goal: >80% critical paths

5. **Mean Time to Detect (MTTD):** Time from bug introduction to test failure
   - Goal: <1 hour (detect in CI before merge)

### Reporting
- **HTML Report:** Published to GitHub Pages on each CI run
- **Slack Notifications:** Post failures to #engineering channel
- **Weekly Summary:** Email with pass rate, flaky tests, new failures

---

## 13. Next Steps

### Immediate (Week 1)
1. ✅ Review existing E2E tests (completed)
2. ⬜ Add missing E2E tests for Telegram integration
3. ⬜ Add missing E2E tests for referral system
4. ⬜ Create unit tests for `tbank.ts`
5. ⬜ Create unit tests for `imagen.ts`

### Short-Term (Month 1)
1. ⬜ Achieve 80% coverage on critical paths
2. ⬜ Set up CI/CD pipeline in GitHub Actions
3. ⬜ Create test fixtures and seeds
4. ⬜ Implement auto-healing for known flaky patterns

### Long-Term (Quarter 1)
1. ⬜ Integrate visual regression testing (Percy/Chromatic)
2. ⬜ Add performance testing (Lighthouse CI)
3. ⬜ Set up synthetic monitoring (Datadog/New Relic)
4. ⬜ Implement chaos engineering tests

---

**Version:** 1.0
**Last Updated:** 2025-12-12
**Owner:** QA Team
