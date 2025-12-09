// FLUX PuLID Provider
// Primary model for identity-preserving portrait generation

import Replicate from 'replicate';
import type { GenerationOptions, GenerationResult, ModelType } from '../types';
import { PROVIDERS, getReplicateConfig } from '../config';
import { prepareImageForApi } from '../utils/image-processor';

const config = getReplicateConfig();
const provider = PROVIDERS['flux-pulid'];

// Initialize Replicate client
const replicate = config.apiToken
  ? new Replicate({ auth: config.apiToken })
  : null;

export interface PuLIDInput {
  main_face_image: string;
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_steps?: number;
  id_weight?: number;
  guidance_scale?: number;
  seed?: number;
  output_format?: 'png' | 'jpg' | 'webp';
  output_quality?: number;
  num_outputs?: number;
  start_step?: number;
}

/**
 * Generate a single portrait using FLUX PuLID
 */
export async function generateWithPuLID(
  prompt: string,
  referenceImage: string,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  if (!replicate) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const startTime = Date.now();
  const defaults = provider.defaultOptions;

  // Prepare input for PuLID model
  const input: PuLIDInput = {
    main_face_image: prepareImageForApi(referenceImage),
    prompt: prompt,
    negative_prompt: options.negativePrompt || defaults.negativePrompt,
    width: options.width || defaults.width,
    height: options.height || defaults.height,
    num_steps: options.steps || defaults.steps,
    id_weight: options.idWeight ?? defaults.idWeight,
    guidance_scale: options.guidanceScale ?? defaults.guidanceScale,
    output_format: options.outputFormat || defaults.outputFormat,
    output_quality: 80,
    num_outputs: 1,
    start_step: 0,
  };

  // Add seed if specified
  if (options.seed !== undefined) {
    input.seed = options.seed;
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

    return {
      url: imageUrl,
      success: true,
      model: 'flux-pulid' as ModelType,
      cost: provider.costPerImage,
      latencyMs,
      promptIndex: 0,
      retryCount: 0,
      seed: input.seed,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PuLID] Generation failed:', errorMessage);

    throw error;
  }
}

/**
 * Test PuLID connection and model availability
 */
export async function testPuLIDConnection(): Promise<{
  success: boolean;
  message: string;
  modelInfo?: {
    name: string;
    owner: string;
    latestVersion?: string;
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
      message: 'FLUX PuLID connected successfully',
      modelInfo: {
        name: model.name,
        owner: model.owner,
        latestVersion: model.latest_version?.id,
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
export function getPuLIDConfig() {
  return {
    modelId: provider.modelId,
    costPerImage: provider.costPerImage,
    defaultOptions: provider.defaultOptions,
    available: provider.available && !!config.apiToken,
  };
}
