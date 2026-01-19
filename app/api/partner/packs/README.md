# Partner Packs API

Partner endpoints for managing custom style packs.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/partner/packs` | List partner's packs |
| POST | `/api/partner/packs` | Create new pack |
| GET | `/api/partner/packs/:id` | Get pack details |
| PUT | `/api/partner/packs/:id` | Update pack |
| DELETE | `/api/partner/packs/:id` | Delete pack |
| POST | `/api/partner/packs/:id/submit` | Submit for moderation |
| GET | `/api/partner/packs/:id/prompts` | List prompts |
| POST | `/api/partner/packs/:id/prompts` | Add prompt |
| GET | `/api/partner/packs/:id/prompts/:promptId` | Get prompt |
| PUT | `/api/partner/packs/:id/prompts/:promptId` | Update prompt |
| DELETE | `/api/partner/packs/:id/prompts/:promptId` | Delete prompt |

## Quick Start

```javascript
// 1. Create pack
const pack = await fetch('/api/partner/packs', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Style Pack',
    description: 'Amazing fashion portraits',
    iconEmoji: '👗'
  })
}).then(r => r.json())

// 2. Add prompts (7-23 required)
for (let i = 0; i < 10; i++) {
  await fetch(`/api/partner/packs/${pack.pack.id}/prompts`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: `Fashion portrait style ${i}`,
      negativePrompt: 'low quality',
      stylePrefix: 'professional',
      styleSuffix: '8k'
    })
  })
}

// 3. Submit for review
await fetch(`/api/partner/packs/${pack.pack.id}/submit`, {
  method: 'POST'
})
```

## Authentication

All endpoints require:
- Partner status (`is_partner=true`)
- Valid authentication (Telegram or Neon Auth)

## Business Rules

- **Max 5 packs per partner**
- **7-23 prompts required for submission**
- Can only edit `draft` or `rejected` packs
- Can only delete `draft` packs
- Approved packs are read-only

## Pack States

```
draft → pending → approved/rejected
```

- `draft` - Editable, not public
- `pending` - Under review, read-only
- `approved` - Public, read-only, earns commissions
- `rejected` - Editable, can resubmit

## Full Documentation

See [PARTNER_PACKS_API.md](../../../../docs/PARTNER_PACKS_API.md) for complete API reference.

## Testing

```bash
# Run test suite
node scripts/test-partner-packs-api.mjs
```

## Types

```typescript
import type {
  PhotoPack,
  PackPrompt,
  CreatePackRequest,
  CreatePromptRequest
} from '@/lib/types/partner-packs'
```

## Database

- `photo_packs` - Pack metadata and moderation
- `pack_prompts` - Individual prompts
- `pack_usage_stats` - Usage tracking

## Integration

See migration `047_dynamic_packs_system.sql` for schema details.
