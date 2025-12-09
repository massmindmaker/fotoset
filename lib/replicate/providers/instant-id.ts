// InstantID Provider
// Tertiary fallback for photorealistic portrait generation

import Replicate from 'replicate';
import type { GenerationOptions, GenerationResult, ModelType } from '../types';
import { PROVIDERS, getReplicateConfig, DEFAULT_NEGATIVE_PROMPT } from '../config';
import { prepareImageForApi } from '../utils/image-processor';

const config = getReplicateConfig();
const provider = PROVIDERS['instant-id'];

// Initialize Replicate client
const replicate = config.apiToken
  ? new Replicate({ auth: config.apiToken })
  : null;

export interface InstantIDInput {
  image: string;
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  ip_adapter_scale?: number;
  controlnet_conditioning_scale?: number;
  seed?: number;
  num_outputs?: number;
  enable_safety_checker?: boolean;
}

/**
 * Generate a single portrait using InstantID
 */
export async function generateWithInstantID(
  prompt: string,
  referenceImage: string,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  if (!replicate) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const startTime = Date.now();
  const defaults = provider.defaultOptions;

  // Prepare input for InstantID model
  const input: InstantIDInput = {
    image: prepareImageForApi(referenceImage),
    prompt: `${prompt}, high quality, detailed, photorealistic`,
    negative_prompt: options.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
    width: options.width || defaults.width,
    height: options.height || defaults.height,
    num_inference_steps: options.steps || defaults.steps,
    guidance_scale: options.guidanceScale ?? defaults.guidanceScale,
    ip_adapter_scale: 0.8, // Identity preservation strength
    controlnet_conditioning_scale: 0.8,
    num_outputs: 1,
    enable_safety_checker: true,
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
      model: 'instant-id' as ModelType,
      cost: provider.costPerImage,
      latencyMs,
      promptIndex: 0,
      retryCount: 0,
      seed: input.seed,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[InstantID] Generation failed:', errorMessage);

    throw error;
  }
}

/**
 * Test InstantID connection and model availability
 */
export async function testInstantIDConnection(): Promise<{
  success: boolean;
  message: string;
  modelInfo?: {
    name: string;
    owner: string;
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
      message: 'InstantID connected successfully',
      modelInfo: {
        name: model.name,
        owner: model.owner,
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
export function getInstantIDConfig() {
  return {
    modelId: provider.modelId,
    costPerImage: provider.costPerImage,
    defaultOptions: provider.defaultOptions,
    available: provider.available && !!config.apiToken,
  };
}
