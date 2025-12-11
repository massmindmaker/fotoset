# PinGlass Testing Setup Guide

## Installation

1. **Install Playwright:**
   ```bash
   pnpm add -D @playwright/test@^1.49.0
   pnpm exec playwright install
   ```

2. **Update package.json scripts:**
   Add the following to your `package.json` under `"scripts"`:
   ```json
   "test": "playwright test",
   "test:headed": "playwright test --headed",
   "test:ui": "playwright test --ui",
   "test:debug": "playwright test --debug",
   "test:report": "playwright show-report test-reports/playwright-html",
   "test:api": "playwright test tests/e2e/pinglass-api.spec.ts",
   "test:flow": "playwright test tests/e2e/pinglass-user-flow.spec.ts",
   "test:production": "TEST_URL=https://www.pinglass.ru playwright test",
   "test:local": "TEST_URL=http://localhost:3000 playwright test",
   "test:chrome": "playwright test --project=chromium",
   "test:firefox": "playwright test --project=firefox",
   "test:safari": "playwright test --project=webkit",
   "test:mobile": "playwright test --project=mobile-chrome --project=mobile-safari"
   ```

## Running Tests

### Against Production
```bash
pnpm test:production
```

### Against Local Development
```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Run tests
pnpm test:local
```

### Specific Test Suites
```bash
# API endpoint tests only
pnpm test:api

# User flow tests only
pnpm test:flow
```

### Interactive UI Mode
```bash
pnpm test:ui
```

### Debug Mode
```bash
pnpm test:debug
```

### Specific Browsers
```bash
pnpm test:chrome
pnpm test:firefox
pnpm test:safari
pnpm test:mobile
```

## Test Structure

```
tests/
├── e2e/
│   ├── page-objects/
│   │   └── PersonaPage.ts          # Page Object Model
│   ├── pinglass-user-flow.spec.ts  # E2E user journey tests
│   └── pinglass-api.spec.ts        # API integration tests
└── fixtures/
    └── test-photos/                # Sample test images
        └── README.md
```

## Test Coverage

### User Flow Tests (pinglass-user-flow.spec.ts)

1. **First-Time User Journey**
   - Onboarding flow (3-step carousel)
   - Photo upload (10-20 images)
   - Style selection (Professional/Lifestyle/Creative)

2. **Payment Flow**
   - Payment modal display for non-Pro users
   - Payment creation and redirect to T-Bank
   - Pro status update after successful payment

3. **Photo Generation Flow**
   - Generation initiation for Pro users
   - Progress indicator display
   - Results gallery with 23 photos
   - Photo download functionality

4. **Returning User (Pro)**
   - Dashboard display (skip onboarding)
   - Existing personas list
   - New persona creation

5. **Error Handling**
   - API error responses
   - Network timeouts
   - Partial generation failures

6. **Console & Errors**
   - JavaScript error detection
   - Network error detection

7. **Accessibility**
   - Keyboard navigation
   - Screen reader compatibility

8. **Performance**
   - Page load time
   - Core Web Vitals (LCP, FCP)

### API Tests (pinglass-api.spec.ts)

1. **POST /api/user**
   - Create new user
   - Retrieve existing user
   - Validation errors

2. **POST /api/payment/create**
   - Create payment order
   - Error handling
   - T-Bank integration

3. **GET /api/payment/status**
   - Check payment status
   - Parameter validation

4. **POST /api/generate**
   - Pro user access control
   - Field validation
   - Style ID validation
   - Reference image validation

5. **POST /api/payment/webhook**
   - T-Bank signature validation
   - Payment status updates

6. **Security Tests**
   - No sensitive data in errors
   - SQL injection prevention
   - XSS prevention

7. **Performance Tests**
   - Response time benchmarks

## Adding Test Photos

Create sample photos in `tests/fixtures/test-photos/`:

```bash
# Download sample portraits
curl https://picsum.photos/1024/1024 > tests/fixtures/test-photos/photo-1.jpg
# Repeat for photo-2.jpg through photo-20.jpg
```

Or use AI-generated faces:
```bash
curl https://thispersondoesnotexist.com > tests/fixtures/test-photos/photo-1.jpg
```

## Configuration

Edit `playwright.config.ts` to customize:

- `timeout`: Test timeout duration
- `retries`: Number of retries on failure
- `workers`: Parallel test execution
- `use.baseURL`: Target URL for tests
- `projects`: Browser configurations

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Run tests
        run: pnpm test:production
        env:
          TEST_URL: https://www.pinglass.ru

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: test-reports/
```

## Troubleshooting

### Tests fail with "baseURL not set"
- Ensure `TEST_URL` environment variable is set
- Or update `playwright.config.ts` with default `baseURL`

### Photo upload tests fail
- Add sample images to `tests/fixtures/test-photos/`
- Ensure images are in JPEG/PNG format

### API tests fail with 401/403
- Check environment variables are set correctly
- Verify database is accessible
- Ensure test device IDs don't conflict

### Timeout errors
- Increase timeout in `playwright.config.ts`
- Check network connectivity to test URL
- Verify target server is running

## Best Practices

1. **Use Page Object Model** - Encapsulate selectors and interactions
2. **Explicit Waits** - Use `waitForLoadState`, `waitForSelector` instead of `setTimeout`
3. **Test Isolation** - Each test should be independent
4. **Mock External APIs** - Use `page.route()` for external dependencies
5. **Descriptive Test Names** - Clearly state what is being tested
6. **Clean Up** - Remove test data after tests complete

## Next Steps

1. Add `data-testid` attributes to components for stable selectors
2. Implement visual regression testing
3. Add performance benchmarking
4. Set up continuous monitoring in production
5. Create unit tests for individual components
