# Testing Strategies

## Test Types

### Unit Tests
- Jest with ts-jest
- `pnpm test:unit`
- Config: `jest.config.unit.js`
- Coverage reports enabled

### Integration Tests
- Jest with `--runInBand`
- `pnpm test:integration`
- Config: `jest.config.integration.js`
- Tests API endpoints with mocked DB

### E2E Tests
- Playwright
- `pnpm test:e2e` or `pnpm test:e2e:headed`
- Full user flow testing

### Load Tests
- k6 for performance testing
- `pnpm test:load` - standard load
- `pnpm test:stress` - stress testing
- `pnpm test:smoke` - quick validation

## Testing Patterns

### API Route Testing
```typescript
import { POST } from '@/app/api/generate/route';

describe('POST /api/generate', () => {
  it('validates payment status', async () => {
    const request = new Request('http://localhost/api/generate', {
      method: 'POST',
      body: JSON.stringify({ deviceId: 'test' })
    });
    
    const response = await POST(request);
    expect(response.status).toBe(403); // No payment
  });
});
```

### Database Mocking
```typescript
jest.mock('@/lib/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] })
}));
```

### Payment Testing
```typescript
// Use test mode
process.env.TBANK_TEST_MODE = 'true';

// Test card numbers for T-Bank
// 4000000000000002 - Success
// 4000000000000010 - Decline
```

## Critical Test Coverage

Must test:
1. Payment flow (create → webhook → status)
2. Generation access control
3. User persistence (device ID)
4. Async task creation

## Relations
@structure/api/endpoints
@code_style/patterns/error-handling
