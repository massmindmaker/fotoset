# Partner Packs API Documentation

## Overview

Partners (users with `is_partner=true` in `referral_balances`) can create and manage their own style packs through this API.

## Authentication

All endpoints require:
1. Authentication via `getAuthenticatedUser()` (Telegram or Neon Auth)
2. Partner status verification (`is_partner=true` in `referral_balances`)

**Headers:**
```
x-telegram-init-data: <telegram_init_data>
# OR use Neon Auth session cookie
```

**Body (for Telegram):**
```json
{
  "initData": "<telegram_init_data>",
  "telegramUserId": 123456789
}
```

## Business Rules

### Limits
- **Max 5 packs per partner**
- **7-23 prompts per pack** (for submission)
- **1+ prompts minimum** (to keep pack valid)

### Pack States & Transitions

```
draft → pending → approved/rejected
  ↑         |           |
  └─────────┴───────────┘
```

**State Rules:**
- `draft`: Editable, deletable, not public
- `rejected`: Editable, can resubmit
- `pending`: Read-only, under review
- `approved`: Read-only, public, earns commissions

**Edit permissions:**
- Can only edit/delete packs in `draft` or `rejected` status
- Once submitted (`pending`), pack is locked until reviewed
- Approved packs cannot be edited (create new version instead)

## Endpoints

### 1. List Partner's Packs

```http
GET /api/partner/packs
```

**Response:**
```json
{
  "success": true,
  "packs": [
    {
      "id": 42,
      "name": "Fashion Editorial",
      "slug": "fashion-editorial",
      "description": "High-fashion magazine style portraits",
      "iconEmoji": "👗",
      "previewImages": ["url1.jpg", "url2.jpg", "url3.jpg", "url4.jpg"],
      "moderationStatus": "approved",
      "isActive": true,
      "isFeatured": false,
      "sortOrder": 100,
      "usageCount": 127,
      "promptCount": 15,
      "submittedAt": "2026-01-15T10:30:00Z",
      "reviewedAt": "2026-01-16T14:20:00Z",
      "rejectionReason": null,
      "createdAt": "2026-01-15T09:00:00Z",
      "updatedAt": "2026-01-16T14:20:00Z"
    }
  ]
}
```

### 2. Create New Pack

```http
POST /api/partner/packs
```

**Request:**
```json
{
  "name": "Fashion Editorial",
  "description": "High-fashion magazine style portraits with dramatic lighting",
  "iconEmoji": "👗",
  "previewImages": [
    "https://example.com/preview1.jpg",
    "https://example.com/preview2.jpg",
    "https://example.com/preview3.jpg",
    "https://example.com/preview4.jpg"
  ]
}
```

**Validation:**
- `name` (required): 1-255 characters
- `description` (optional): Up to 1000 characters
- `iconEmoji` (optional): Default '🎨'
- `previewImages` (optional): Array of 4 image URLs

**Response:**
```json
{
  "success": true,
  "pack": {
    "id": 42,
    "name": "Fashion Editorial",
    "slug": "fashion-editorial",
    "description": "High-fashion magazine style portraits with dramatic lighting",
    "iconEmoji": "👗",
    "previewImages": [],
    "moderationStatus": "draft",
    "isActive": false,
    "createdAt": "2026-01-19T12:00:00Z"
  }
}
```

**Errors:**
- `401 UNAUTHORIZED` - Not authenticated
- `403 FORBIDDEN` - Not a partner
- `400 LIMIT_EXCEEDED` - Already have 5 packs
- `400 VALIDATION_ERROR` - Missing/invalid name

### 3. Get Pack Details

```http
GET /api/partner/packs/:id
```

**Response:**
```json
{
  "success": true,
  "pack": {
    "id": 42,
    "name": "Fashion Editorial",
    "slug": "fashion-editorial",
    "description": "High-fashion magazine style portraits",
    "iconEmoji": "👗",
    "previewImages": ["url1.jpg", "url2.jpg"],
    "moderationStatus": "draft",
    "isActive": false,
    "isFeatured": false,
    "sortOrder": 100,
    "usageCount": 0,
    "submittedAt": null,
    "reviewedAt": null,
    "rejectionReason": null,
    "createdAt": "2026-01-19T12:00:00Z",
    "updatedAt": "2026-01-19T12:00:00Z"
  },
  "prompts": [
    {
      "id": 101,
      "prompt": "Professional fashion portrait, editorial style, dramatic lighting",
      "negativePrompt": "low quality, blurry, amateur",
      "stylePrefix": "high fashion, vogue magazine style",
      "styleSuffix": "professional photography, 8k, sharp focus",
      "previewUrl": "https://example.com/preview.jpg",
      "position": 0,
      "isActive": true,
      "createdAt": "2026-01-19T12:05:00Z"
    }
  ]
}
```

### 4. Update Pack

```http
PUT /api/partner/packs/:id
```

**Request:**
```json
{
  "name": "Fashion Editorial Pro",
  "description": "Updated description",
  "iconEmoji": "📸",
  "previewImages": ["new1.jpg", "new2.jpg", "new3.jpg", "new4.jpg"]
}
```

**Rules:**
- Only works for `draft` or `rejected` packs
- All fields are optional
- Only provided fields are updated

**Response:**
```json
{
  "success": true,
  "pack": {
    "id": 42,
    "name": "Fashion Editorial Pro",
    "slug": "fashion-editorial",
    "description": "Updated description",
    "iconEmoji": "📸",
    "previewImages": ["new1.jpg", "new2.jpg", "new3.jpg", "new4.jpg"],
    "moderationStatus": "draft",
    "updatedAt": "2026-01-19T13:00:00Z"
  }
}
```

**Errors:**
- `400 INVALID_STATE` - Pack is `pending` or `approved`

### 5. Delete Pack

```http
DELETE /api/partner/packs/:id
```

**Rules:**
- Only works for `draft` packs
- CASCADE deletes all prompts

**Response:**
```json
{
  "success": true,
  "message": "Pack deleted successfully"
}
```

**Errors:**
- `400 INVALID_STATE` - Pack is not `draft`

### 6. Submit Pack for Moderation

```http
POST /api/partner/packs/:id/submit
```

**Rules:**
- Only works for `draft` or `rejected` packs
- Validates pack has 7-23 active prompts
- Changes status to `pending`
- Clears previous rejection reason

**Response:**
```json
{
  "success": true,
  "pack": {
    "id": 42,
    "name": "Fashion Editorial",
    "moderationStatus": "pending",
    "submittedAt": "2026-01-19T14:00:00Z",
    "promptCount": 15
  },
  "message": "Pack submitted for moderation. Review usually takes 24-48 hours."
}
```

**Errors:**
- `400 VALIDATION_ERROR` - Less than 7 or more than 23 prompts
- `400 INVALID_STATE` - Pack is already `pending` or `approved`

### 7. List Prompts

```http
GET /api/partner/packs/:id/prompts
```

**Response:**
```json
{
  "success": true,
  "prompts": [
    {
      "id": 101,
      "prompt": "Professional fashion portrait, editorial style",
      "negativePrompt": "low quality, blurry",
      "stylePrefix": "high fashion, vogue style",
      "styleSuffix": "8k, sharp focus",
      "previewUrl": "https://example.com/preview.jpg",
      "position": 0,
      "isActive": true,
      "createdAt": "2026-01-19T12:05:00Z"
    }
  ]
}
```

### 8. Add Prompt

```http
POST /api/partner/packs/:id/prompts
```

**Request:**
```json
{
  "prompt": "Professional fashion portrait, editorial style, dramatic lighting",
  "negativePrompt": "low quality, blurry, amateur",
  "stylePrefix": "high fashion, vogue magazine style",
  "styleSuffix": "professional photography, 8k, sharp focus",
  "previewUrl": "https://example.com/preview.jpg",
  "position": 0
}
```

**Validation:**
- `prompt` (required): The main generation prompt
- `negativePrompt` (optional): What to avoid
- `stylePrefix` (optional): Added before prompt
- `styleSuffix` (optional): Added after prompt
- `previewUrl` (optional): Example image URL
- `position` (optional): Sort order (auto-incremented if omitted)

**Rules:**
- Only works for `draft` or `rejected` packs
- Max 23 prompts per pack

**Response:**
```json
{
  "success": true,
  "prompt": {
    "id": 101,
    "prompt": "Professional fashion portrait, editorial style, dramatic lighting",
    "negativePrompt": "low quality, blurry, amateur",
    "stylePrefix": "high fashion, vogue magazine style",
    "styleSuffix": "professional photography, 8k, sharp focus",
    "previewUrl": "https://example.com/preview.jpg",
    "position": 0,
    "isActive": true,
    "createdAt": "2026-01-19T12:05:00Z"
  }
}
```

**Errors:**
- `400 LIMIT_EXCEEDED` - Already have 23 prompts
- `400 INVALID_STATE` - Pack is `pending` or `approved`

### 9. Get Single Prompt

```http
GET /api/partner/packs/:id/prompts/:promptId
```

**Response:**
```json
{
  "success": true,
  "prompt": {
    "id": 101,
    "prompt": "Professional fashion portrait",
    "negativePrompt": "low quality",
    "stylePrefix": "high fashion",
    "styleSuffix": "8k",
    "previewUrl": "https://example.com/preview.jpg",
    "position": 0,
    "isActive": true,
    "createdAt": "2026-01-19T12:05:00Z"
  }
}
```

### 10. Update Prompt

```http
PUT /api/partner/packs/:id/prompts/:promptId
```

**Request:**
```json
{
  "prompt": "Updated prompt text",
  "negativePrompt": "Updated negative",
  "stylePrefix": "New prefix",
  "styleSuffix": "New suffix",
  "previewUrl": "new-preview.jpg",
  "position": 5
}
```

**Rules:**
- Only works for `draft` or `rejected` packs
- All fields optional
- Only provided fields are updated

**Response:**
```json
{
  "success": true,
  "prompt": {
    "id": 101,
    "prompt": "Updated prompt text",
    "negativePrompt": "Updated negative",
    "stylePrefix": "New prefix",
    "styleSuffix": "New suffix",
    "previewUrl": "new-preview.jpg",
    "position": 5,
    "isActive": true
  }
}
```

### 11. Delete Prompt

```http
DELETE /api/partner/packs/:id/prompts/:promptId
```

**Rules:**
- Only works for `draft` or `rejected` packs
- Pack must have at least 2 prompts (can't delete last one)

**Response:**
```json
{
  "success": true,
  "message": "Prompt deleted successfully"
}
```

**Errors:**
- `400 VALIDATION_ERROR` - Would leave pack with 0 prompts

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

**Error Codes:**
- `UNAUTHORIZED` (401) - Not authenticated
- `FORBIDDEN` (403) - Not a partner
- `NOT_FOUND` (404) - Pack/prompt not found or access denied
- `VALIDATION_ERROR` (400) - Invalid input
- `INVALID_STATE` (400) - Operation not allowed in current state
- `LIMIT_EXCEEDED` (400) - Hit resource limit
- `INTERNAL_ERROR` (500) - Server error

## Database Schema

### photo_packs table
```sql
-- Partner ownership
partner_user_id INTEGER REFERENCES users(id)
owner_type VARCHAR(20) -- 'admin' | 'partner'

-- Moderation
moderation_status VARCHAR(20) -- 'draft' | 'pending' | 'approved' | 'rejected'
submitted_at TIMESTAMP
reviewed_by INTEGER REFERENCES admin_users(id)
reviewed_at TIMESTAMP
rejection_reason TEXT

-- UI metadata
slug VARCHAR(100) UNIQUE
preview_images TEXT[]
icon_emoji VARCHAR(10)
sort_order INTEGER
is_featured BOOLEAN
usage_count INTEGER
```

### pack_prompts table
```sql
id SERIAL PRIMARY KEY
pack_id INTEGER REFERENCES photo_packs(id) ON DELETE CASCADE
prompt TEXT NOT NULL
negative_prompt TEXT
style_prefix TEXT
style_suffix TEXT
preview_url TEXT
position INTEGER
is_active BOOLEAN
created_at TIMESTAMP
```

## Workflow Example

### Creating and Publishing a Pack

```javascript
// 1. Create pack
const { pack } = await fetch('/api/partner/packs', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Fashion Editorial',
    description: 'High-fashion style portraits',
    iconEmoji: '👗'
  })
})

// 2. Add prompts (at least 7)
for (const promptData of prompts) {
  await fetch(`/api/partner/packs/${pack.id}/prompts`, {
    method: 'POST',
    body: JSON.stringify(promptData)
  })
}

// 3. Submit for review
const result = await fetch(`/api/partner/packs/${pack.id}/submit`, {
  method: 'POST'
})
// Pack status: draft → pending

// 4. Admin reviews (external process)
// If approved: status → approved, is_active = true
// If rejected: status → rejected, rejection_reason set

// 5. If rejected, fix issues and resubmit
await fetch(`/api/partner/packs/${pack.id}/prompts/101`, {
  method: 'PUT',
  body: JSON.stringify({ prompt: 'Improved prompt' })
})

await fetch(`/api/partner/packs/${pack.id}/submit`, {
  method: 'POST'
})
```

## Security Notes

1. **Ownership verification**: All endpoints verify `partner_user_id = authUser.id`
2. **Partner status check**: All endpoints verify `is_partner=true`
3. **State validation**: Prevents editing approved/pending packs
4. **SQL injection**: Uses parameterized queries via `neon` library
5. **Input sanitization**: All text inputs are trimmed
6. **Limit enforcement**: Pack and prompt limits prevent abuse

## Testing Checklist

- [ ] Partner can create pack
- [ ] Non-partner gets 403 error
- [ ] Cannot create 6th pack
- [ ] Can update draft pack
- [ ] Cannot update pending pack
- [ ] Can delete draft pack only
- [ ] Cannot delete pending/approved pack
- [ ] Can add prompts to draft pack
- [ ] Cannot submit with <7 prompts
- [ ] Cannot submit with >23 prompts
- [ ] Can submit pack with 7-23 prompts
- [ ] Cannot edit after submission
- [ ] Can edit rejected pack
- [ ] Can resubmit rejected pack
- [ ] Cannot delete last prompt
- [ ] Slug auto-generated and unique
- [ ] Position auto-incremented

## Integration Points

### Admin Moderation (TODO)
- `POST /api/admin/packs/:id/approve` - Approve pack
- `POST /api/admin/packs/:id/reject` - Reject with reason
- `GET /api/admin/packs?status=pending` - List pending packs

### Public Pack Discovery (TODO)
- `GET /api/packs` - List approved packs
- `GET /api/packs/:slug` - Get pack by slug

### Generation Integration
- When generating, select pack via `pack_id`
- Use prompts from `pack_prompts` table
- Track usage in `pack_usage_stats`
- Update `photo_packs.usage_count`

## Future Enhancements

1. **Pack versioning** - Allow updates to approved packs via new versions
2. **Prompt templates** - Pre-defined prompt structures
3. **Collaborative editing** - Multiple partners per pack
4. **Revenue sharing** - Earnings per pack usage
5. **A/B testing** - Compare prompt variations
6. **Analytics dashboard** - Usage stats per pack/prompt
7. **Pack collections** - Group related packs
8. **Import/export** - JSON format for backup/sharing
