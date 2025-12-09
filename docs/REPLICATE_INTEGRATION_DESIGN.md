# Replicate Integration Design for PinGlass Portrait Generation

## Executive Summary

This document outlines the optimal Replicate integration strategy for PinGlass, focusing on face-consistent portrait generation using 10-20 user reference photos to generate 23 unique portraits across different styles.

---

## Current State Analysis

### Existing Implementation
The project already has a basic Replicate integration in `lib/replicate.ts`:
- Uses `zsxkib/flux-pulid` model
- Basic batch generation with concurrency control
- Single reference image support
- Rate limiting between batches

### Identified Gaps
1. Only uses single reference image (first one), ignoring other 9-19 photos
2. No fallback to alternative models
3. No webhook support for async generation
4. Missing retry logic with exponential backoff
5. No cost tracking or budget controls
6. Limited error categorization

---

## Recommended Model Strategy

### Primary Model: `bytedance/flux-pulid`

**Why PuLID over Kontext Pro:**
- **Better Identity Preservation**: PuLID is specifically designed for identity-preserving generation
- **Lower Cost**: ~$0.022 per image vs ~$0.04 for Kontext Pro
- **Configurable ID Weight**: 0-3 scale for fine-tuning identity vs creativity balance
- **Output Resolution**: Up to 1536x1536px

**Specifications:**
| Parameter | Value |
|-----------|-------|
| Cost | $0.0014/second (~$0.022/image) |
| Resolution | 896x1152 default, up to 1536x1536 |
| Steps | 20 (recommended) |
| ID Weight | 1.0 (balanced), 0.6-0.8 (more editable) |
| Batch Size | 1-4 images per run |
| Latency | 10-20 seconds per image |

### Fallback Model: `black-forest-labs/flux-kontext-pro`

**When to use:**
- PuLID API unavailable
- User requests more artistic/stylized outputs
- Better handling of complex scene compositions

**Cost:** ~$0.04 per image

### Tertiary Fallback: `grandlineai/instant-id-photorealistic`

**When to use:**
- Both primary and secondary unavailable
- Need highest photorealism

---

## Architecture Design

### Multi-Provider Strategy

```
lib/
  replicate/
    index.ts              # Main export and provider selection
    providers/
      flux-pulid.ts       # Primary provider
      flux-kontext.ts     # Secondary provider
      instant-id.ts       # Tertiary fallback
    types.ts              # Shared TypeScript interfaces
    utils/
      retry.ts            # Exponential backoff logic
      cost-tracker.ts     # Cost monitoring
      image-processor.ts  # Reference image optimization
    config.ts             # Model configurations
```

### TypeScript Interfaces

```typescript
// lib/replicate/types.ts

export interface ReplicateConfig {
  apiToken: string;
  defaultModel: ModelType;
  maxRetries: number;
  timeoutMs: number;
  budgetPerGeneration: number;
}

export type ModelType =
  | 'flux-pulid'
  | 'flux-kontext-pro'
  | 'instant-id';

export interface GenerationInput {
  prompt: string;
  referenceImages: string[];  // 10-20 user photos
  style: StyleConfig;
  options?: GenerationOptions;
}

export interface GenerationOptions {
  width?: number;           // 256-1536, default 896
  height?: number;          // 256-1536, default 1152
  steps?: number;           // 1-20, default 20
  idWeight?: number;        // 0-3, default 1.0
  guidanceScale?: number;   // 1-10, default 4
  seed?: number;
  outputFormat?: 'png' | 'jpg' | 'webp';
}

export interface GenerationResult {
  url: string;
  success: boolean;
  model: ModelType;
  cost: number;
  latencyMs: number;
  promptIndex: number;
  retryCount: number;
  error?: string;
}

export interface BatchProgress {
  completed: number;
  total: number;
  successful: number;
  failed: number;
  currentBatch: number;
  estimatedTimeRemaining: number;
}

export type ProgressCallback = (progress: BatchProgress) => void | Promise<void>;
```

---

## Reference Image Handling Strategy

### Problem
PuLID accepts only ONE `main_face_image` but users upload 10-20 photos.

### Solution: Smart Reference Selection

```typescript
// lib/replicate/utils/image-processor.ts

export interface ReferenceImageScore {
  image: string;
  score: number;
  metrics: {
    resolution: number;      // Higher = better
    faceSize: number;        // Percentage of image
    lighting: number;        // Even = better
    sharpness: number;       // Higher = better
    frontalPose: number;     // More frontal = better
  };
}

export async function selectBestReference(
  images: string[],
  targetCount: number = 1
): Promise<string[]> {
  // Score each image based on quality metrics
  const scored = await Promise.all(
    images.map(async (img) => ({
      image: img,
      score: await calculateImageScore(img)
    }))
  );

  // Sort by score and return top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, targetCount)
    .map(s => s.image);
}

// For PuLID: Select different reference for each batch
// to introduce variety while maintaining identity
export function rotateReferences(
  images: string[],
  batchIndex: number,
  totalBatches: number
): string {
  // Use quality-sorted images
  // Rotate through top 5 for variety
  const topImages = images.slice(0, 5);
  return topImages[batchIndex % topImages.length];
}
```

### Alternative: Multi-Image Fusion (Future Enhancement)
For future integration, consider models that support multiple reference images:
- `mattheum/flux-multi-pulid-controlnet` - Supports multiple face references
- Custom LoRA training on user's photos (advanced)

---

## Batch Generation with Progress Tracking

### Enhanced Batch Processor

```typescript
// lib/replicate/batch-generator.ts

export interface BatchConfig {
  concurrency: number;          // Parallel requests (3 recommended)
  delayBetweenBatches: number;  // ms delay for rate limits
  maxRetries: number;           // Per-image retry count
  webhookUrl?: string;          // For async notifications
}

export async function generateBatchPortraits(
  prompts: string[],
  referenceImages: string[],
  config: BatchConfig,
  onProgress?: ProgressCallback
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];
  const sortedRefs = await selectBestReference(referenceImages, 5);
  const totalBatches = Math.ceil(prompts.length / config.concurrency);

  let successCount = 0;
  let failCount = 0;

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * config.concurrency;
    const batchPrompts = prompts.slice(
      batchStart,
      batchStart + config.concurrency
    );

    // Rotate reference image for variety
    const batchRef = rotateReferences(sortedRefs, batchIndex, totalBatches);

    // Process batch with retry logic
    const batchResults = await Promise.allSettled(
      batchPrompts.map((prompt, idx) =>
        generateWithRetry(prompt, batchRef, {
          ...config,
          seed: Date.now() + batchIndex * 100 + idx,
        })
      )
    );

    // Process results
    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const promptIndex = batchStart + i;

      if (result.status === 'fulfilled') {
        results.push(result.value);
        successCount++;
      } else {
        results.push({
          url: '/generation-failed.jpg',
          success: false,
          model: 'flux-pulid',
          cost: 0,
          latencyMs: 0,
          promptIndex,
          retryCount: config.maxRetries,
          error: result.reason?.message
        });
        failCount++;
      }
    }

    // Progress callback
    if (onProgress) {
      await onProgress({
        completed: batchStart + batchPrompts.length,
        total: prompts.length,
        successful: successCount,
        failed: failCount,
        currentBatch: batchIndex + 1,
        estimatedTimeRemaining: calculateETA(
          batchIndex + 1,
          totalBatches,
          config.delayBetweenBatches
        ),
      });
    }

    // Rate limit delay
    if (batchIndex < totalBatches - 1) {
      await delay(config.delayBetweenBatches);
    }
  }

  return results;
}
```

---

## Retry Logic with Exponential Backoff

```typescript
// lib/replicate/utils/retry.ts

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'RATE_LIMIT',
    'TIMEOUT',
    'SERVER_ERROR',
    'MODEL_OVERLOADED',
    'NETWORK_ERROR',
  ],
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delay = cfg.initialDelayMs;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      const errorType = categorizeError(error);
      const isRetryable = cfg.retryableErrors.includes(errorType);

      if (!isRetryable || attempt === cfg.maxRetries) {
        throw error;
      }

      console.log(
        `[Retry] Attempt ${attempt + 1}/${cfg.maxRetries} failed: ${errorType}. ` +
        `Retrying in ${delay}ms...`
      );

      await sleep(delay);
      delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
    }
  }

  throw lastError;
}

function categorizeError(error: unknown): string {
  const message = (error as Error)?.message?.toLowerCase() || '';

  if (message.includes('rate limit') || message.includes('429')) {
    return 'RATE_LIMIT';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'TIMEOUT';
  }
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'SERVER_ERROR';
  }
  if (message.includes('overloaded') || message.includes('capacity')) {
    return 'MODEL_OVERLOADED';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'NETWORK_ERROR';
  }

  return 'UNKNOWN_ERROR';
}
```

---

## Cost Management

### Cost Tracker

```typescript
// lib/replicate/utils/cost-tracker.ts

export interface CostMetrics {
  totalCost: number;
  imageCount: number;
  averageCostPerImage: number;
  byModel: Record<ModelType, number>;
  byStatus: {
    successful: number;
    failed: number;
    retried: number;
  };
}

const MODEL_COSTS: Record<ModelType, number> = {
  'flux-pulid': 0.022,         // $0.022 per image
  'flux-kontext-pro': 0.04,    // $0.04 per image
  'instant-id': 0.03,          // $0.03 per image (estimate)
};

export class CostTracker {
  private metrics: CostMetrics = {
    totalCost: 0,
    imageCount: 0,
    averageCostPerImage: 0,
    byModel: {
      'flux-pulid': 0,
      'flux-kontext-pro': 0,
      'instant-id': 0,
    },
    byStatus: {
      successful: 0,
      failed: 0,
      retried: 0,
    },
  };

  private budgetLimit: number;

  constructor(budgetLimit: number = 1.00) { // $1.00 default per generation
    this.budgetLimit = budgetLimit;
  }

  trackGeneration(model: ModelType, success: boolean, retried: boolean): void {
    const cost = MODEL_COSTS[model];

    this.metrics.totalCost += cost;
    this.metrics.imageCount++;
    this.metrics.averageCostPerImage =
      this.metrics.totalCost / this.metrics.imageCount;
    this.metrics.byModel[model] += cost;

    if (success) {
      this.metrics.byStatus.successful++;
    } else {
      this.metrics.byStatus.failed++;
    }
    if (retried) {
      this.metrics.byStatus.retried++;
    }
  }

  isWithinBudget(): boolean {
    return this.metrics.totalCost < this.budgetLimit;
  }

  estimateBatchCost(imageCount: number, model: ModelType = 'flux-pulid'): number {
    return imageCount * MODEL_COSTS[model];
  }

  getMetrics(): CostMetrics {
    return { ...this.metrics };
  }
}
```

### Cost Projections for 23-Image Generation

| Model | Cost/Image | 23 Images | With 10% Retries |
|-------|------------|-----------|------------------|
| FLUX PuLID | $0.022 | $0.506 | $0.557 |
| Kontext Pro | $0.040 | $0.920 | $1.012 |
| InstantID | $0.030 | $0.690 | $0.759 |

**Recommended Budget:** $0.60-0.80 per full generation

---

## Provider Fallback Chain

```typescript
// lib/replicate/index.ts

import { generateWithPuLID } from './providers/flux-pulid';
import { generateWithKontext } from './providers/flux-kontext';
import { generateWithInstantID } from './providers/instant-id';

const FALLBACK_CHAIN = [
  { name: 'flux-pulid', fn: generateWithPuLID },
  { name: 'flux-kontext-pro', fn: generateWithKontext },
  { name: 'instant-id', fn: generateWithInstantID },
] as const;

export async function generatePortrait(
  prompt: string,
  referenceImage: string,
  options?: GenerationOptions
): Promise<GenerationResult> {
  const errors: Array<{ provider: string; error: string }> = [];

  for (const provider of FALLBACK_CHAIN) {
    try {
      const result = await withRetry(() =>
        provider.fn(prompt, referenceImage, options)
      );

      return {
        ...result,
        model: provider.name as ModelType,
      };
    } catch (error) {
      const errorMsg = (error as Error).message;
      errors.push({ provider: provider.name, error: errorMsg });
      console.error(`[${provider.name}] Failed: ${errorMsg}`);
    }
  }

  throw new Error(
    `All providers failed: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`
  );
}
```

---

## Implementation Roadmap

### Phase 1: Enhanced PuLID Integration (Week 1)
1. Update `lib/replicate.ts` with retry logic
2. Implement smart reference image selection
3. Add cost tracking to database
4. Update `/api/generate` route

### Phase 2: Fallback Chain (Week 2)
1. Add Kontext Pro provider
2. Implement fallback logic
3. Add provider health checks
4. Create monitoring dashboard

### Phase 3: Advanced Features (Week 3)
1. Webhook support for async notifications
2. Reference image caching
3. A/B testing different models
4. User preference learning

---

## API Route Update

```typescript
// app/api/generate/route.ts (updated excerpt)

import { generateBatchPortraits, CostTracker } from '@/lib/replicate';

export async function POST(request: NextRequest) {
  // ... validation code ...

  const costTracker = new CostTracker(0.80); // $0.80 budget

  // Pre-check budget
  const estimatedCost = costTracker.estimateBatchCost(totalPhotos);
  console.log(`[Generate] Estimated cost: $${estimatedCost.toFixed(3)}`);

  const results = await generateBatchPortraits(
    mergedPrompts,
    validReferenceImages,
    {
      concurrency: 3,
      delayBetweenBatches: 1000,
      maxRetries: 3,
    },
    async (progress) => {
      // Update database with progress
      await sql`
        UPDATE generation_jobs
        SET completed_photos = ${progress.completed},
            updated_at = NOW()
        WHERE id = ${job.id}
      `;
    }
  );

  // Log costs to database
  const finalMetrics = costTracker.getMetrics();
  await sql`
    INSERT INTO generation_costs (
      job_id, total_cost, image_count,
      successful_count, failed_count, retried_count
    ) VALUES (
      ${job.id}, ${finalMetrics.totalCost}, ${finalMetrics.imageCount},
      ${finalMetrics.byStatus.successful}, ${finalMetrics.byStatus.failed},
      ${finalMetrics.byStatus.retried}
    )
  `;

  // ... rest of response handling ...
}
```

---

## Environment Variables

```env
# Replicate API
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Budget Controls
REPLICATE_BUDGET_PER_GENERATION=0.80
REPLICATE_MAX_RETRIES=3

# Provider Preferences
REPLICATE_PRIMARY_MODEL=flux-pulid
REPLICATE_ENABLE_FALLBACK=true
```

---

## Monitoring & Logging

### Database Schema Addition

```sql
-- Cost tracking table
CREATE TABLE generation_costs (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES generation_jobs(id),
  total_cost DECIMAL(10, 4),
  image_count INTEGER,
  successful_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  retried_count INTEGER DEFAULT 0,
  primary_model VARCHAR(50),
  fallback_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX idx_generation_costs_created_at
ON generation_costs(created_at);
```

---

## Sources

- [Replicate AI Face Generator Collection](https://replicate.com/collections/ai-face-generator)
- [FLUX PuLID on Replicate](https://replicate.com/bytedance/flux-pulid)
- [FLUX Kontext Pro](https://replicate.com/black-forest-labs/flux-kontext-pro)
- [Generate Consistent Characters - Replicate Blog](https://replicate.com/blog/generate-consistent-characters)
- [FLUX Kontext Blog Post](https://replicate.com/blog/flux-kontext)
- [Flux Kontext Pulid Workflow](https://www.runcomfy.com/comfyui-workflows/flux-kontext-pulid-consistent-character-generation)
- [Face Swap Comparison: PuLID vs InstantID vs EcomID](https://myaiforce.com/flux-pulid-vs-ecomid-vs-instantid/)
