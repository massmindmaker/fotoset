// Nano Banana Pro Provider (Google Gemini 3 Pro Image)
// Premium model with multi-reference support for face consistency

import Replicate from 'replicate';
import type { GenerationOptions, GenerationResult, ModelType } from '../types';
import { PROVIDERS, getReplicateConfig } from '../config';
import { prepareImageForApi } from '../utils/image-processor';

const config = getReplicateConfig();
const provider = PROVIDERS['nano-banana-pro'];

// Initialize Replicate client
const replicate = config.apiToken
  ? new Replicate({ auth: config.apiToken })
  : null;

export interface NanoBananaProInput {
  prompt: string;
  image_input?: string[];        // Up to 14 reference images
  resolution?: '1K' | '2K' | '4K';
  aspect_ratio?: 'match_input_image' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  output_format?: 'jpg' | 'png';
  safety_filter_level?: 'block_low_and_above' | 'block_medium_and_above' | 'block_only_high';
}

/**
 * Generate a single portrait using Nano Banana Pro
 * Key advantage: Supports up to 14 reference images for better face consistency
 */
export async function generateWithNanoBanana(
  prompt: string,
  referenceImages: string | string[],
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  if (!replicate) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const startTime = Date.now();

  // Prepare reference images (up to 14)
  const refs = Array.isArray(referenceImages) ? referenceImages : [referenceImages];
  const preparedRefs = refs.slice(0, 14).map(prepareImageForApi);

  // Determine resolution based on options
  let resolution: '1K' | '2K' | '4K' = '2K';
  if (options.width && options.height) {
    const maxDim = Math.max(options.width, options.height);
    if (maxDim <= 1024) resolution = '1K';
    else if (maxDim <= 2048) resolution = '2K';
    else resolution = '4K';
  }

  // Determine aspect ratio
  let aspectRatio: NanoBananaProInput['aspect_ratio'] = '1:1';
  if (options.width && options.height) {
    const ratio = options.width / options.height;
    if (Math.abs(ratio - 1) < 0.1) aspectRatio = '1:1';
    else if (Math.abs(ratio - 16/9) < 0.1) aspectRatio = '16:9';
    else if (Math.abs(ratio - 9/16) < 0.1) aspectRatio = '9:16';
    else if (Math.abs(ratio - 4/3) < 0.1) aspectRatio = '4:3';
    else if (Math.abs(ratio - 3/4) < 0.1) aspectRatio = '3:4';
    else aspectRatio = 'match_input_image';
  }

  // Build input
  const input: NanoBananaProInput = {
    prompt: prompt,
    resolution: resolution,
    aspect_ratio: aspectRatio,
    output_format: options.outputFormat === 'png' ? 'png' : 'jpg',
    safety_filter_level: 'block_only_high',
  };

  // Add reference images if available
  if (preparedRefs.length > 0) {
    input.image_input = preparedRefs;
  }

  try {
    // Run prediction
    const output = await replicate.run(
      provider.modelId as `${string}/${string}`,
      { input }
    );

    // Extract URL from output
    const imageUrl = Array.isArray(output) ? output[0] : output;

    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('No image URL in response');
    }

    const latencyMs = Date.now() - startTime;

    // Calculate actual cost based on resolution
    const costMultiplier = resolution === '4K' ? 2 : 1;
    const actualCost = provider.costPerImage * costMultiplier;

    return {
      url: imageUrl,
      success: true,
      model: 'nano-banana-pro' as ModelType,
      cost: actualCost,
      latencyMs,
      promptIndex: 0,
      retryCount: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NanoBananaPro] Generation failed:', errorMessage);

    throw error;
  }
}

/**
 * Test Nano Banana Pro connection and model availability
 */
export async function testNanoBananaConnection(): Promise<{
  success: boolean;
  message: string;
  modelInfo?: {
    name: string;
    owner: string;
    latestVersion?: string;
    runCount?: number;
  };
}> {
  if (!replicate) {
    return {
      success: false,
      message: 'REPLICATE_API_TOKEN is not configured',
    };
  }

  try {
    const [owner, name] = provider.modelId.split('/');
    const model = await replicate.models.get(owner, name);

    return {
      success: true,
      message: 'Nano Banana Pro connected successfully',
      modelInfo: {
        name: model.name,
        owner: model.owner,
        latestVersion: model.latest_version?.id,
        runCount: model.run_count,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get provider configuration
 */
export function getNanoBananaConfig() {
  return {
    modelId: provider.modelId,
    costPerImage: provider.costPerImage,
    cost4K: provider.costPerImage * 2, // $0.30 for 4K
    defaultOptions: provider.defaultOptions,
    maxReferenceImages: 14,
    maxPeopleConsistency: 5,
    available: provider.available && !!config.apiToken,
  };
}
