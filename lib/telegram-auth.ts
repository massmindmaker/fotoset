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

// ============================================================================
// Web Crypto Helpers (Edge compatible)
// ============================================================================

async function hmacSha256(key: Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
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

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse Telegram initData string into object
 */
function parseInitData(initDataRaw: string): Record<string, string> {
  const data: Record<string, string> = {};
  const pairs = initDataRaw.split('&');

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const key = pair.substring(0, eqIndex);
    const value = pair.substring(eqIndex + 1);
    data[key] = decodeURIComponent(value);
  }

  return data;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Telegram WebApp initData (async for Web Crypto)
 */
export async function validateTelegramInitData(
  initDataRaw: string,
  botToken: string,
  maxAge: number = 86400
): Promise<TelegramInitData | null> {
  try {
    const data = parseInitData(initDataRaw);

    const receivedHash = data.hash;
    if (!receivedHash) {
      log.error('Missing hash parameter');
      return null;
    }

    delete data.hash;

    const dataCheckString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n');

    // Calculate secret key: HMAC-SHA256(key="WebAppData", data=bot_token)
    const encoder = new TextEncoder();
    const secretKeyBuffer = await hmacSha256(encoder.encode('WebAppData'), botToken);

    // Calculate expected hash: HMAC-SHA256(secret_key, data_check_string)
    const expectedHashBuffer = await hmacSha256(new Uint8Array(secretKeyBuffer), dataCheckString);
    const expectedHash = arrayBufferToHex(expectedHashBuffer);

    if (!constantTimeCompare(expectedHash, receivedHash)) {
      log.error('Hash mismatch');
      return null;
    }

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

    let user: TelegramUser | undefined;
    if (data.user) {
      try {
        user = JSON.parse(data.user);
      } catch (error) {
        log.error('Failed to parse user data:', error);
        return null;
      }
    }

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

// ============================================================================
// Helpers
// ============================================================================

export function getTelegramDeviceId(user: TelegramUser): string {
  return `tg_${user.id}`;
}

export function isTelegramDeviceId(deviceId: string): boolean {
  return deviceId.startsWith('tg_');
}

export async function validateTelegramAuthFromRequest(
  request: Request,
  botToken: string
): Promise<TelegramInitData | null> {
  try {
    const initDataHeader = request.headers.get('x-telegram-init-data');
    if (initDataHeader) {
      return await validateTelegramInitData(initDataHeader, botToken);
    }

    const body = await request.json();
    if (body.telegramInitData) {
      return await validateTelegramInitData(body.telegramInitData, botToken);
    }

    return null;
  } catch (error) {
    log.error('Request validation error:', error);
    return null;
  }
}

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
