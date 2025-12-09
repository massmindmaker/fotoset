// Replicate Integration Type Definitions
// For face-consistent portrait generation

export type ModelType =
  | 'flux-pulid'
  | 'flux-kontext-pro'
  | 'instant-id'
  | 'nano-banana-pro';

export interface ReplicateConfig {
  apiToken: string;
  defaultModel: ModelType;
  maxRetries: number;
  timeoutMs: number;
  budgetPerGeneration: number;
  enableFallback: boolean;
}

export interface GenerationInput {
  prompt: string;
  referenceImages: string[];
  options?: GenerationOptions;
}

export interface GenerationOptions {
  width?: number;           // 256-1536, default 896
  height?: number;          // 256-1536, default 1152
  steps?: number;           // 1-20, default 20
  idWeight?: number;        // 0-3, default 1.0
  guidanceScale?: number;   // 1-10, default 4
  seed?: number;
  outputFormat?: 'png' | 'jpg' | 'webp';
  negativePrompt?: string;
}

export interface GenerationResult {
  url: string;
  success: boolean;
  model: ModelType;
  cost: number;
  latencyMs: number;
  promptIndex: number;
  retryCount: number;
  error?: string;
  seed?: number;
}

export interface BatchProgress {
  completed: number;
  total: number;
  successful: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemainingMs: number;
  currentModel: ModelType;
}

export type ProgressCallback = (progress: BatchProgress) => void | Promise<void>;

export interface BatchConfig {
  concurrency: number;
  delayBetweenBatchesMs: number;
  maxRetries: number;
  webhookUrl?: string;
}

export interface CostMetrics {
  totalCost: number;
  imageCount: number;
  averageCostPerImage: number;
  byModel: Record<ModelType, number>;
  byStatus: {
    successful: number;
    failed: number;
    retried: number;
  };
}

export interface ReferenceImageScore {
  image: string;
  score: number;
  index: number;
}

export interface ProviderConfig {
  name: ModelType;
  modelId: string;
  costPerImage: number;
  maxBatchSize: number;
  defaultOptions: GenerationOptions;
  available: boolean;
}

// Error types for proper categorization
export type ReplicateErrorType =
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'MODEL_OVERLOADED'
  | 'NETWORK_ERROR'
  | 'INVALID_INPUT'
  | 'NSFW_CONTENT'
  | 'INSUFFICIENT_BALANCE'
  | 'UNKNOWN_ERROR';

export interface ReplicateError extends Error {
  type: ReplicateErrorType;
  retryable: boolean;
  statusCode?: number;
  provider?: ModelType;
}
