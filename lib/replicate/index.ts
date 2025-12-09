// Replicate Integration - Main Entry Point
// Multi-provider portrait generation with fallback chain

import type {
  ModelType,
  GenerationOptions,
  GenerationResult,
  BatchProgress,
  ProgressCallback,
  BatchConfig,
} from './types';
import {
  PROVIDERS,
  FALLBACK_ORDER,
  BATCH_DEFAULTS,
  getReplicateConfig,
} from './config';
import { withRetry, RateLimiter } from './utils/retry';
import { CostTracker, formatCost } from './utils/cost-tracker';
import {
  prepareReferenceImages,
  rotateReference,
  selectBestReferences,
} from './utils/image-processor';
import { generateWithPuLID, testPuLIDConnection } from './providers/flux-pulid';
import { generateWithKontext, testKontextConnection } from './providers/flux-kontext';
import { generateWithInstantID, testInstantIDConnection } from './providers/instant-id';

// Re-export types and utilities
export * from './types';
export { CostTracker, formatCost } from './utils/cost-tracker';
export { prepareReferenceImages } from './utils/image-processor';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a single portrait with automatic fallback
 */
export async function generatePortrait(
  prompt: string,
  referenceImage: string,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const config = getReplicateConfig();
  const errors: Array<{ provider: ModelType; error: string }> = [];

  // Determine providers to try
  const providersToTry = config.enableFallback
    ? FALLBACK_ORDER
    : [config.defaultModel];

  for (const providerName of providersToTry) {
    if (!PROVIDERS[providerName].available) {
      continue;
    }

    try {
      let result: GenerationResult;

      // Use retry logic for each provider
      const { result: retryResult, retryCount } = await withRetry(
        async () => {
          switch (providerName) {
            case 'flux-pulid':
              return generateWithPuLID(prompt, referenceImage, options);
            case 'flux-kontext-pro':
              return generateWithKontext(prompt, referenceImage, options);
            case 'instant-id':
              return generateWithInstantID(prompt, referenceImage, options);
            default:
              throw new Error(`Unknown provider: ${providerName}`);
          }
        },
        {
          maxRetries: config.maxRetries,
          onRetry: (attempt, error) => {
            console.log(`[${providerName}] Retry ${attempt}: ${error.type}`);
          },
        }
      );

      result = retryResult;
      result.retryCount = retryCount;

      console.log(`[Replicate] Generated with ${providerName} (${result.latencyMs}ms)`);
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ provider: providerName, error: errorMsg });
      console.error(`[${providerName}] Failed: ${errorMsg}`);
    }
  }

  // All providers failed
  const errorSummary = errors
    .map(e => `${e.provider}: ${e.error}`)
    .join('; ');
  throw new Error(`All providers failed: ${errorSummary}`);
}

/**
 * Generate batch of portraits with progress tracking
 */
export async function generateBatchPortraits(
  prompts: string[],
  referenceImages: string[],
  config: Partial<BatchConfig> = {},
  onProgress?: ProgressCallback
): Promise<GenerationResult[]> {
  const {
    concurrency = BATCH_DEFAULTS.concurrency,
    delayBetweenBatchesMs = BATCH_DEFAULTS.delayBetweenBatchesMs,
    maxRetries = BATCH_DEFAULTS.maxRetries,
  } = config;

  // Prepare reference images
  const { topReferences, rejected } = prepareReferenceImages(referenceImages);

  if (topReferences.length === 0) {
    throw new Error('No valid reference images provided');
  }

  if (rejected.length > 0) {
    console.warn(`[Replicate] Rejected ${rejected.length} invalid images`);
  }

  const results: GenerationResult[] = [];
  const costTracker = new CostTracker(getReplicateConfig().budgetPerGeneration);
  const rateLimiter = new RateLimiter(10, 3);

  const totalBatches = Math.ceil(prompts.length / concurrency);
  let successful = 0;
  let failed = 0;

  console.log(`[Replicate] Starting batch: ${prompts.length} images, ${totalBatches} batches`);
  console.log(`[Replicate] Using ${topReferences.length} reference images`);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * concurrency;
    const batchPrompts = prompts.slice(batchStart, batchStart + concurrency);

    // Rotate reference image for variety
    const batchRef = rotateReference(topReferences, batchIndex);

    console.log(`[Replicate] Batch ${batchIndex + 1}/${totalBatches}`);

    // Process batch
    const batchResults = await Promise.allSettled(
      batchPrompts.map(async (prompt, idx) => {
        await rateLimiter.acquire();

        const globalIndex = batchStart + idx;
        const seed = Date.now() + batchIndex * 1000 + idx;

        const result = await generatePortrait(prompt, batchRef, {
          seed,
        });

        result.promptIndex = globalIndex;
        return result;
      })
    );

    // Process results
    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const globalIndex = batchStart + i;

      if (result.status === 'fulfilled') {
        results.push(result.value);
        costTracker.trackGeneration(result.value.model, true, result.value.retryCount > 0);
        successful++;
        console.log(`[Replicate] Image ${globalIndex + 1}/${prompts.length} OK`);
      } else {
        const errorMsg = result.reason instanceof Error
          ? result.reason.message
          : 'Unknown error';

        results.push({
          url: '/generation-failed.jpg',
          success: false,
          model: 'flux-pulid',
          cost: 0,
          latencyMs: 0,
          promptIndex: globalIndex,
          retryCount: maxRetries,
          error: errorMsg,
        });
        costTracker.trackGeneration('flux-pulid', false, true);
        failed++;
        console.error(`[Replicate] Image ${globalIndex + 1}/${prompts.length} FAILED: ${errorMsg}`);
      }
    }

    // Progress callback
    if (onProgress) {
      const completed = batchStart + batchPrompts.length;
      const remainingBatches = totalBatches - batchIndex - 1;
      const estimatedTimeRemainingMs = remainingBatches * (delayBetweenBatchesMs + 15000); // ~15s per batch

      await onProgress({
        completed,
        total: prompts.length,
        successful,
        failed,
        currentBatch: batchIndex + 1,
        totalBatches,
        estimatedTimeRemainingMs,
        currentModel: 'flux-pulid',
      });
    }

    // Budget check
    if (!costTracker.isWithinBudget()) {
      console.warn(`[Replicate] Budget exceeded! ${costTracker.getSummary()}`);
      break;
    }

    // Rate limit delay between batches
    if (batchIndex < totalBatches - 1) {
      await sleep(delayBetweenBatchesMs);
    }
  }

  // Final summary
  console.log(`[Replicate] Complete: ${costTracker.getSummary()}`);

  return results;
}

/**
 * Test all provider connections
 */
export async function testConnections(): Promise<Record<ModelType, {
  available: boolean;
  connected: boolean;
  message: string;
  costPerImage: number;
}>> {
  const results: Record<ModelType, {
    available: boolean;
    connected: boolean;
    message: string;
    costPerImage: number;
  }> = {} as Record<ModelType, {
    available: boolean;
    connected: boolean;
    message: string;
    costPerImage: number;
  }>;

  // Test PuLID
  const pulidTest = await testPuLIDConnection();
  results['flux-pulid'] = {
    available: PROVIDERS['flux-pulid'].available,
    connected: pulidTest.success,
    message: pulidTest.message,
    costPerImage: PROVIDERS['flux-pulid'].costPerImage,
  };

  // Test Kontext
  const kontextTest = await testKontextConnection();
  results['flux-kontext-pro'] = {
    available: PROVIDERS['flux-kontext-pro'].available,
    connected: kontextTest.success,
    message: kontextTest.message,
    costPerImage: PROVIDERS['flux-kontext-pro'].costPerImage,
  };

  // Test InstantID
  const instantIDTest = await testInstantIDConnection();
  results['instant-id'] = {
    available: PROVIDERS['instant-id'].available,
    connected: instantIDTest.success,
    message: instantIDTest.message,
    costPerImage: PROVIDERS['instant-id'].costPerImage,
  };

  return results;
}

/**
 * Get provider info for UI display
 */
export function getProviderInfo(): {
  primary: ModelType;
  fallbackEnabled: boolean;
  providers: Array<{
    name: ModelType;
    costPerImage: number;
    available: boolean;
  }>;
  estimatedCostFor23: number;
} {
  const config = getReplicateConfig();
  const primaryCost = PROVIDERS[config.defaultModel].costPerImage;

  return {
    primary: config.defaultModel,
    fallbackEnabled: config.enableFallback,
    providers: FALLBACK_ORDER.map(name => ({
      name,
      costPerImage: PROVIDERS[name].costPerImage,
      available: PROVIDERS[name].available && !!config.apiToken,
    })),
    estimatedCostFor23: primaryCost * 23 * 1.1, // 10% retry buffer
  };
}

/**
 * Estimate generation cost
 */
export function estimateCost(
  imageCount: number,
  model: ModelType = 'flux-pulid'
): {
  baseCost: number;
  withRetries: number;
  formatted: string;
} {
  const costPerImage = PROVIDERS[model].costPerImage;
  const baseCost = imageCount * costPerImage;
  const withRetries = baseCost * 1.1;

  return {
    baseCost,
    withRetries,
    formatted: `${formatCost(baseCost)} - ${formatCost(withRetries)}`,
  };
}
