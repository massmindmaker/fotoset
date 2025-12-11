# Fotoset AI Providers

## Overview

Fotoset uses Replicate API with automatic fallback chain, cost tracking, and budget enforcement.

---

## Supported Models

### 1. Nano Banana Pro (Primary)
- **Model:** `google/nano-banana-pro`
- **Cost:** $0.15/image
- **Speed:** 10-15 seconds (fastest)
- **References:** Up to 14 images (best consistency!)
- **Output:** 1024×1024px JPG

### 2. FLUX PuLID (Fallback 1)
- **Model:** `bytedance/flux-pulid`
- **Cost:** $0.022/image (cheapest)
- **Speed:** 15-20 seconds
- **References:** Single main face
- **Output:** 896×1152px WebP

### 3. FLUX Kontext Pro (Fallback 2)
- **Model:** `black-forest-labs/flux-kontext-pro`
- **Cost:** $0.04/image
- **Speed:** 30-40 seconds
- **References:** Single image (context-aware)
- **Output:** 1024×1024px WebP

### 4. InstantID (Fallback 3)
- **Model:** `grandlineai/instant-id-photorealistic`
- **Cost:** $0.03/image
- **Speed:** 20-30 seconds
- **References:** Single reference
- **Output:** 1024×1024px PNG

---

## Fallback Strategy

```typescript
const FALLBACK_ORDER = [
  'nano-banana-pro',    // Best: multi-reference, fast
  'flux-pulid',         // Good: high identity
  'flux-kontext-pro',   // Good: context-aware
  'instant-id',         // Fallback: last resort
];
```

**Why this order:**
1. nano-banana-pro supports up to 14 reference images → best face consistency
2. flux-pulid has excellent identity preservation
3. Others are reliable fallbacks

---

## Configuration

```typescript
// lib/replicate/config.ts
export const MODEL_CONFIGS = {
  'nano-banana-pro': {
    costPerImage: 0.15,
    maxReferenceImages: 14,
    outputWidth: 1024,
    outputHeight: 1024,
  },
  'flux-pulid': {
    costPerImage: 0.022,
    maxReferenceImages: 1,
    outputWidth: 896,
    outputHeight: 1152,
  },
  // ...
};
```

---

## Cost Tracking

```typescript
// lib/replicate/utils/cost-tracker.ts
class CostTracker {
  constructor(budgetLimit: number = 5.00)

  trackGeneration(model, success, retried): void
  isWithinBudget(): boolean
  getRemainingBudget(): number
  getSummary(): string
}

// Usage
const tracker = new CostTracker(5.00);
tracker.trackGeneration('flux-pulid', true);
console.log(tracker.getSummary());
// "Cost: $0.51 / $5.00 | Images: 23 | Success: 95%"
```

---

## Retry Strategy

```typescript
// lib/replicate/utils/retry.ts
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};
```

**Retryable errors:**
- RATE_LIMIT
- TIMEOUT
- SERVER_ERROR
- MODEL_OVERLOADED

**Non-retryable:**
- INVALID_INPUT
- NSFW_CONTENT
- INSUFFICIENT_BALANCE

---

## Batch Generation

```typescript
// lib/replicate/index.ts
async function generateBatchPortraits(
  prompts: string[],
  referenceImages: string[],
  config?: {
    concurrency?: number,      // default: 5
    maxRetries?: number,       // default: 3
  },
  onProgress?: (completed, total) => void
): Promise<GenerationResult[]>
```

---

## 23 Prompts

**File:** `lib/prompts.ts`

Each prompt includes:
- Camera model & lens specifications
- Lighting conditions
- Subject composition
- Clothing details
- Post-processing style

**Styles:**
- **Professional:** Business, LinkedIn (prompts 3,4,11,6,18,21,0,19,7)
- **Lifestyle:** Casual, social (prompts 0,1,2,5,8,12,15,20,22)
- **Creative:** Artistic, portfolio (prompts 7,9,10,13,14,16,17,19,21)

---

## Environment Variables

```env
REPLICATE_API_TOKEN=r8_***
REPLICATE_PRIMARY_MODEL=nano-banana-pro
REPLICATE_MAX_RETRIES=3
REPLICATE_ENABLE_FALLBACK=true
REPLICATE_BUDGET_PER_GENERATION=5.00
```

---

## Cost per 23 Photos

| Model | Cost/Image | Total (23) |
|-------|------------|------------|
| nano-banana-pro | $0.15 | $3.45 |
| flux-pulid | $0.022 | $0.51 |
| flux-kontext-pro | $0.04 | $0.92 |
| instant-id | $0.03 | $0.69 |

---

## Testing

**Endpoint:** `GET /api/test-models`

```json
{
  "flux-pulid": {
    "available": true,
    "connected": true,
    "costPerImage": 0.022
  }
}
```
