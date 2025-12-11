# AI Image Generation API Research for PinGlass
**Date:** 2025-12-10
**Purpose:** Alternative APIs for portrait generation with face consistency

---

## Executive Summary

Based on research of available AI image generation APIs, here are the most viable alternatives to Google Imagen 3.0 for PinGlass's portrait generation use case:

**Top Recommendations:**
1. **Replicate** - Most versatile, excellent face consistency models
2. **Fal.ai** - Fastest inference, good pricing
3. **Stability AI** - Established provider, solid portrait quality

---

## Detailed API Comparison

### 1. Replicate
**Website:** https://replicate.com

#### Best Models for Portraits:
- **flux-dev** (black-forest-labs/flux-dev)
  - High quality portraits
  - Good prompt following

- **face-to-many** (fofr/face-to-many)
  - Specialized for face consistency
  - Generates multiple styles from one face
  - Perfect for PinGlass use case

- **consistent-character** (fofr/consistent-character)
  - Maintains character across generations
  - Supports reference images

- **sdxl-lightning** (bytedance/sdxl-lightning)
  - Fast generation (1-4 steps)
  - Good for portraits

#### Pricing:
- Pay-per-use model
- FLUX Dev: ~$0.003/second (~$0.05-0.10 per image)
- SDXL models: ~$0.0025/second (~$0.025-0.05 per image)
- Face-to-many: ~$0.10-0.15 per generation

#### Speed:
- FLUX: 10-30 seconds
- SDXL Lightning: 2-5 seconds
- Face-to-many: 20-40 seconds

#### Reference Image Support:
✅ Yes - Multiple models support ControlNet, IP-Adapter, face references

#### Quality for Portraits:
⭐⭐⭐⭐⭐ Excellent - Industry-leading quality with FLUX models

#### API Integration:
```javascript
import Replicate from "replicate";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const output = await replicate.run(
  "fofr/face-to-many:cd9d1e0280e0fa2c64dea2e6af2d0f0aa0a3f73ac807f5c8b6f00b0d93f38bce",
  {
    input: {
      image: "https://example.com/reference.jpg",
      prompt: "professional headshot, studio lighting, clean background",
      num_outputs: 1,
      style: "professional"
    }
  }
);
```

---

### 2. Stability AI
**Website:** https://platform.stability.ai

#### Best Models for Portraits:
- **Stable Diffusion 3.5 Large**
  - Latest model (Nov 2024)
  - Excellent portrait quality

- **SDXL 1.0**
  - Proven quality
  - Wide community support

- **Stable Diffusion 3 Medium**
  - Balanced speed/quality

#### Pricing (as of Jan 2025):
- SD3.5 Large: $0.065 per image (1024x1024)
- SDXL: $0.03 per image (1024x1024)
- SD3 Medium: $0.035 per image
- Volume discounts available

#### Speed:
- SD3.5: 5-10 seconds
- SDXL: 3-7 seconds
- With caching: 2-4 seconds

#### Reference Image Support:
✅ Yes - Via img2img and ControlNet endpoints

#### Quality for Portraits:
⭐⭐⭐⭐ Very Good - Consistent quality, slightly less realistic than FLUX

#### API Integration:
```javascript
const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
    'Accept': 'image/*'
  },
  body: JSON.stringify({
    prompt: "professional headshot, studio lighting",
    image: referenceImageBase64,
    mode: "image-to-image",
    strength: 0.7,
    output_format: "png"
  })
});
```

---

### 3. Fal.ai
**Website:** https://fal.ai

#### Best Models for Portraits:
- **fal-ai/flux/dev**
  - FLUX implementation
  - Optimized inference

- **fal-ai/fast-sdxl**
  - Sub-second generation
  - Good for batch processing

- **fal-ai/face-to-sticker**
  - Creative face transformations

- **fal-ai/photomaker**
  - Personalized portrait generation
  - Supports reference images

#### Pricing:
- FLUX Dev: $0.025 per image
- Fast SDXL: $0.015 per image
- PhotoMaker: $0.030 per image
- Very competitive pricing

#### Speed:
⚡ **Fastest in market**
- FLUX: 2-5 seconds
- Fast SDXL: <1 second
- Optimized infrastructure

#### Reference Image Support:
✅ Yes - PhotoMaker and LoRA training support

#### Quality for Portraits:
⭐⭐⭐⭐ Very Good - Same models as others, optimized delivery

#### API Integration:
```javascript
import * as fal from "@fal-ai/serverless-client";

fal.config({ credentials: process.env.FAL_KEY });

const result = await fal.subscribe("fal-ai/flux/dev", {
  input: {
    prompt: "professional headshot, studio lighting",
    image_url: "https://example.com/reference.jpg",
    num_images: 1
  }
});
```

---

### 4. Leonardo AI
**Website:** https://leonardo.ai

#### Best Models for Portraits:
- **PhotoReal**
  - Specialized for photorealistic portraits
  - Best-in-class for headshots

- **Leonardo Diffusion XL**
  - General purpose high quality

- **Alchemy**
  - Enhancement layer for better quality

#### Pricing:
- Subscription-based: $12-48/month
- API access: Enterprise only (custom pricing)
- PhotoReal: ~14 tokens per image
- With Alchemy: +5 tokens

**Note:** Primarily B2C, limited API access

#### Speed:
- PhotoReal: 10-15 seconds
- Standard: 5-8 seconds

#### Reference Image Support:
⚠️ Limited - Image prompting available, not full reference control

#### Quality for Portraits:
⭐⭐⭐⭐⭐ Excellent - Top tier for photorealistic portraits

#### API Integration:
```javascript
// Enterprise API (limited availability)
const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.LEONARDO_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: "professional headshot",
    modelId: "photoreal-v2",
    num_images: 1,
    width: 1024,
    height: 1024
  })
});
```

---

### 5. Midjourney
**Website:** https://midjourney.com

#### Status:
❌ **No Official API** (as of Jan 2025)
- Unofficial APIs exist but violate ToS
- Discord-based only
- Not recommended for production use

#### Alternative:
- Midjourney quality via FLUX models on Replicate/Fal.ai
- Some unofficial wrappers (use at own risk)

---

### 6. RunwayML Gen-3
**Website:** https://runwayml.com

#### Focus:
- Primarily **video generation** (Gen-3 Alpha)
- Image generation less emphasized
- Not ideal for portrait batch processing

#### Pricing:
- Subscription: $12-76/month
- Gen-3 video: 5 credits/second
- Limited API for images

#### Portrait Capability:
⭐⭐⭐ Good - But not specialized for portraits

**Verdict:** Not recommended for PinGlass use case

---

### 7. Together AI
**Website:** https://together.ai

#### Best Models for Portraits:
- **FLUX.1-dev**
  - Same model as Replicate

- **Stable Diffusion 3**
  - Good quality

- **SDXL**
  - Reliable baseline

#### Pricing:
- FLUX.1-dev: $0.025 per image
- SD3: $0.015 per image
- SDXL: $0.008 per image
- Free tier: $25 credits

#### Speed:
- FLUX: 8-15 seconds
- SD3: 4-8 seconds
- SDXL: 3-6 seconds

#### Reference Image Support:
⚠️ Limited - Primarily text-to-image focused

#### Quality for Portraits:
⭐⭐⭐⭐ Very Good - Same underlying models

#### API Integration:
```javascript
const response = await fetch('https://api.together.xyz/v1/images/generations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: "black-forest-labs/FLUX.1-dev",
    prompt: "professional headshot, studio lighting",
    width: 1024,
    height: 1024,
    steps: 28,
    n: 1
  })
});
```

---

### 8. Fireworks AI
**Website:** https://fireworks.ai

#### Best Models for Portraits:
- **FLUX.1-dev**
  - Fast inference

- **Stable Diffusion 3**
  - Production ready

- **PlaygroundV2.5**
  - Good for portraits

#### Pricing:
⚡ **Most competitive**
- FLUX.1-dev: $0.02 per image
- SD3: $0.01 per image
- PlaygroundV2.5: $0.008 per image

#### Speed:
⚡ **Very fast**
- FLUX: 3-7 seconds
- SD3: 2-4 seconds
- Optimized for throughput

#### Reference Image Support:
⚠️ Limited - Primarily text-to-image

#### Quality for Portraits:
⭐⭐⭐⭐ Very Good - Excellent value

#### API Integration:
```javascript
const response = await fetch('https://api.fireworks.ai/inference/v1/image_generation/accounts/fireworks/models/flux-1-dev', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: "professional headshot, studio lighting",
    width: 1024,
    height: 1024,
    samples: 1
  })
});
```

---

## Cost Comparison (23 images per generation)

Assuming 1024x1024 resolution, 23 images per user:

| Provider | Per Image | Per Session (23 images) | Notes |
|----------|-----------|------------------------|-------|
| **Google Imagen 3** | ~$0.04 | ~$0.92 | Current provider |
| **Fal.ai FLUX** | $0.025 | **$0.575** | Fastest option |
| **Fireworks FLUX** | $0.02 | **$0.46** | Best price/quality |
| **Replicate FLUX** | $0.05-0.10 | $1.15-2.30 | Premium quality |
| **Replicate face-to-many** | $0.15 | $3.45 | Specialized, expensive |
| **Stability SD3.5** | $0.065 | $1.50 | Enterprise grade |
| **Together FLUX** | $0.025 | $0.575 | Good balance |
| **Fireworks SD3** | $0.01 | **$0.23** | Budget option |

---

## Speed Comparison (per image)

| Provider | Model | Average Time | Batch 23 Images |
|----------|-------|--------------|-----------------|
| **Fal.ai** | Fast SDXL | <1s | ~23s |
| **Fal.ai** | FLUX | 2-5s | ~1-2min |
| **Fireworks** | FLUX | 3-7s | ~1-3min |
| **Replicate** | SDXL Lightning | 2-5s | ~1-2min |
| **Replicate** | FLUX | 10-30s | ~4-12min |
| **Stability** | SD3.5 | 5-10s | ~2-4min |
| **Google Imagen 3** | N/A | 8-15s | ~3-6min |
| **Together** | FLUX | 8-15s | ~3-6min |

---

## Face Consistency Ranking

**Critical for PinGlass:**

1. ⭐⭐⭐⭐⭐ **Replicate face-to-many** - Specialized for this
2. ⭐⭐⭐⭐⭐ **Google Imagen 3** - Current provider
3. ⭐⭐⭐⭐ **Replicate FLUX + IP-Adapter** - Very good with setup
4. ⭐⭐⭐⭐ **Fal.ai PhotoMaker** - Good personalization
5. ⭐⭐⭐⭐ **Leonardo PhotoReal** - Excellent but limited API
6. ⭐⭐⭐ **Stability SD3.5 + img2img** - Decent with reference
7. ⭐⭐⭐ **Fireworks/Together FLUX** - Text-to-image focused
8. ⭐⭐ **Others** - Limited reference support

---

## Recommendations for PinGlass

### Option 1: Hybrid Approach (Recommended)
**Use multiple APIs for redundancy and optimization:**

```javascript
// lib/ai-providers.ts
const providers = {
  primary: 'fal-flux',        // Fast, affordable, good quality
  fallback: 'fireworks-flux', // Even faster, cheaper fallback
  premium: 'replicate-face',  // Best quality for Pro users
};

// Cost: $0.46-0.92 per generation
// Speed: 1-3 minutes for 23 images
```

**Benefits:**
- Failover if one API is down
- A/B testing different models
- Cost optimization by provider
- Speed optimization (parallel calls)

### Option 2: Replace with Fal.ai (Best Value)
**Single provider, excellent price/performance:**

```javascript
// Migration path:
// 1. Replace lib/imagen.ts with lib/fal.ts
// 2. Use FLUX-dev for quality
// 3. 50% cost reduction vs Imagen
// 4. 2-3x faster generation
```

**Pros:**
- Simple migration
- Fastest inference
- Great pricing
- Good quality

**Cons:**
- Single point of failure
- Less face consistency than specialized models

### Option 3: Replicate face-to-many (Best Quality)
**Premium quality for face consistency:**

```javascript
// Use case: Pro users or high-end tier
// Cost: 3-4x current pricing
// Quality: Best-in-class face consistency
```

**Pros:**
- Purpose-built for PinGlass use case
- Excellent face consistency
- Multiple styles in one call

**Cons:**
- More expensive
- Slower generation
- Overkill for basic use

---

## Migration Strategy

### Phase 1: Add Fallback (Week 1)
```javascript
// app/api/generate/route.ts
async function generateWithFallback(prompt, references) {
  try {
    return await generateWithImagen(prompt, references);
  } catch (error) {
    console.error('Imagen failed, using Fal.ai fallback');
    return await generateWithFal(prompt, references);
  }
}
```

### Phase 2: A/B Test (Week 2-3)
```javascript
// Test 50/50 split
const provider = Math.random() > 0.5 ? 'imagen' : 'fal';
// Track quality metrics, user satisfaction
```

### Phase 3: Full Migration (Week 4)
```javascript
// Switch primary to Fal.ai
// Keep Imagen as fallback for 2 weeks
// Monitor errors and quality
```

### Phase 4: Optimize (Ongoing)
```javascript
// Parallel generation for speed
// Provider routing by load
// Cost optimization by time-of-day
```

---

## Implementation Examples

### Replicate Integration
```typescript
// lib/replicate.ts
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function generateWithReplicate(
  prompt: string,
  referenceImages: string[]
) {
  const output = await replicate.run(
    "black-forest-labs/flux-dev",
    {
      input: {
        prompt,
        guidance_scale: 3.5,
        num_inference_steps: 28,
        num_outputs: 1,
      }
    }
  );

  return output;
}

export async function generateFaceConsistent(
  referenceImage: string,
  prompts: string[]
) {
  const output = await replicate.run(
    "fofr/face-to-many:cd9d1e0280e0fa2c64dea2e6af2d0f0aa0a3f73ac807f5c8b6f00b0d93f38bce",
    {
      input: {
        image: referenceImage,
        prompt_array: prompts.join(" | "),
        num_outputs: prompts.length,
      }
    }
  );

  return output;
}
```

### Fal.ai Integration
```typescript
// lib/fal.ts
import * as fal from "@fal-ai/serverless-client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function generateWithFal(
  prompt: string,
  referenceImage?: string
) {
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt,
      image_url: referenceImage,
      num_images: 1,
      enable_safety_checker: true,
    },
    logs: true,
    onQueueUpdate: (update) => {
      console.log("Queue position:", update.position);
    },
  });

  return result.data.images[0].url;
}

export async function generateBatch(
  prompts: string[],
  referenceImage: string
) {
  // Parallel generation for speed
  const promises = prompts.map(prompt =>
    generateWithFal(prompt, referenceImage)
  );

  return await Promise.all(promises);
}
```

### Stability AI Integration
```typescript
// lib/stability.ts
export async function generateWithStability(
  prompt: string,
  referenceImage?: string
) {
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('output_format', 'png');

  if (referenceImage) {
    formData.append('image', referenceImage);
    formData.append('mode', 'image-to-image');
    formData.append('strength', '0.7');
  }

  const response = await fetch(
    'https://api.stability.ai/v2beta/stable-image/generate/sd3',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
        'Accept': 'image/*',
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Stability API error: ${response.statusText}`);
  }

  const imageBlob = await response.blob();
  return URL.createObjectURL(imageBlob);
}
```

### Multi-Provider Orchestration
```typescript
// lib/ai-orchestrator.ts
type Provider = 'imagen' | 'fal' | 'replicate' | 'stability' | 'fireworks';

interface ProviderConfig {
  name: Provider;
  priority: number;
  maxRetries: number;
  timeout: number;
}

const PROVIDERS: ProviderConfig[] = [
  { name: 'fal', priority: 1, maxRetries: 2, timeout: 30000 },
  { name: 'fireworks', priority: 2, maxRetries: 2, timeout: 30000 },
  { name: 'imagen', priority: 3, maxRetries: 1, timeout: 60000 },
];

export async function generateWithOrchestration(
  prompt: string,
  referenceImage: string
) {
  for (const provider of PROVIDERS) {
    for (let attempt = 0; attempt < provider.maxRetries; attempt++) {
      try {
        console.log(`Trying ${provider.name} (attempt ${attempt + 1})`);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), provider.timeout)
        );

        const generatePromise = generateWithProvider(
          provider.name,
          prompt,
          referenceImage
        );

        const result = await Promise.race([generatePromise, timeoutPromise]);

        console.log(`Success with ${provider.name}`);
        return { url: result, provider: provider.name };

      } catch (error) {
        console.error(`${provider.name} failed:`, error);
        if (attempt === provider.maxRetries - 1) {
          console.log(`Moving to next provider`);
        }
      }
    }
  }

  throw new Error('All providers failed');
}

async function generateWithProvider(
  provider: Provider,
  prompt: string,
  referenceImage: string
) {
  switch (provider) {
    case 'fal':
      return await generateWithFal(prompt, referenceImage);
    case 'fireworks':
      return await generateWithFireworks(prompt, referenceImage);
    case 'imagen':
      return await generateWithImagen(prompt, referenceImage);
    case 'replicate':
      return await generateWithReplicate(prompt, [referenceImage]);
    case 'stability':
      return await generateWithStability(prompt, referenceImage);
  }
}
```

---

## Testing Checklist

Before switching providers:

- [ ] Test face consistency across 23 generations
- [ ] Compare quality with current Imagen output
- [ ] Measure actual generation times
- [ ] Test error handling and retries
- [ ] Verify reference image format compatibility
- [ ] Check NSFW filtering (if required)
- [ ] Test batch processing performance
- [ ] Monitor API rate limits
- [ ] Calculate actual costs for 100 users
- [ ] Test with various photo qualities
- [ ] Verify output format (URL vs base64)
- [ ] Test webhook/callback support (if needed)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| API downtime | High | Multi-provider fallback |
| Cost overrun | Medium | Rate limiting, monitoring |
| Quality degradation | High | A/B testing, user feedback |
| Face inconsistency | Critical | Use specialized models, test extensively |
| Vendor lock-in | Medium | Abstract provider interface |
| NSFW content | Medium | Enable safety checkers |
| Rate limiting | Low | Queue system, retry logic |

---

## Next Steps

1. **Immediate:** Add Fal.ai as fallback to current Imagen setup
2. **Week 1:** Implement multi-provider orchestration layer
3. **Week 2:** A/B test Fal.ai vs Imagen with real users
4. **Week 3:** Optimize based on metrics (cost, speed, quality)
5. **Week 4:** Consider adding Replicate face-to-many for Pro tier

**Total estimated savings:** 40-60% on generation costs
**Speed improvement:** 2-3x faster generation
**Quality:** Comparable or better with FLUX models

---

## Resources

- Replicate Docs: https://replicate.com/docs
- Fal.ai Docs: https://fal.ai/docs
- Stability AI Docs: https://platform.stability.ai/docs
- Together AI Docs: https://docs.together.ai
- Fireworks AI Docs: https://docs.fireworks.ai

---

## Appendix: Code Snippets

### Environment Variables
```env
# Add to .env.local
REPLICATE_API_TOKEN=r8_...
FAL_KEY=...
STABILITY_API_KEY=sk-...
TOGETHER_API_KEY=...
FIREWORKS_API_KEY=...
```

### Package Installation
```bash
pnpm add replicate @fal-ai/serverless-client
```

### Type Definitions
```typescript
// types/ai-provider.ts
export interface GenerationRequest {
  prompt: string;
  referenceImages: string[];
  styleId: string;
  numOutputs?: number;
}

export interface GenerationResult {
  url: string;
  provider: string;
  generationTime: number;
  cost: number;
}

export interface AIProvider {
  name: string;
  generate(request: GenerationRequest): Promise<GenerationResult>;
  healthCheck(): Promise<boolean>;
}
```
