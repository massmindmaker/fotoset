// Retry Logic with Exponential Backoff
// Handles transient errors with smart retries

import type { ReplicateErrorType, ReplicateError } from '../types';
import { RETRY_CONFIG } from '../config';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Categorize error for retry decision
 */
export function categorizeError(error: unknown): ReplicateErrorType {
  const message = (error as Error)?.message?.toLowerCase() || '';
  const statusCode = (error as { statusCode?: number })?.statusCode;

  // Rate limiting
  if (message.includes('rate limit') || statusCode === 429) {
    return 'RATE_LIMIT';
  }

  // Timeout
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'TIMEOUT';
  }

  // Server errors
  if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
    return 'SERVER_ERROR';
  }
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'SERVER_ERROR';
  }

  // Model capacity
  if (message.includes('overloaded') || message.includes('capacity')) {
    return 'MODEL_OVERLOADED';
  }

  // Network issues
  if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) {
    return 'NETWORK_ERROR';
  }

  // Invalid input
  if (message.includes('invalid') || message.includes('bad request') || statusCode === 400) {
    return 'INVALID_INPUT';
  }

  // NSFW content blocked
  if (message.includes('nsfw') || message.includes('safety') || message.includes('blocked')) {
    return 'NSFW_CONTENT';
  }

  // Payment/balance issues
  if (message.includes('balance') || message.includes('payment') || statusCode === 402) {
    return 'INSUFFICIENT_BALANCE';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Check if error type is retryable
 */
export function isRetryableError(errorType: ReplicateErrorType): boolean {
  return RETRY_CONFIG.retryableErrors.includes(errorType);
}

/**
 * Create a typed ReplicateError
 */
export function createReplicateError(
  error: unknown,
  provider?: string
): ReplicateError {
  const baseError = error instanceof Error ? error : new Error(String(error));
  const type = categorizeError(error);

  const replicateError = baseError as ReplicateError;
  replicateError.type = type;
  replicateError.retryable = isRetryableError(type);
  replicateError.statusCode = (error as { statusCode?: number })?.statusCode;
  replicateError.provider = provider as ReplicateError['provider'];

  return replicateError;
}

/**
 * Execute operation with retry logic and exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: ReplicateError, delayMs: number) => void;
  } = {}
): Promise<{ result: T; retryCount: number }> {
  const {
    maxRetries = RETRY_CONFIG.maxRetries || 3,
    initialDelayMs = RETRY_CONFIG.initialDelayMs,
    maxDelayMs = RETRY_CONFIG.maxDelayMs,
    backoffMultiplier = RETRY_CONFIG.backoffMultiplier,
    onRetry,
  } = options;

  let lastError: ReplicateError | null = null;
  let delay = initialDelayMs;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return { result, retryCount };
    } catch (error) {
      lastError = createReplicateError(error);
      retryCount = attempt;

      // Check if we should retry
      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError;
      }

      // Log retry attempt
      console.log(
        `[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.type}. ` +
        `Retrying in ${delay}ms...`
      );

      // Callback for monitoring
      if (onRetry) {
        onRetry(attempt + 1, lastError, delay);
      }

      // Wait before retry
      await sleep(delay);

      // Increase delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Rate limiter for batch operations
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number = 10, refillRate: number = 3) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      // Wait for a token to become available
      const waitTime = Math.ceil((1 / this.refillRate) * 1000);
      await sleep(waitTime);
      this.refill();
    }

    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
