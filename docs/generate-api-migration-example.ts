/**
 * Example: Migrating Generate API to Multi-Provider Architecture
 *
 * This file shows the changes needed to integrate ai-orchestrator into
 * the existing app/api/generate/route.ts
 *
 * IMPORTANT: This is a reference example, not the actual implementation.
 * Use this as a guide when updating the real file.
 */

// ============================================================================
// BEFORE: Current Implementation (Imagen only)
// ============================================================================

// Old import
import { generateMultipleImages, type GenerationResult } from "@/lib/imagen"

// Old generation call (line 55-72)
const results: GenerationResult[] = await generateMultipleImages(
  mergedPrompts,
  validReferenceImages,
  {
    concurrency,
    maxRetries: GENERATION_CONFIG.maxRetries,
    onProgress: async (completed, total) => {
      if (completed % 3 === 0 || completed === total) {
        await sql`
          UPDATE generation_jobs
          SET completed_photos = ${completed}, updated_at = NOW()
          WHERE id = ${jobId}
        `
      }
    },
  }
)

// ============================================================================
// AFTER: Multi-Provider Implementation (with automatic fallback)
// ============================================================================

// New imports
import { generateBatch, calculateStats, selectProvider } from "@/lib/ai-orchestrator"
import type { GenerationResult as OrchestratorResult } from "@/lib/ai-orchestrator"

// NEW: Add provider selection logic at the top of runBackgroundGeneration
async function runBackgroundGeneration(params: {
  jobId: number
  dbAvatarId: number
  userId: number
  styleId: string
  mergedPrompts: string[]
  validReferenceImages: string[]
  totalPhotos: number
  startTime: number
  concurrency: number
  // NEW: Add optional provider preference
  preferredProvider?: 'imagen' | 'fal' | 'replicate'
}) {
  const {
    jobId,
    dbAvatarId,
    userId,
    styleId,
    mergedPrompts,
    validReferenceImages,
    totalPhotos,
    startTime,
    concurrency,
    preferredProvider, // NEW
  } = params

  let successCount = 0
  let failedCount = 0
  let firstPhotoUrl: string | null = null

  try {
    console.log(`[Generate Background] Starting job ${jobId} for avatar ${dbAvatarId}`)

    // NEW: Select provider based on user tier or preferences
    const provider = preferredProvider || selectProvider({
      prioritizeSpeed: true,  // For standard tier
      prioritizeCost: false,
      prioritizeQuality: false,
    })

    console.log(`[Generate Background] Using provider: ${provider}`)

    // Track progress manually since orchestrator doesn't have onProgress callback
    let completedCount = 0

    // NEW: Use orchestrator's generateBatch instead of generateMultipleImages
    const results: OrchestratorResult[] = await generateBatch(
      mergedPrompts,
      validReferenceImages[0], // Use first reference image
      {
        parallel: true, // Generate all in parallel for speed
        preferredProvider: provider,
      }
    )

    // Rest of the code remains the same - save photos to DB
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.success && result.url) {
        successCount++
        const originalPrompt = mergedPrompts[i]

        // Save photo to DB
        await sql`
          INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
          VALUES (${dbAvatarId}, ${styleId}, ${originalPrompt}, ${result.url})
        `

        // Set first photo as thumbnail
        if (!firstPhotoUrl) {
          firstPhotoUrl = result.url
          await sql`
            UPDATE avatars
            SET thumbnail_url = ${result.url}, updated_at = NOW()
            WHERE id = ${dbAvatarId}
          `
        }

        // Update progress every 3 photos
        completedCount++
        if (completedCount % 3 === 0 || completedCount === results.length) {
          await sql`
            UPDATE generation_jobs
            SET completed_photos = ${completedCount}, updated_at = NOW()
            WHERE id = ${jobId}
          `
        }
      } else {
        failedCount++
        console.error(`[Generate Background] Photo ${i} failed:`, result.error)
      }
    }

    // NEW: Log generation statistics
    const stats = calculateStats(results)
    console.log(`[Generate Background] Generation stats:`, {
      totalImages: stats.totalImages,
      successful: stats.successfulImages,
      failed: stats.failedImages,
      totalCost: `$${stats.totalCost.toFixed(3)}`,
      avgTime: `${(stats.averageGenerationTime / 1000).toFixed(1)}s`,
      providerBreakdown: stats.providerBreakdown,
    })

    // NEW: Save generation stats to database (optional)
    await sql`
      INSERT INTO generation_stats (
        job_id,
        provider,
        total_cost,
        avg_generation_time,
        success_rate
      ) VALUES (
        ${jobId},
        ${provider},
        ${stats.totalCost},
        ${stats.averageGenerationTime},
        ${stats.successfulImages / stats.totalImages}
      )
    `.catch(err => console.error("[Generate Background] Failed to save stats:", err))

    // Rest remains the same - update job status, send notifications, etc.
    const finalStatus = successCount > 0 ? "completed" : "failed"
    await sql`
      UPDATE generation_jobs
      SET status = ${finalStatus},
          completed_photos = ${successCount},
          error_message = ${failedCount > 0 ? `${failedCount} photos failed to generate` : null},
          updated_at = NOW()
      WHERE id = ${jobId}
    `

    // ... rest of the function unchanged ...
  } catch (error) {
    // ... error handling unchanged ...
  }
}

// ============================================================================
// ADVANCED: Provider Selection Based on User Tier
// ============================================================================

async function runBackgroundGenerationAdvanced(params: {
  // ... same params as before
  userId: number
}) {
  const { userId } = params

  // Get user tier from database
  const user = await sql`
    SELECT is_pro FROM users WHERE id = ${userId}
  `.then(rows => rows[0])

  // Select provider based on user tier
  let provider: 'imagen' | 'fal'
  if (user?.is_pro) {
    // Pro users: prioritize quality (Imagen)
    provider = selectProvider({ prioritizeQuality: true }) as 'imagen'
    console.log(`[Generate] Pro user - using premium provider: ${provider}`)
  } else {
    // Free users: prioritize speed and cost (Fal.ai)
    provider = selectProvider({ prioritizeSpeed: true }) as 'fal'
    console.log(`[Generate] Standard user - using fast provider: ${provider}`)
  }

  // Use selected provider for generation
  const results = await generateBatch(
    mergedPrompts,
    validReferenceImages[0],
    {
      parallel: true,
      preferredProvider: provider,
    }
  )

  // ... rest of processing
}

// ============================================================================
// OPTION: A/B Testing Integration
// ============================================================================

import { generateWithABTest } from "@/lib/ai-orchestrator"

async function runBackgroundGenerationWithABTest(params: any) {
  // Randomly assign users to test groups
  const testGroup = Math.random() > 0.5 ? 'fal' : 'imagen'

  console.log(`[A/B Test] User assigned to group: ${testGroup}`)

  // Generate with assigned provider
  const results = await generateBatch(
    mergedPrompts,
    validReferenceImages[0],
    {
      parallel: true,
      preferredProvider: testGroup,
    }
  )

  // Log test group for later analysis
  await sql`
    UPDATE generation_jobs
    SET metadata = jsonb_build_object('test_group', ${testGroup})
    WHERE id = ${jobId}
  `

  // ... rest of processing
}

// ============================================================================
// COST ESTIMATION: Show User Expected Cost Before Generation
// ============================================================================

import { estimateBatchCost } from "@/lib/ai-orchestrator"

// In the main POST handler, before creating the job
export async function POST(request: NextRequest) {
  // ... existing validation code ...

  // NEW: Estimate cost and show to user
  const provider = user.is_pro ? 'imagen' : 'fal'
  const costEstimate = estimateBatchCost(totalPhotos, provider)

  console.log(`[Generate] Cost estimate for ${totalPhotos} photos with ${provider}:`, {
    preferredCost: `$${costEstimate.preferredCost?.toFixed(3)}`,
    minCost: `$${costEstimate.minCost.toFixed(3)}`,
    maxCost: `$${costEstimate.maxCost.toFixed(3)}`,
  })

  // Create job with cost estimate
  const job = await sql`
    INSERT INTO generation_jobs (
      avatar_id,
      style_id,
      status,
      total_photos,
      estimated_cost -- NEW column
    ) VALUES (
      ${dbAvatarId},
      ${styleId},
      'processing',
      ${totalPhotos},
      ${costEstimate.preferredCost}
    ) RETURNING *
  `.then(rows => rows[0])

  // ... rest of handler

  // Return cost estimate to frontend
  return NextResponse.json({
    success: true,
    jobId: job.id,
    avatarId: dbAvatarId,
    status: "processing",
    totalPhotos,
    estimatedCost: costEstimate.preferredCost, // NEW
    provider, // NEW
    // ... rest of response
  })
}

// ============================================================================
// HEALTH CHECK: Monitor Provider Status
// ============================================================================

import { getProviderStatus } from "@/lib/ai-orchestrator"

// New endpoint: GET /api/generate/health
export async function GET_HEALTH(request: NextRequest) {
  const providerStatus = getProviderStatus()

  return NextResponse.json({
    providers: providerStatus,
    timestamp: new Date().toISOString(),
  })
}

// Example response:
// {
//   "providers": [
//     { "name": "fal", "enabled": true, "priority": 1, "costPerImage": 0.025 },
//     { "name": "imagen", "enabled": true, "priority": 2, "costPerImage": 0.04 }
//   ],
//   "timestamp": "2025-12-10T10:30:00Z"
// }

// ============================================================================
// MIGRATION CHECKLIST
// ============================================================================

/*
Step-by-step migration guide:

1. ✅ Install dependencies
   ```bash
   pnpm add @fal-ai/serverless-client
   ```

2. ✅ Add environment variable
   ```env
   FAL_KEY=your_fal_api_key
   ```

3. ✅ Update imports in app/api/generate/route.ts
   ```typescript
   import { generateBatch, calculateStats, selectProvider } from "@/lib/ai-orchestrator"
   ```

4. ✅ Replace generateMultipleImages call with generateBatch
   - Change parameters from generateMultipleImages format to generateBatch format
   - Update progress tracking (no built-in onProgress, track manually)

5. ✅ Add provider selection logic
   - Based on user tier (Pro vs Standard)
   - Or use selectProvider() for automatic selection

6. ✅ Add cost tracking and logging
   - Use calculateStats() to get generation metrics
   - Save to database for analytics

7. ✅ Test locally
   ```bash
   pnpm dev
   # Test generation with both providers
   ```

8. ✅ Deploy to staging
   ```bash
   vercel --prod
   ```

9. ✅ Monitor logs for errors
   ```bash
   vercel logs --follow
   ```

10. ✅ Compare results
    - Check generation quality
    - Compare costs
    - Measure speed improvements

Expected improvements:
- Speed: 3-4x faster (3-6 min → 1-2 min)
- Cost: 37-50% cheaper ($0.92 → $0.46-0.58)
- Reliability: Better uptime with automatic fallback
*/

// ============================================================================
// DATABASE SCHEMA UPDATES (Optional)
// ============================================================================

/*
Add these columns to track provider usage and costs:

-- Add to generation_jobs table
ALTER TABLE generation_jobs
ADD COLUMN estimated_cost DECIMAL(10,4),
ADD COLUMN actual_cost DECIMAL(10,4),
ADD COLUMN provider VARCHAR(20),
ADD COLUMN metadata JSONB;

-- Create new table for generation statistics
CREATE TABLE generation_stats (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES generation_jobs(id),
  provider VARCHAR(20) NOT NULL,
  total_cost DECIMAL(10,4),
  avg_generation_time INTEGER, -- milliseconds
  success_rate DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for analytics queries
CREATE INDEX idx_generation_stats_provider ON generation_stats(provider, created_at);
CREATE INDEX idx_generation_stats_job_id ON generation_stats(job_id);
*/

// ============================================================================
// ANALYTICS QUERIES
// ============================================================================

/*
-- Compare provider performance
SELECT
  provider,
  COUNT(*) as total_jobs,
  AVG(actual_cost) as avg_cost,
  AVG(avg_generation_time) as avg_time_ms,
  AVG(success_rate) as avg_success_rate
FROM generation_stats
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY provider;

-- Daily cost breakdown
SELECT
  DATE(created_at) as date,
  provider,
  COUNT(*) as jobs,
  SUM(total_cost) as total_cost,
  AVG(success_rate) as avg_success_rate
FROM generation_stats
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), provider
ORDER BY date DESC, provider;

-- User tier analysis
SELECT
  u.is_pro,
  gs.provider,
  COUNT(*) as generations,
  AVG(gs.total_cost) as avg_cost
FROM generation_stats gs
JOIN generation_jobs gj ON gs.job_id = gj.id
JOIN avatars a ON gj.avatar_id = a.id
JOIN users u ON a.user_id = u.id
WHERE gs.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.is_pro, gs.provider;
*/

// ============================================================================
// ROLLBACK PROCEDURE
// ============================================================================

/*
If issues occur after deployment:

1. Immediate rollback (no code changes needed):
   ```typescript
   // In ai-orchestrator.ts, disable Fal.ai provider
   const PROVIDERS: ProviderConfig[] = [
     {
       name: "fal",
       enabled: false, // ← Set to false
       // ...
     },
     {
       name: "imagen",
       enabled: true, // ← Ensure this is true
       // ...
     },
   ];
   ```

2. Redeploy:
   ```bash
   git commit -am "Disable Fal.ai provider"
   git push
   # Vercel auto-deploys
   ```

3. Or environment variable approach:
   ```env
   # In Vercel dashboard, comment out FAL_KEY
   # FAL_KEY=...
   ```

This will automatically fallback to Imagen only.

Monitor for 10-15 minutes to ensure stability before investigating issues.
*/
