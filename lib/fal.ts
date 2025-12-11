/**
 * Fal.ai API Integration
 * Alternative AI image generation provider with fast inference and competitive pricing
 *
 * Benefits vs Imagen:
 * - 2-3x faster generation
 * - 40-50% cost reduction
 * - Same FLUX models as premium providers
 * - Built-in queue management
 */

import * as fal from "@fal-ai/serverless-client";

// Configure Fal.ai client
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

interface FalGenerationOptions {
  prompt: string;
  referenceImage?: string;
  width?: number;
  height?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  seed?: number;
  enableSafetyChecker?: boolean;
}

interface FalResult {
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type: string;
  }>;
  timings: {
    inference: number;
  };
  seed: number;
  has_nsfw_concepts: boolean[];
  prompt: string;
}

/**
 * Generate a single image using Fal.ai FLUX-dev model
 * Speed: 2-5 seconds
 * Cost: ~$0.025 per image
 */
export async function generateWithFal(
  options: FalGenerationOptions
): Promise<string> {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY environment variable is not set");
  }

  const {
    prompt,
    referenceImage,
    width = 1024,
    height = 1024,
    numInferenceSteps = 28,
    guidanceScale = 3.5,
    seed,
    enableSafetyChecker = true,
  } = options;

  console.log(`[Fal.ai] Generating image: ${prompt.substring(0, 50)}...`);

  try {
    const input: any = {
      prompt,
      num_images: 1,
      image_size: {
        width,
        height,
      },
      num_inference_steps: numInferenceSteps,
      guidance_scale: guidanceScale,
      enable_safety_checker: enableSafetyChecker,
    };

    // Add reference image if provided (for img2img)
    if (referenceImage) {
      input.image_url = referenceImage;
      input.strength = 0.7; // How much to transform the reference (0-1)
    }

    // Add seed for reproducibility if provided
    if (seed !== undefined) {
      input.seed = seed;
    }

    const result = await fal.subscribe("fal-ai/flux/dev", {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`[Fal.ai] Queue position: ${update.position || "processing"}`);
        }
      },
    }) as { data: FalResult };

    if (!result.data.images || result.data.images.length === 0) {
      throw new Error("No images returned from Fal.ai");
    }

    const imageUrl = result.data.images[0].url;
    const inferenceTime = result.data.timings?.inference || 0;

    console.log(`[Fal.ai] Generated in ${inferenceTime.toFixed(2)}s`);

    // Check for NSFW content
    if (enableSafetyChecker && result.data.has_nsfw_concepts?.[0]) {
      console.warn("[Fal.ai] NSFW content detected");
      throw new Error("Generated content flagged by safety checker");
    }

    return imageUrl;

  } catch (error) {
    console.error("[Fal.ai] Generation failed:", error);
    throw new Error(`Fal.ai generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate multiple images in parallel
 * Faster than sequential generation
 *
 * @param prompts Array of prompts to generate
 * @param referenceImage Optional reference image for consistency
 * @returns Array of image URLs
 */
export async function generateBatchWithFal(
  prompts: string[],
  referenceImage?: string
): Promise<string[]> {
  console.log(`[Fal.ai] Generating ${prompts.length} images in parallel`);

  const startTime = Date.now();

  // Generate all images in parallel for maximum speed
  const promises = prompts.map((prompt, index) =>
    generateWithFal({
      prompt,
      referenceImage,
      seed: index, // Different seed for each to avoid duplicates
    }).catch((error) => {
      console.error(`[Fal.ai] Failed to generate prompt ${index}:`, error);
      return null; // Return null for failed generations
    })
  );

  const results = await Promise.all(promises);

  // Filter out failed generations
  const successfulResults = results.filter((url): url is string => url !== null);

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(
    `[Fal.ai] Generated ${successfulResults.length}/${prompts.length} images in ${totalTime.toFixed(2)}s`
  );

  return successfulResults;
}

/**
 * Generate images using Fal.ai PhotoMaker for better face consistency
 * More expensive but better results for portrait use cases
 * Cost: ~$0.030 per image
 */
export async function generateWithPhotoMaker(
  prompt: string,
  referenceImages: string[], // Multiple reference images for better consistency
  numOutputs: number = 1
): Promise<string[]> {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY environment variable is not set");
  }

  console.log(`[Fal.ai PhotoMaker] Generating ${numOutputs} images`);

  try {
    const result = await fal.subscribe("fal-ai/photomaker", {
      input: {
        prompt,
        input_images: referenceImages.slice(0, 4), // Max 4 reference images
        num_outputs: numOutputs,
        num_inference_steps: 50,
        guidance_scale: 5.0,
        style_name: "Photographic (Default)",
      },
      logs: true,
    }) as { data: FalResult };

    const imageUrls = result.data.images.map((img) => img.url);
    console.log(`[Fal.ai PhotoMaker] Generated ${imageUrls.length} images`);

    return imageUrls;

  } catch (error) {
    console.error("[Fal.ai PhotoMaker] Generation failed:", error);
    throw new Error(`PhotoMaker generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fast SDXL generation for rapid prototyping
 * Speed: <1 second
 * Cost: ~$0.015 per image
 * Quality: Lower than FLUX but much faster
 */
export async function generateFastSDXL(
  prompt: string,
  referenceImage?: string
): Promise<string> {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY environment variable is not set");
  }

  console.log(`[Fal.ai Fast SDXL] Generating image`);

  try {
    const input: any = {
      prompt,
      num_images: 1,
    };

    if (referenceImage) {
      input.image_url = referenceImage;
    }

    const result = await fal.subscribe("fal-ai/fast-sdxl", {
      input,
    }) as { data: FalResult };

    return result.data.images[0].url;

  } catch (error) {
    console.error("[Fal.ai Fast SDXL] Generation failed:", error);
    throw new Error(`Fast SDXL generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Health check for Fal.ai API
 */
export async function checkFalHealth(): Promise<boolean> {
  try {
    // Simple test generation
    const result = await generateWithFal({
      prompt: "a simple test image",
      width: 512,
      height: 512,
      numInferenceSteps: 4, // Fast test
      enableSafetyChecker: false,
    });

    return !!result;
  } catch (error) {
    console.error("[Fal.ai] Health check failed:", error);
    return false;
  }
}

/**
 * Estimate cost for a batch generation
 *
 * @param numImages Number of images to generate
 * @param model Model to use ('flux' | 'photomaker' | 'fast-sdxl')
 * @returns Estimated cost in USD
 */
export function estimateCost(
  numImages: number,
  model: 'flux' | 'photomaker' | 'fast-sdxl' = 'flux'
): number {
  const costs = {
    flux: 0.025,
    photomaker: 0.030,
    'fast-sdxl': 0.015,
  };

  return numImages * costs[model];
}
