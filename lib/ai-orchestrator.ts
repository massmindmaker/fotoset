/**
 * AI Provider Orchestration Layer
 * Manages multiple AI image generation providers with automatic fallback,
 * load balancing, and cost optimization
 *
 * Supported Providers:
 * - Google Imagen 3 (current)
 * - Fal.ai FLUX (fast, affordable)
 * - Replicate (premium quality)
 * - Stability AI (enterprise)
 */

import { generateWithImagen } from "./imagen";
import { generateWithFal, generateBatchWithFal, estimateCost as estimateFalCost } from "./fal";

export type AIProvider = "imagen" | "fal" | "replicate" | "stability" | "fireworks";

export interface GenerationRequest {
  prompt: string;
  referenceImages?: string[];
  width?: number;
  height?: number;
  styleId?: string;
}

export interface GenerationResult {
  url: string;
  provider: AIProvider;
  generationTime: number;
  estimatedCost: number;
  success: boolean;
  error?: string;
}

export interface ProviderConfig {
  name: AIProvider;
  priority: number; // Lower = higher priority
  maxRetries: number;
  timeout: number; // milliseconds
  enabled: boolean;
  costPerImage: number;
}

// Provider configuration (ordered by priority)
const PROVIDERS: ProviderConfig[] = [
  {
    name: "fal",
    priority: 1,
    maxRetries: 2,
    timeout: 30000, // 30 seconds
    enabled: !!process.env.FAL_KEY,
    costPerImage: 0.025,
  },
  {
    name: "imagen",
    priority: 2,
    maxRetries: 2,
    timeout: 60000, // 60 seconds
    enabled: !!process.env.GOOGLE_API_KEY,
    costPerImage: 0.04,
  },
  // Add more providers as needed
  // {
  //   name: "replicate",
  //   priority: 3,
  //   maxRetries: 1,
  //   timeout: 60000,
  //   enabled: !!process.env.REPLICATE_API_TOKEN,
  //   costPerImage: 0.05,
  // },
];

/**
 * Generate a single image with automatic provider fallback
 */
export async function generateImage(
  request: GenerationRequest,
  preferredProvider?: AIProvider
): Promise<GenerationResult> {
  // Get enabled providers sorted by priority
  let providers = PROVIDERS.filter((p) => p.enabled).sort(
    (a, b) => a.priority - b.priority
  );

  // If preferred provider specified, try it first
  if (preferredProvider) {
    const preferred = providers.find((p) => p.name === preferredProvider);
    if (preferred) {
      providers = [
        preferred,
        ...providers.filter((p) => p.name !== preferredProvider),
      ];
    }
  }

  if (providers.length === 0) {
    throw new Error("No AI providers are configured. Please set API keys in environment variables.");
  }

  console.log(
    `[AI Orchestrator] Attempting generation with ${providers.length} provider(s)`
  );

  // Try each provider until one succeeds
  for (const provider of providers) {
    for (let attempt = 1; attempt <= provider.maxRetries; attempt++) {
      try {
        console.log(
          `[AI Orchestrator] Trying ${provider.name} (attempt ${attempt}/${provider.maxRetries})`
        );

        const startTime = Date.now();

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${provider.timeout}ms`)),
            provider.timeout
          )
        );

        // Create generation promise
        const generationPromise = generateWithProvider(provider.name, request);

        // Race between generation and timeout
        const url = await Promise.race([generationPromise, timeoutPromise]);

        const generationTime = Date.now() - startTime;

        console.log(
          `[AI Orchestrator] Success with ${provider.name} in ${generationTime}ms`
        );

        return {
          url,
          provider: provider.name,
          generationTime,
          estimatedCost: provider.costPerImage,
          success: true,
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[AI Orchestrator] ${provider.name} attempt ${attempt} failed:`,
          errorMessage
        );

        // If this was the last attempt with this provider, continue to next
        if (attempt === provider.maxRetries) {
          console.log(`[AI Orchestrator] Moving to next provider`);
        } else {
          console.log(`[AI Orchestrator] Retrying with ${provider.name}`);
        }
      }
    }
  }

  // All providers failed
  throw new Error("All AI providers failed to generate the image");
}

/**
 * Generate multiple images in batch with intelligent provider selection
 */
export async function generateBatch(
  prompts: string[],
  referenceImage?: string,
  options: {
    parallel?: boolean;
    preferredProvider?: AIProvider;
  } = {}
): Promise<GenerationResult[]> {
  const { parallel = true, preferredProvider } = options;

  console.log(
    `[AI Orchestrator] Generating ${prompts.length} images (parallel: ${parallel})`
  );

  if (parallel) {
    // Generate all images in parallel for speed
    const promises = prompts.map((prompt) =>
      generateImage(
        {
          prompt,
          referenceImages: referenceImage ? [referenceImage] : undefined,
        },
        preferredProvider
      ).catch((error) => ({
        url: "",
        provider: "unknown" as AIProvider,
        generationTime: 0,
        estimatedCost: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }))
    );

    return await Promise.all(promises);
  } else {
    // Generate sequentially
    const results: GenerationResult[] = [];

    for (const prompt of prompts) {
      try {
        const result = await generateImage(
          {
            prompt,
            referenceImages: referenceImage ? [referenceImage] : undefined,
          },
          preferredProvider
        );
        results.push(result);
      } catch (error) {
        results.push({
          url: "",
          provider: "unknown" as AIProvider,
          generationTime: 0,
          estimatedCost: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}

/**
 * Generate with specific provider (internal helper)
 */
async function generateWithProvider(
  provider: AIProvider,
  request: GenerationRequest
): Promise<string> {
  const { prompt, referenceImages } = request;

  switch (provider) {
    case "fal":
      return await generateWithFal({
        prompt,
        referenceImage: referenceImages?.[0],
      });

    case "imagen":
      return await generateWithImagen(prompt, referenceImages || []);

    // Add more providers here as they're implemented
    // case "replicate":
    //   return await generateWithReplicate(prompt, referenceImages);
    //
    // case "stability":
    //   return await generateWithStability(prompt, referenceImages?.[0]);

    default:
      throw new Error(`Provider ${provider} not implemented`);
  }
}

/**
 * Get available providers and their status
 */
export function getProviderStatus(): Array<{
  name: AIProvider;
  enabled: boolean;
  priority: number;
  costPerImage: number;
}> {
  return PROVIDERS.map((p) => ({
    name: p.name,
    enabled: p.enabled,
    priority: p.priority,
    costPerImage: p.costPerImage,
  }));
}

/**
 * Estimate total cost for a batch generation
 */
export function estimateBatchCost(
  numImages: number,
  preferredProvider?: AIProvider
): {
  minCost: number;
  maxCost: number;
  preferredCost?: number;
} {
  const enabledProviders = PROVIDERS.filter((p) => p.enabled);

  if (enabledProviders.length === 0) {
    return { minCost: 0, maxCost: 0 };
  }

  const costs = enabledProviders.map((p) => p.costPerImage * numImages);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);

  let preferredCost: number | undefined;
  if (preferredProvider) {
    const preferred = enabledProviders.find((p) => p.name === preferredProvider);
    if (preferred) {
      preferredCost = preferred.costPerImage * numImages;
    }
  }

  return {
    minCost,
    maxCost,
    preferredCost,
  };
}

/**
 * Select best provider based on criteria
 */
export function selectProvider(criteria: {
  prioritizeSpeed?: boolean;
  prioritizeCost?: boolean;
  prioritizeQuality?: boolean;
}): AIProvider | null {
  const enabledProviders = PROVIDERS.filter((p) => p.enabled);

  if (enabledProviders.length === 0) {
    return null;
  }

  if (criteria.prioritizeCost) {
    // Return cheapest provider
    return enabledProviders.sort((a, b) => a.costPerImage - b.costPerImage)[0]
      .name;
  }

  if (criteria.prioritizeSpeed) {
    // Fal.ai is fastest
    const fal = enabledProviders.find((p) => p.name === "fal");
    if (fal) return fal.name;
  }

  if (criteria.prioritizeQuality) {
    // Imagen has best quality currently
    const imagen = enabledProviders.find((p) => p.name === "imagen");
    if (imagen) return imagen.name;
  }

  // Default: return highest priority (lowest priority number)
  return enabledProviders.sort((a, b) => a.priority - b.priority)[0].name;
}

/**
 * Generate with A/B testing
 * Randomly selects provider for experimentation
 */
export async function generateWithABTest(
  request: GenerationRequest,
  providers: AIProvider[] = ["fal", "imagen"]
): Promise<GenerationResult> {
  const enabledTestProviders = providers.filter((name) =>
    PROVIDERS.find((p) => p.name === name && p.enabled)
  );

  if (enabledTestProviders.length === 0) {
    throw new Error("No enabled providers for A/B test");
  }

  // Randomly select a provider
  const selectedProvider =
    enabledTestProviders[
      Math.floor(Math.random() * enabledTestProviders.length)
    ];

  console.log(`[A/B Test] Selected provider: ${selectedProvider}`);

  return await generateImage(request, selectedProvider);
}

/**
 * Health check for all providers
 */
export async function healthCheckAll(): Promise<
  Record<AIProvider, { healthy: boolean; latency?: number; error?: string }>
> {
  const results: any = {};

  const healthChecks = PROVIDERS.filter((p) => p.enabled).map(
    async (provider) => {
      const startTime = Date.now();

      try {
        // Simple test generation
        await generateWithProvider(provider.name, {
          prompt: "a simple test image",
          referenceImages: [],
        });

        results[provider.name] = {
          healthy: true,
          latency: Date.now() - startTime,
        };
      } catch (error) {
        results[provider.name] = {
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  await Promise.all(healthChecks);

  return results;
}

/**
 * Get generation statistics
 */
interface GenerationStats {
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  totalCost: number;
  averageGenerationTime: number;
  providerBreakdown: Record<AIProvider, number>;
}

export function calculateStats(results: GenerationResult[]): GenerationStats {
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const totalCost = successful.reduce((sum, r) => sum + r.estimatedCost, 0);
  const averageGenerationTime =
    successful.length > 0
      ? successful.reduce((sum, r) => sum + r.generationTime, 0) /
        successful.length
      : 0;

  const providerBreakdown: Record<string, number> = {};
  successful.forEach((r) => {
    providerBreakdown[r.provider] = (providerBreakdown[r.provider] || 0) + 1;
  });

  return {
    totalImages: results.length,
    successfulImages: successful.length,
    failedImages: failed.length,
    totalCost,
    averageGenerationTime,
    providerBreakdown: providerBreakdown as Record<AIProvider, number>,
  };
}
