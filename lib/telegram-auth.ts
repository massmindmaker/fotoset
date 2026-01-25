/**
 * Telegram WebApp authentication validator
 *
 * SECURITY: Validates Telegram Mini App initData using HMAC-SHA256
 * - Prevents unauthorized access via forged Telegram user data
 * - Follows official Telegram WebApp authentication protocol
 * - Returns validated user data or null if validation fails
 *
 * Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * NOTE: Uses Web Crypto API for Edge runtime compatibility
 */

import { authLogger as log } from './logger';

// Web Crypto HMAC-SHA256 helper
async function hmacSha256(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key instanceof ArrayBuffer ? key : new Uint8Array(key as ArrayBuffer),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const encoder = new TextEncoder();
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramInitData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  chat_instance?: string;
  chat_type?: string;
  start_param?: string;
}

/**
 * Parse Telegram initData string into object
 *
 * @param initDataRaw - Raw initData string from Telegram WebApp
 * @returns Parsed initData object
 */
function parseInitData(initDataRaw: string): Record<string, string> {
  // Parse manually to properly decode URL-encoded values
  // URLSearchParams has inconsistent decoding behavior
  const data: Record<string, string> = {};
  const pairs = initDataRaw.split('&');

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const key = pair.substring(0, eqIndex);
    const value = pair.substring(eqIndex + 1);
    // Explicitly decode URL-encoded values
    data[key] = decodeURIComponent(value);
  }

  return data;
}

/**
 * Validate Telegram WebApp initData
 *
 * Algorithm:
 * 1. Parse initData string into key-value pairs
 * 2. Remove 'hash' parameter
 * 3. Sort remaining parameters alphabetically
 * 4. Create data-check-string: key=value\nkey=value\n...
 * 5. Calculate secret key: HMAC-SHA256(bot_token, "WebAppData")
 * 6. Calculate hash: HMAC-SHA256(secret_key, data_check_string)
 * 7. Compare calculated hash with provided hash
 *
 * @param initDataRaw - Raw initData string from Telegram.WebApp.initData
 * @param botToken - Telegram bot token
 * @param maxAge - Maximum age of initData in seconds (default: 86400 = 24 hours)
 * @returns Validated TelegramInitData or null if invalid
 */
export async function validateTelegramInitData(
  initDataRaw: string,
  botToken: string,
  maxAge: number = 86400
): Promise<TelegramInitData | null> {
  try {
    // Parse initData
    const data = parseInitData(initDataRaw);

    // Extract hash
    const receivedHash = data.hash;
    if (!receivedHash) {
      log.error('Missing hash parameter');
      return null;
    }

    // Remove hash from data for validation
    delete data.hash;

    // Create data-check-string: sort keys alphabetically and join with \n
    const dataCheckString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n');

    // Calculate secret key: HMAC-SHA256(key="WebAppData", data=bot_token)
    // See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    // Quote: "the constant string WebAppData used as a key"
    const encoder = new TextEncoder();
    const secretKey = await hmacSha256(encoder.encode('WebAppData'), botToken);

    // Calculate expected hash: HMAC-SHA256(secret_key, data_check_string)
    const expectedHashBuffer = await hmacSha256(secretKey, dataCheckString);
    const expectedHash = arrayBufferToHex(expectedHashBuffer);

    // Constant-time comparison to prevent timing attacks
    if (!constantTimeCompare(expectedHash, receivedHash)) {
      log.error('Hash mismatch');
      return null;
    }

    // Check auth_date (prevent replay attacks)
    const authDate = parseInt(data.auth_date, 10);
    if (isNaN(authDate)) {
      log.error('Invalid auth_date');
      return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - authDate > maxAge) {
      log.error('initData too old');
      return null;
    }

    // Parse user data
    let user: TelegramUser | undefined;
    if (data.user) {
      try {
        user = JSON.parse(data.user);
      } catch (error) {
        log.error('Failed to parse user data:', error);
        return null;
      }
    }

    // Return validated data
    return {
      user,
      auth_date: authDate,
      hash: receivedHash,
      query_id: data.query_id,
      chat_instance: data.chat_instance,
      chat_type: data.chat_type,
      start_param: data.start_param,
    };
  } catch (error) {
    log.error('Validation error:', error);
    return null;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Extract device ID from Telegram user
 * Uses Telegram user ID as device identifier
 *
 * @param user - Validated Telegram user
 * @returns Device ID string
 */
export function getTelegramDeviceId(user: TelegramUser): string {
  return `tg_${user.id}`;
}

/**
 * Check if device ID is from Telegram
 *
 * @param deviceId - Device ID to check
 * @returns True if device ID is from Telegram
 */
export function isTelegramDeviceId(deviceId: string): boolean {
  return deviceId.startsWith('tg_');
}

/**
 * Middleware helper: validate Telegram auth from request
 *
 * @param request - HTTP request
 * @param botToken - Telegram bot token
 * @returns Validated init data or null
 */
export async function validateTelegramAuthFromRequest(
  request: Request,
  botToken: string
): Promise<TelegramInitData | null> {
  try {
    // Try to get initData from header
    const initDataHeader = request.headers.get('x-telegram-init-data');
    if (initDataHeader) {
      return validateTelegramInitData(initDataHeader, botToken);
    }

    // Try to get from body
    const body = await request.json();
    if (body.telegramInitData) {
      return validateTelegramInitData(body.telegramInitData, botToken);
    }

    return null;
  } catch (error) {
    log.error('Request validation error:', error);
    return null;
  }
}

/**
 * Create unauthorized response for invalid Telegram auth
 */
export function createUnauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized',
      message: 'Invalid Telegram authentication data',
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
