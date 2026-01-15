# API Structure

## Endpoints Overview

### Generation API
- `POST /api/generate` - Create 23 AI photos for a persona
- Validates payment status before processing
- Returns job ID for status polling

### Payment API
- `POST /api/payment/create` - Create T-Bank/Stars/TON payment order
- `GET /api/payment/status` - Poll payment status
- `POST /api/payment/webhook` - T-Bank webhook handler (SHA256 verified)

### User API
- `POST /api/user` - Get/create user by telegram_user_id

## Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Query params | snake_case | `?telegram_user_id=123` |
| Request body | camelCase | `{ telegramUserId: 123 }` |
| Response body | camelCase | `{ success: true }` |
| DB columns | snake_case | `telegram_user_id` |

## Request/Response Patterns

```typescript
// Standard success response
{ success: true, data: {...} }

// Standard error response
{ error: "Error message", code: "ERROR_CODE" }
```

## Relations
@structure/architecture
@code_style/patterns/error-handling
@testing/strategies/api-testing
