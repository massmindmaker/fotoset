# User Active Pack API

API endpoint for managing the user's currently selected photo pack for AI generation.

## Base URL

```
/api/user/active-pack
```

---

## POST /api/user/active-pack

Set the user's active pack for generation.

### Authentication

Required. Uses `getAuthenticatedUser()` middleware.

Supports:
- Telegram Mini App (initData with HMAC signature)
- Web (Neon Auth session cookie)

### Request Body

```typescript
{
  packId?: number     // Pack ID to set as active (optional if packSlug provided)
  packSlug?: string   // Pack slug to set as active (optional if packId provided)

  // For Telegram Mini App authentication
  initData?: string   // Telegram initData with HMAC signature
  telegramUserId?: number  // DEV ONLY fallback
}
```

**Validation:**
- At least one of `packId` or `packSlug` must be provided
- Pack must exist in `photo_packs` table
- Pack must be active (`is_active = TRUE`)
- Pack must be approved (`moderation_status = 'approved'`)

### Response

#### Success (200)

```json
{
  "success": true,
  "data": {
    "activePackId": 1,
    "packName": "PinGlass Premium",
    "packSlug": "pinglass",
    "iconEmoji": "🌸"
  }
}
```

#### Errors

```json
// Missing identifier
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Either packId or packSlug must be provided"
  }
}

// Pack not found
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Pack not found"
  }
}

// Pack not active
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "This pack is not currently available"
  }
}

// Pack not approved
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "This pack is not approved for use"
  }
}

// Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Example Usage

```typescript
// Set active pack by ID
const response = await fetch('/api/user/active-pack', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': window.Telegram.WebApp.initData
  },
  body: JSON.stringify({
    packId: 1
  })
})

const data = await response.json()
if (data.success) {
  console.log('Active pack set:', data.data.packName)
}
```

```typescript
// Set active pack by slug
const response = await fetch('/api/user/active-pack', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': window.Telegram.WebApp.initData
  },
  body: JSON.stringify({
    packSlug: 'pinglass'
  })
})
```

---

## GET /api/user/active-pack

Get the user's currently active pack.

### Authentication

Required. Uses `getAuthenticatedUser()` middleware.

### Query Parameters

None. Authentication determined from headers/cookies.

### Response

#### Success (200) - Pack Set

```json
{
  "success": true,
  "data": {
    "activePack": {
      "id": 1,
      "slug": "pinglass",
      "name": "PinGlass Premium",
      "iconEmoji": "🌸"
    }
  }
}
```

#### Success (200) - No Pack Set

```json
{
  "success": true,
  "data": {
    "activePack": null
  }
}
```

**Note:** If the user's `active_pack_id` references a pack that no longer exists or is no longer active/approved, the endpoint will:
1. Clear the invalid `active_pack_id` in the database
2. Return `activePack: null`

#### Errors

```json
// Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Example Usage

```typescript
// Get active pack
const response = await fetch('/api/user/active-pack', {
  headers: {
    'x-telegram-init-data': window.Telegram.WebApp.initData
  }
})

const data = await response.json()
if (data.success && data.data.activePack) {
  console.log('Current active pack:', data.data.activePack.name)
} else {
  console.log('No active pack set')
}
```

---

## Database Schema

### users table

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_pack_id INTEGER REFERENCES photo_packs(id);
CREATE INDEX IF NOT EXISTS idx_users_active_pack ON users(active_pack_id);
```

### photo_packs table

```sql
CREATE TABLE photo_packs (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_emoji VARCHAR(10) DEFAULT '🎨',
  is_active BOOLEAN DEFAULT TRUE,
  moderation_status VARCHAR(20) DEFAULT 'approved'
    CHECK (moderation_status IN ('draft', 'pending', 'approved', 'rejected')),
  -- ... other columns
);
```

---

## Security

- **Authentication**: Enforced via `getAuthenticatedUser()` middleware
- **Validation**: Pack must be active and approved before setting
- **SQL Injection**: Protected via Neon's parameterized queries
- **Race Conditions**: None (single UPDATE query)

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Missing packId/packSlug or invalid input |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `NOT_FOUND` | 404 | Pack does not exist |
| `BAD_REQUEST` | 400 | Pack not active or not approved |
| `INTERNAL_ERROR` | 500 | Database or server error |

---

## Testing

Run the test suite:

```bash
node scripts/test-active-pack-api.mjs
```

Test coverage:
- ✅ GET initial active pack (null)
- ✅ POST set active pack by packId
- ✅ GET active pack after setting
- ✅ POST set active pack by packSlug
- ✅ POST with invalid pack ID (404)
- ✅ POST without packId/packSlug (400)
- ✅ GET without authentication (401)

---

## Integration

### Frontend Usage

```typescript
// 1. Get available packs
const packsResponse = await fetch('/api/packs')
const { packs } = await packsResponse.json()

// 2. Set active pack
const setResponse = await fetch('/api/user/active-pack', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': window.Telegram.WebApp.initData
  },
  body: JSON.stringify({ packId: packs[0].id })
})

// 3. Get current active pack
const getResponse = await fetch('/api/user/active-pack', {
  headers: {
    'x-telegram-init-data': window.Telegram.WebApp.initData
  }
})
const { activePack } = await getResponse.json()
```

### Generation Flow

When creating a new generation job, the active pack will be used:

```typescript
// In /api/generate endpoint
const user = await getAuthenticatedUser(request)
const packId = user.active_pack_id || DEFAULT_PACK_ID

// Create generation job with pack
await sql`
  INSERT INTO generation_jobs (avatar_id, pack_id, status)
  VALUES (${avatarId}, ${packId}, 'pending')
`
```

---

## Changelog

### 2026-01-19
- Initial implementation
- POST and GET methods
- Support for packId and packSlug
- Validation for active and approved packs
- Auto-cleanup of invalid active_pack_id
