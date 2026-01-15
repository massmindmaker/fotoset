# Code Style & Patterns

## Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Database columns | snake_case | `telegram_user_id`, `created_at` |
| TypeScript variables | camelCase | `telegramUserId`, `createdAt` |
| API query params | snake_case | `?telegram_user_id=123` |
| API request body | camelCase | `{ telegramUserId: 123 }` |
| Environment vars | SCREAMING_SNAKE | `DATABASE_URL`, `TBANK_PASSWORD` |
| React components | PascalCase | `PaymentModal`, `PersonaApp` |
| CSS classes | kebab-case | `payment-modal`, `btn-primary` |

## Async Generation Pattern

The core pattern for AI generation to avoid Cloudflare timeouts:

```typescript
// 1. Create task in database
const task = await createKieTask({
  jobId,
  promptIndex,
  status: 'pending'
});

// 2. Fire request to AI provider (don't await result)
fireAndForget(kieApi.generate(prompt));

// 3. Cron job polls for completion
// app/api/cron/check-kie-tasks/route.ts
```

## Payment Provider Pattern

Multi-provider support with unified interface:

```typescript
interface PaymentResult {
  paymentId: string;
  confirmationUrl: string;
  provider: 'tbank' | 'stars' | 'ton';
}
```

## Error Handling

```typescript
// API routes follow this pattern
try {
  // ... business logic
  return NextResponse.json({ success: true, data });
} catch (error) {
  console.error('Operation failed:', error);
  return NextResponse.json(
    { error: 'Operation failed' },
    { status: 500 }
  );
}
```

## Relations
@structure/api/endpoints
@testing/strategies/unit-testing
