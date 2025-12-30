# PinGlass Test Suite

## Overview

Comprehensive test suite for PinGlass API covering unit tests, integration tests, and load testing.

## Test Statistics

| Category | Tests | Status |
|----------|-------|--------|
| Unit Tests | 278+ | Active |
| Integration Tests | 15+ | Active |
| E2E Tests | 10+ | Active |
| Load Tests (k6) | 5 scenarios | Active |

## Quick Start

```bash
# Run all unit tests
pnpm test:unit

# Run with coverage
pnpm test:unit -- --coverage

# Run specific test file
pnpm test:unit -- tests/unit/api/payment/webhook.test.ts

# Run integration tests
pnpm test:integration

# Run load tests (requires k6)
pnpm test:load
```

## Directory Structure

```
tests/
├── unit/                      # Unit tests (Jest + Mocks)
│   ├── api/
│   │   ├── payment/           # Payment API tests
│   │   │   ├── create.test.ts
│   │   │   ├── webhook.test.ts
│   │   │   └── status.test.ts
│   │   ├── generate/          # Generation API tests
│   │   │   └── route.test.ts
│   │   ├── avatars/           # Avatar CRUD tests
│   │   │   ├── route.test.ts
│   │   │   └── [id]/route.test.ts
│   │   ├── referral/          # Referral system tests
│   │   │   ├── code.test.ts
│   │   │   ├── apply.test.ts
│   │   │   ├── stats.test.ts
│   │   │   ├── earnings.test.ts
│   │   │   └── withdraw.test.ts
│   │   └── admin/             # Admin API tests
│   │       └── payments.test.ts
│   ├── lib/
│   │   └── tbank.test.ts      # T-Bank integration tests
│   └── security/
│       └── authorization.test.ts  # IDOR security tests
├── integration/               # Integration tests (real DB)
│   └── payment-generation-flow.test.ts
├── e2e/                       # End-to-end tests (Playwright)
│   └── *.spec.ts
├── fixtures/                  # Test data and fixtures
│   ├── payment-data.ts
│   └── test-photos/
├── __mocks__/                 # Jest mocks
│   └── lib/
│       ├── db.ts
│       ├── tbank.ts
│       └── qstash.ts
└── setup/                     # Test setup files
    ├── unit.setup.ts
    └── integration.setup.ts
```

## Test Categories

### 1. Payment Tests (26 tests)
- Payment creation (tiers: starter/standard/premium)
- T-Bank webhook processing
- Signature verification (SHA256)
- Refund handling
- Idempotency checks

### 2. Generation Tests (33 tests)
- Generation start with 5-8 reference photos
- Job polling and status updates
- Kie.ai task processing
- Auto-refund on failure
- Parallel generation limits

### 3. Avatar Tests (43 tests)
- CRUD operations
- 3-avatar limit enforcement
- Reference photo management
- Cascade deletion
- IDOR protection

### 4. Referral Tests (51 tests)
- Code generation and validation
- Code application
- Earnings calculation (10% commission)
- Withdrawal requests (NDFL 13%)
- Balance management

### 5. Security Tests (17 tests)
- IDOR (Insecure Direct Object Reference)
- Cross-user access prevention
- Authorization checks
- Input validation

### 6. Admin Tests (11 tests)
- Payment listing with filters
- Pagination
- Refund management

## Load Testing (k6)

### Installation

```bash
# Windows
choco install k6

# macOS
brew install k6

# Linux
snap install k6
```

### Running Load Tests

```bash
# Standard load test (5 min, up to 50 VUs)
pnpm test:load

# Stress test (up to 200 VUs)
pnpm test:stress

# Quick smoke test
pnpm test:smoke

# Custom configuration
k6 run k6/load-test.js --vus 100 --duration 10m

# With environment
k6 run k6/load-test.js --env BASE_URL=https://staging.pinglass.ru
```

### Performance Thresholds

| Metric | Target |
|--------|--------|
| p95 Response Time | < 2000ms |
| p99 Response Time | < 5000ms |
| Error Rate | < 5% |
| Payment API p95 | < 3000ms |
| Generation API p95 | < 5000ms |

## Mocking Strategy

| Service | Unit Tests | Integration | E2E |
|---------|-----------|-------------|-----|
| Database | Mock | Real (test) | Real |
| T-Bank | Mock | Mock | Intercept |
| Kie.ai | Mock | Mock | N/A |
| QStash | Mock | Mock | N/A |
| R2 Storage | Mock | Mock | Mock |

## Writing New Tests

### Unit Test Template

```typescript
import { NextRequest } from "next/server"

// Mocks first
const mockSql = jest.fn()
jest.mock("@/lib/db", () => ({
  sql: (...args: any[]) => mockSql(...args),
}))

// Import after mocks
import { GET } from "@/app/api/your-endpoint/route"

describe("GET /api/your-endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should return 200 on success", async () => {
    mockSql.mockResolvedValueOnce([{ id: 1 }])

    const request = new NextRequest("http://localhost/api/your-endpoint")
    const response = await GET(request)

    expect(response.status).toBe(200)
  })
})
```

### Test Naming Convention

```
{endpoint}-{scenario}-{expected}
Example: webhook-valid-signature-returns-200
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:unit

  integration:
    needs: unit
    steps:
      - run: pnpm test:integration

  load:
    if: github.ref == 'refs/heads/main'
    steps:
      - run: pnpm test:load
```

## Troubleshooting

### Common Issues

1. **"Cannot find module @/lib/..."**
   - Ensure mocks are defined before imports
   - Check moduleNameMapper in jest.config

2. **"Connection refused" in integration tests**
   - Start the database: `docker-compose up -d db`
   - Check DATABASE_URL in .env.test

3. **k6 not found**
   - Install k6: `choco install k6` (Windows)

## Coverage Goals

| Domain | Target | Current |
|--------|--------|---------|
| Payment | 90% | ~85% |
| Generation | 85% | ~80% |
| Avatar | 90% | ~90% |
| Referral | 85% | ~85% |
| Admin | 70% | ~60% |

## Contributing

1. Write tests before implementing features (TDD)
2. Maintain test isolation (no shared state)
3. Use descriptive test names
4. Mock external services consistently
5. Keep tests fast (< 100ms per unit test)
