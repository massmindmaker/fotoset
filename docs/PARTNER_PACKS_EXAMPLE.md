# Partner Packs API - Usage Examples

Quick examples for common operations.

## 1. Create a New Pack

```typescript
const response = await fetch('/api/partner/packs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': telegramInitData, // or use session cookie
  },
  body: JSON.stringify({
    name: 'Fashion Editorial',
    description: 'High-fashion magazine style portraits with dramatic lighting',
    iconEmoji: '👗',
    previewImages: [
      'https://example.com/preview1.jpg',
      'https://example.com/preview2.jpg',
      'https://example.com/preview3.jpg',
      'https://example.com/preview4.jpg',
    ],
  }),
})

const { pack } = await response.json()
console.log('Created pack:', pack.id)
```

## 2. Add Prompts to Pack

```typescript
const prompts = [
  {
    prompt: 'Professional fashion portrait, editorial style, dramatic lighting, vogue magazine',
    negativePrompt: 'low quality, blurry, amateur, bad lighting',
    stylePrefix: 'high fashion, professional photography',
    styleSuffix: '8k uhd, sharp focus, studio lighting',
    position: 0,
  },
  {
    prompt: 'Elegant fashion portrait, soft natural light, minimalist background',
    negativePrompt: 'cluttered, busy background, harsh lighting',
    stylePrefix: 'minimalist fashion',
    styleSuffix: 'professional photography, 8k',
    position: 1,
  },
  // Add 5-21 more prompts...
]

for (const promptData of prompts) {
  await fetch(`/api/partner/packs/${pack.id}/prompts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': telegramInitData,
    },
    body: JSON.stringify(promptData),
  })
}
```

## 3. Update Pack Metadata

```typescript
await fetch(`/api/partner/packs/${packId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': telegramInitData,
  },
  body: JSON.stringify({
    description: 'Updated description with more details',
    iconEmoji: '📸',
  }),
})
```

## 4. Update a Prompt

```typescript
await fetch(`/api/partner/packs/${packId}/prompts/${promptId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': telegramInitData,
  },
  body: JSON.stringify({
    prompt: 'Improved prompt with better description',
    negativePrompt: 'more specific things to avoid',
  }),
})
```

## 5. Submit Pack for Review

```typescript
const response = await fetch(`/api/partner/packs/${packId}/submit`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': telegramInitData,
  },
})

const result = await response.json()
if (result.success) {
  console.log('Pack submitted! Status:', result.pack.moderationStatus)
  console.log(result.message) // "Pack submitted for moderation. Review usually takes 24-48 hours."
}
```

## 6. List All Partner Packs

```typescript
const response = await fetch('/api/partner/packs', {
  headers: {
    'x-telegram-init-data': telegramInitData,
  },
})

const { packs } = await response.json()

packs.forEach((pack) => {
  console.log(`Pack: ${pack.name}`)
  console.log(`Status: ${pack.moderationStatus}`)
  console.log(`Prompts: ${pack.promptCount}`)
  console.log(`Usage: ${pack.usageCount} generations`)
})
```

## 7. Get Pack with All Prompts

```typescript
const response = await fetch(`/api/partner/packs/${packId}`, {
  headers: {
    'x-telegram-init-data': telegramInitData,
  },
})

const { pack, prompts } = await response.json()

console.log('Pack:', pack.name)
console.log('Total prompts:', prompts.length)
prompts.forEach((p, i) => {
  console.log(`${i + 1}. ${p.prompt}`)
})
```

## 8. Delete a Draft Pack

```typescript
const response = await fetch(`/api/partner/packs/${packId}`, {
  method: 'DELETE',
  headers: {
    'x-telegram-init-data': telegramInitData,
  },
})

const result = await response.json()
console.log(result.message) // "Pack deleted successfully"
```

## 9. Error Handling

```typescript
try {
  const response = await fetch('/api/partner/packs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': telegramInitData,
    },
    body: JSON.stringify({
      name: 'Test Pack',
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    // Handle error
    switch (data.error) {
      case 'UNAUTHORIZED':
        console.error('Not logged in')
        break
      case 'FORBIDDEN':
        console.error('Not a partner')
        break
      case 'LIMIT_EXCEEDED':
        console.error('Already have 5 packs')
        break
      case 'VALIDATION_ERROR':
        console.error('Invalid input:', data.message)
        break
      default:
        console.error('Error:', data.message)
    }
    return
  }

  // Success
  console.log('Pack created:', data.pack.id)
} catch (error) {
  console.error('Network error:', error)
}
```

## 10. React Hook Example

```typescript
import { useState } from 'react'

function usePartnerPacks() {
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPacks = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/partner/packs')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message)
      }

      setPacks(data.packs)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createPack = async (packData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/partner/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packData),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message)
      }

      await fetchPacks() // Refresh list
      return data.pack
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const submitPack = async (packId) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/partner/packs/${packId}/submit`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message)
      }

      await fetchPacks() // Refresh list
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    packs,
    loading,
    error,
    fetchPacks,
    createPack,
    submitPack,
  }
}

// Usage in component
function PartnerDashboard() {
  const { packs, loading, createPack, submitPack } = usePartnerPacks()

  useEffect(() => {
    fetchPacks()
  }, [])

  const handleCreatePack = async () => {
    try {
      const pack = await createPack({
        name: 'My Fashion Pack',
        description: 'Amazing portraits',
        iconEmoji: '👗',
      })
      console.log('Created:', pack.id)
    } catch (error) {
      console.error('Failed to create pack:', error)
    }
  }

  return (
    <div>
      {loading && <p>Loading...</p>}
      {packs.map((pack) => (
        <div key={pack.id}>
          <h3>{pack.name}</h3>
          <p>Status: {pack.moderationStatus}</p>
          <p>Prompts: {pack.promptCount}</p>
          {pack.moderationStatus === 'draft' && (
            <button onClick={() => submitPack(pack.id)}>
              Submit for Review
            </button>
          )}
        </div>
      ))}
      <button onClick={handleCreatePack}>Create New Pack</button>
    </div>
  )
}
```

## 11. Full Pack Creation Workflow

```typescript
async function createCompletePackWorkflow() {
  // Step 1: Create pack
  const packResponse = await fetch('/api/partner/packs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Fashion Editorial Pro',
      description: 'Professional fashion photography style',
      iconEmoji: '👗',
    }),
  })
  const { pack } = await packResponse.json()
  console.log('✓ Pack created:', pack.id)

  // Step 2: Add prompts (minimum 7)
  const promptTemplates = [
    'Professional fashion portrait, editorial style',
    'Elegant minimalist fashion portrait',
    'Dramatic high-fashion portrait with bold lighting',
    'Soft natural light fashion portrait',
    'Black and white fashion portrait',
    'Outdoor fashion portrait with natural background',
    'Studio fashion portrait with clean background',
    'Creative fashion portrait with artistic composition',
    'Lifestyle fashion portrait',
    'Modern fashion portrait with urban setting',
  ]

  for (let i = 0; i < promptTemplates.length; i++) {
    await fetch(`/api/partner/packs/${pack.id}/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: promptTemplates[i],
        negativePrompt: 'low quality, blurry, amateur',
        stylePrefix: 'high fashion, professional photography',
        styleSuffix: '8k uhd, sharp focus, professional lighting',
        position: i,
      }),
    })
    console.log(`✓ Added prompt ${i + 1}/${promptTemplates.length}`)
  }

  // Step 3: Submit for review
  const submitResponse = await fetch(`/api/partner/packs/${pack.id}/submit`, {
    method: 'POST',
  })
  const submitResult = await submitResponse.json()
  console.log('✓ Pack submitted for moderation')
  console.log('  Status:', submitResult.pack.moderationStatus)
  console.log('  Message:', submitResult.message)

  return pack
}
```

## 12. Validation Before Submission

```typescript
async function validatePackBeforeSubmit(packId: number) {
  // Get pack details
  const response = await fetch(`/api/partner/packs/${packId}`)
  const { pack, prompts } = await response.json()

  const errors = []

  // Check pack status
  if (pack.moderationStatus !== 'draft' && pack.moderationStatus !== 'rejected') {
    errors.push('Pack cannot be submitted in current state')
  }

  // Check prompt count
  const activePrompts = prompts.filter((p) => p.isActive)
  if (activePrompts.length < 7) {
    errors.push(`Need at least 7 prompts (have ${activePrompts.length})`)
  }
  if (activePrompts.length > 23) {
    errors.push(`Cannot have more than 23 prompts (have ${activePrompts.length})`)
  }

  // Check required fields
  if (!pack.name?.trim()) {
    errors.push('Pack name is required')
  }

  // Check prompts quality
  const shortPrompts = activePrompts.filter((p) => p.prompt.length < 20)
  if (shortPrompts.length > 0) {
    errors.push(`${shortPrompts.length} prompts are too short (min 20 chars)`)
  }

  return {
    valid: errors.length === 0,
    errors,
    pack,
    promptCount: activePrompts.length,
  }
}

// Usage
const validation = await validatePackBeforeSubmit(packId)
if (validation.valid) {
  await submitPack(packId)
} else {
  console.error('Validation failed:', validation.errors)
}
```

## Quick Reference

| Action | Endpoint | Method |
|--------|----------|--------|
| List packs | `/api/partner/packs` | GET |
| Create pack | `/api/partner/packs` | POST |
| Get pack | `/api/partner/packs/:id` | GET |
| Update pack | `/api/partner/packs/:id` | PUT |
| Delete pack | `/api/partner/packs/:id` | DELETE |
| Submit pack | `/api/partner/packs/:id/submit` | POST |
| Add prompt | `/api/partner/packs/:id/prompts` | POST |
| Update prompt | `/api/partner/packs/:id/prompts/:promptId` | PUT |
| Delete prompt | `/api/partner/packs/:id/prompts/:promptId` | DELETE |

For complete API documentation, see [PARTNER_PACKS_API.md](./PARTNER_PACKS_API.md).
