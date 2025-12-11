/**
 * In-memory rate limiter for Vercel serverless functions
 *
 * SECURITY: Implements rate limiting without Redis dependency
 * - Prevents abuse of generation, payment, and user endpoints
 * - Automatic cleanup of expired entries
 * - Per-key tracking (IP, device ID, etc.)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  check(key: string, maxRequests: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    // No entry or expired window - create new
    if (!entry || entry.resetTime < now) {
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
      };
    }

    // Within window - check limit
    if (entry.count < maxRequests) {
      entry.count++;
      this.store.set(key, entry);
      return {
        allowed: true,
        remaining: maxRequests - entry.count,
        resetTime: entry.resetTime,
      };
    }

    // Limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Singleton instance
const limiter = new InMemoryRateLimiter();

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Generation: 100 requests per hour (AI image generation)
  GENERATION: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Payment: 4 requests per hour (prevent payment spam)
  PAYMENT: {
    maxRequests: 4,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // User: 10 requests per hour (general API calls)
  USER: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Status check: 30 requests per hour (polling allowed but limited)
  STATUS: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Default: 20 requests per hour
  DEFAULT: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
} as const;;

/**
 * Check rate limit for a given key
 *
 * @param key - Unique identifier (IP address, device ID, etc.)
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result with allowed status and metadata
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  resetIn: number;
} {
  const result = limiter.check(key, maxRequests, windowMs);
  const resetIn = Math.ceil((result.resetTime - Date.now()) / 1000);

  return {
    ...result,
    resetIn,
  };
}

/**
 * Rate limit by endpoint type
 *
 * @param key - Unique identifier
 * @param type - Endpoint type from RATE_LIMITS
 */
export function checkRateLimitByType(
  key: string,
  type: keyof typeof RATE_LIMITS
): ReturnType<typeof checkRateLimit> {
  const config = RATE_LIMITS[type];
  return checkRateLimit(key, config.maxRequests, config.windowMs);
}

/**
 * Reset rate limit for a key (useful for testing or admin override)
 */
export function resetRateLimit(key: string): void {
  limiter.reset(key);
}

/**
 * Get client identifier from request
 * Priority: device ID > IP address > fallback
 */
export function getClientIdentifier(request: Request): string {
  // Try to get device ID from body
  const deviceId = request.headers.get('x-device-id');
  if (deviceId) {
    return `device:${deviceId}`;
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0].trim() || realIp || 'unknown';

  return `ip:${ip}`;
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(result: ReturnType<typeof checkRateLimit>): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${result.resetIn} seconds.`,
      resetIn: result.resetIn,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': result.resetIn.toString(),
        'X-RateLimit-Limit': '0',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.floor(result.resetTime / 1000).toString(),
      },
    }
  );
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  result: ReturnType<typeof checkRateLimit>
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', Math.floor(result.resetTime / 1000).toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Note: Cleanup is handled automatically via auto-cleanup interval
// Edge Runtime does not support process.on, so we rely on the interval-based cleanup
