// Replicate Provider Configuration
// Model settings and default options

import type { ModelType, ProviderConfig, GenerationOptions, ReplicateConfig } from './types';

// Environment-based configuration
export function getReplicateConfig(): ReplicateConfig {
  return {
    apiToken: process.env.REPLICATE_API_TOKEN || '',
    defaultModel: (process.env.REPLICATE_PRIMARY_MODEL as ModelType) || 'flux-pulid',
    maxRetries: parseInt(process.env.REPLICATE_MAX_RETRIES || '3', 10),
    timeoutMs: 120000, // 2 minutes per image
    budgetPerGeneration: parseFloat(process.env.REPLICATE_BUDGET_PER_GENERATION || '0.80'),
    enableFallback: process.env.REPLICATE_ENABLE_FALLBACK !== 'false',
  };
}

// Default negative prompt for quality
export const DEFAULT_NEGATIVE_PROMPT = [
  'deformed', 'distorted', 'disfigured', 'mutated',
  'bad anatomy', 'wrong anatomy', 'extra limbs', 'missing limbs',
  'floating limbs', 'disconnected limbs', 'extra fingers', 'missing fingers',
  'blurry', 'low quality', 'low resolution', 'pixelated',
  'watermark', 'signature', 'text', 'logo',
  'duplicate face', 'multiple faces', 'clone',
  'bad proportions', 'cropped', 'out of frame',
  'ugly', 'tiling', 'poorly drawn face', 'poorly drawn hands',
  'mutation', 'extra head', 'extra body',
].join(', ');

// Provider configurations
export const PROVIDERS: Record<ModelType, ProviderConfig> = {
  'flux-pulid': {
    name: 'flux-pulid',
    modelId: 'bytedance/flux-pulid',
    costPerImage: 0.022,
    maxBatchSize: 4,
    defaultOptions: {
      width: 896,
      height: 1152,
      steps: 20,
      idWeight: 1.0,
      guidanceScale: 4,
      outputFormat: 'webp',
      negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    },
    available: true,
  },
  'flux-kontext-pro': {
    name: 'flux-kontext-pro',
    modelId: 'black-forest-labs/flux-kontext-pro',
    costPerImage: 0.04,
    maxBatchSize: 1,
    defaultOptions: {
      width: 1024,
      height: 1024,
      outputFormat: 'webp',
    },
    available: true,
  },
  'instant-id': {
    name: 'instant-id',
    modelId: 'grandlineai/instant-id-photorealistic',
    costPerImage: 0.03,
    maxBatchSize: 1,
    defaultOptions: {
      width: 1024,
      height: 1024,
      steps: 30,
      guidanceScale: 5,
      outputFormat: 'png',
    },
    available: true,
  },
};

// Fallback order (primary to tertiary)
export const FALLBACK_ORDER: ModelType[] = [
  'flux-pulid',
  'flux-kontext-pro',
  'instant-id',
];

// Batch generation defaults
export const BATCH_DEFAULTS = {
  concurrency: 3,
  delayBetweenBatchesMs: 1000,
  maxRetries: 3,
  maxPhotosPerGeneration: 23,
  minReferenceImages: 1,
  maxReferenceImages: 20,
  topReferencesToUse: 5, // Rotate through top 5 quality images
};

// Retry configuration
export const RETRY_CONFIG = {
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
