# Testing Quick Start Guide - PinGlass

Quick reference for running and implementing tests in the PinGlass project.

---

## Running Existing Tests

### Unit Tests (API Routes, Business Logic)
```bash
# Run all unit tests
npm run test:unit

# Run with coverage report
npm run test:unit -- --coverage

# Run specific test file
npm run test:unit -- tests/unit/api/payment/webhook.test.ts

# Watch mode
npm run test:unit -- --watch
```

### Integration Tests (Database, Payment Flows)
```bash
# Run integration tests
npm run test:integration

# Single test file
npm run test:integration -- tests/integration/payment-generation-flow.test.ts
```

### E2E Tests (Playwright)
```bash
# Run all E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test
npm run test:e2e -- tests/e2e/critical-paths/full-user-journey.spec.ts

# Run on production
TEST_URL=https://www.pinglass.ru npm run test:e2e

# Debug mode
npx playwright test --debug
```

### Load Tests (k6)
```bash
# Standard load test
npm run test:load

# Stress test
npm run test:stress

# Smoke test
npm run test:smoke
```

---

## Implementing Component Tests (NEW)

### Step 1: Install Dependencies
```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

### Step 2: Create Test File
```bash
# Create test directory
mkdir -p components/__tests__

# Create test file
touch components/__tests__/persona-app.test.tsx
```

### Step 3: Copy Example Test
```bash
# Use provided example as template
cp components/__tests__/persona-app.example.test.tsx components/__tests__/persona-app.test.tsx
```

### Step 4: Add data-testid Attributes
Edit `components/persona-app.tsx`:
```tsx
// Add to all interactive elements
<div data-testid="onboarding-container">
  <button data-testid="carousel-next">Next</button>
</div>

<input data-testid="upload-input" type="file" />

<button data-testid="style-professional">Professional</button>
```

### Step 5: Run Component Tests
```bash
# Run component tests only
npm run test:unit -- components/__tests__

# Watch mode
npm run test:unit -- components/__tests__ --watch
```

---

## Adding Visual Regression Tests

### Step 1: Update Playwright Config
Edit `playwright.config.ts`:
```typescript
export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
});
```

### Step 2: Create Visual Test
```bash
touch tests/e2e/visual/persona-app.visual.spec.ts
```

### Step 3: Write Visual Test
```typescript
import { test, expect } from '@playwright/test';

test('persona-app matches baseline', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('persona-app-light.png', {
    fullPage: true,
    animations: 'disabled',
  });
});
```

### Step 4: Generate Baselines
```bash
# Generate baseline screenshots
npm run test:e2e -- tests/e2e/visual/ --update-snapshots

# Run visual tests
npm run test:e2e -- tests/e2e/visual/
```

---

## Adding Accessibility Tests

### Step 1: Install axe-core
```bash
npm install -D @axe-core/playwright
```

### Step 2: Create A11y Test
```bash
touch tests/e2e/a11y/accessibility.spec.ts
```

### Step 3: Write A11y Test
```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage has no a11y violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### Step 4: Run A11y Tests
```bash
npm run test:e2e -- tests/e2e/a11y/
```

---

## Test Coverage Reports

### Generate Coverage Report
```bash
# Unit tests with coverage
npm run test:unit -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Targets
- Statements: 70%
- Branches: 70%
- Functions: 70%
- Lines: 70%

---

## Common Test Patterns

### Testing Component Rendering
```typescript
import { render, screen } from '@testing-library/react';

test('renders button', () => {
  render(<MyComponent />);
  expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
});
```

### Testing User Interactions
```typescript
import userEvent from '@testing-library/user-event';

test('handles button click', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

### Testing Async Operations
```typescript
import { waitFor } from '@testing-library/react';

test('loads data', async () => {
  render(<MyComponent />);

  await waitFor(() => {
    expect(screen.getByText(/loaded/i)).toBeInTheDocument();
  });
});
```

### Mocking API Calls
```typescript
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: 'mock data' }),
  })
);

test('fetches data', async () => {
  render(<MyComponent />);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/endpoint');
  });
});
```

### Testing localStorage
```typescript
beforeEach(() => {
  localStorage.clear();
});

test('stores data', () => {
  render(<MyComponent />);

  expect(localStorage.getItem('key')).toBe('value');
});
```

---

## Debugging Tests

### Jest Tests
```bash
# Run with verbose output
npm run test:unit -- --verbose

# Run single test
npm run test:unit -- -t "test name"

# Debug in Node
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright Tests
```bash
# Debug mode (opens browser inspector)
npx playwright test --debug

# Headed mode (see browser)
npm run test:e2e:headed

# Trace viewer
npx playwright show-trace trace.zip
```

---

## CI/CD Integration

### GitHub Actions (TODO)
Create `.github/workflows/test.yml`:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - run: npm install
      - run: npm run test:unit -- --coverage
      - run: npm run test:e2e
```

---

## Test Maintenance

### Weekly Tasks
- Review failed tests
- Update test data
- Check coverage reports
- Remove obsolete tests

### Monthly Tasks
- Refactor test code
- Update dependencies
- Audit test execution time
- Document new patterns

---

## Resources

### Documentation
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [Playwright Docs](https://playwright.dev/docs/intro)
- [axe-core](https://github.com/dequelabs/axe-core)

### Internal Docs
- Full Test Report: `TEST-COVERAGE-AUDIT-2026-01-09.md`
- Example Tests: `components/__tests__/persona-app.example.test.tsx`
- Test Plan: `tests/TEST-SUMMARY.md`
- E2E Plan: `tests/e2e-test-plan.md`

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run test:unit` | Run unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:unit -- --coverage` | Generate coverage report |
| `npm run test:e2e:headed` | E2E with visible browser |
| `npx playwright test --debug` | Debug E2E tests |
| `npm run test:load` | Run load tests |

---

**Last Updated:** 2026-01-09
**Maintainer:** QA Team
