// FLUX Kontext Pro Provider
// Secondary model for stylized portrait generation

import Replicate from 'replicate';
import type { GenerationOptions, GenerationResult, ModelType } from '../types';
import { PROVIDERS, getReplicateConfig } from '../config';
import { prepareImageForApi } from '../utils/image-processor';

const config = getReplicateConfig();
const provider = PROVIDERS['flux-kontext-pro'];

// Initialize Replicate client with useFileOutput: false to get URLs directly
const replicate = config.apiToken
  ? new Replicate({ auth: config.apiToken, useFileOutput: false })
  : null;

export interface KontextInput {
  image: string;
  prompt: string;
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  output_format?: 'png' | 'jpg' | 'webp';
  output_quality?: number;
  safety_tolerance?: number;
}

/**
 * Generate a single portrait using FLUX Kontext Pro
 */
export async function generateWithKontext(
  prompt: string,
  referenceImage: string,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  if (!replicate) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const startTime = Date.now();
  const defaults = provider.defaultOptions;

  // Determine aspect ratio from dimensions
  let aspectRatio: KontextInput['aspect_ratio'] = '1:1';
  const width = options.width || defaults.width || 1024;
  const height = options.height || defaults.height || 1024;

  if (width > height) {
    aspectRatio = width / height >= 1.7 ? '16:9' : '4:3';
  } else if (height > width) {
    aspectRatio = height / width >= 1.7 ? '9:16' : '3:4';
  }

  // Prepare input for Kontext model
  const input: KontextInput = {
    image: prepareImageForApi(referenceImage),
    prompt: `Transform this person: ${prompt}. Keep the same facial features and identity.`,
    aspect_ratio: aspectRatio,
    output_format: options.outputFormat || defaults.outputFormat || 'webp',
    output_quality: 80,
    safety_tolerance: 2,
  };

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
      model: 'flux-kontext-pro' as ModelType,
      cost: provider.costPerImage,
      latencyMs,
      promptIndex: 0,
      retryCount: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Kontext] Generation failed:', errorMessage);

    throw error;
  }
}

/**
 * Test Kontext connection and model availability
 */
export async function testKontextConnection(): Promise<{
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
      message: 'FLUX Kontext Pro connected successfully',
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
export function getKontextConfig() {
  return {
    modelId: provider.modelId,
    costPerImage: provider.costPerImage,
    defaultOptions: provider.defaultOptions,
    available: provider.available && !!config.apiToken,
  };
}
