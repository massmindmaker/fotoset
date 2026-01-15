/**
 * Fetch with timeout utility
 *
 * Prevents hanging requests that could exhaust Vercel function timeout
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number // milliseconds
}

/**
 * Fetch with automatic timeout using AbortController
 * Default timeout: 30 seconds
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms: ${url}`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Preset timeouts for different services
 */
export const TIMEOUTS = {
  TELEGRAM_API: 15000,    // 15s - Telegram Bot API
  R2_UPLOAD: 30000,       // 30s - Cloudflare R2 operations
  KIE_API: 10000,         // 10s - Kie.ai task creation
  TBANK_API: 15000,       // 15s - T-Bank payment API
  EXTERNAL_IMAGE: 20000,  // 20s - External image download
} as const
