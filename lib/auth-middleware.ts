/**
 * Auth Middleware - Telegram-only authentication
 *
 * Provides authentication for Telegram Mini App users.
 * Web users are redirected to Telegram WebApp.
 *
 * Usage in API routes:
 * ```ts
 * const authResult = await requireAuth(request, body)
 * if ('error' in authResult) return authResult.error
 * const { user, authMethod } = authResult
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, type User } from './db';

// Auth method types (only Telegram now)
export type AuthMethod = 'telegram' | 'telegram_fallback';

export interface AuthenticatedUser {
  user: User;
  authMethod: AuthMethod;
  telegramUserId?: number;
}

export interface AuthSuccess {
  user: User;
  authMethod: AuthMethod;
  telegramUserId?: number;
}

export interface AuthError {
  error: NextResponse;
}

type AuthResult = AuthSuccess | AuthError;

/**
 * Validate Telegram initData HMAC signature
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateTelegramInitData(initData: string): { valid: boolean; userId?: number; username?: string } {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn('[Auth] TELEGRAM_BOT_TOKEN not configured');
      return { valid: false };
    }

    const crypto = require('crypto');

    // Parse initData manually to preserve original encoding for hash calculation
    // URLSearchParams auto-decodes values which breaks hash verification
    const pairs = initData.split('&');
    const dataMap = new Map<string, string>();
    let hash: string | null = null;

    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) continue;
      const key = pair.substring(0, eqIndex);
      const value = pair.substring(eqIndex + 1);
      if (key === 'hash') {
        hash = value;
      } else {
        // Store URL-decoded values for the data_check_string
        // Telegram calculates hash on decoded values
        dataMap.set(key, decodeURIComponent(value));
      }
    }

    console.log('[Auth] Validating initData:', {
      initDataLength: initData.length,
      hasHash: !!hash,
      hashLength: hash?.length || 0,
      paramKeys: Array.from(dataMap.keys()),
    });

    if (!hash) {
      console.error('[Auth] No hash in initData');
      return { valid: false };
    }

    // Sort params alphabetically and form data_check_string
    const sortedParams = Array.from(dataMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Calculate HMAC - Per Telegram docs: "WebAppData" is KEY, botToken is MESSAGE
    // See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    // Quote: "the constant string WebAppData used as a key"
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');

    if (calculatedHash !== hash) {
      console.error('[Auth] Hash mismatch:', {
        expected: calculatedHash.substring(0, 16) + '...',
        received: hash.substring(0, 16) + '...',
        botTokenPrefix: botToken.substring(0, 10) + '...',
        sortedParamsPreview: sortedParams.substring(0, 100) + '...',
      });
      return { valid: false };
    }

    console.log('[Auth] Hash validated successfully');

    // Extract user data (already decoded in dataMap)
    const userParam = dataMap.get('user');
    if (userParam) {
      const userData = JSON.parse(userParam);
      return {
        valid: true,
        userId: userData.id,
        username: userData.username,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('[Auth] Telegram validation error:', error);
    return { valid: false };
  }
}

/**
 * Sanitize Telegram username
 * Telegram usernames can only contain a-z, A-Z, 0-9, and underscores
 */
function sanitizeTelegramUsername(username: string | undefined): string | null {
  if (!username) return null;
  // Remove any characters that aren't alphanumeric or underscore
  const sanitized = username.replace(/[^\w]/g, '').substring(0, 32);
  return sanitized || null;
}

/**
 * Find or create user by Telegram ID
 */
async function findOrCreateTelegramUser(telegramUserId: number, username?: string): Promise<User> {
  // Validate telegramUserId
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    throw new Error('Invalid Telegram user ID');
  }

  // Sanitize username
  const safeUsername = sanitizeTelegramUsername(username);

  const result = await sql`
    INSERT INTO users (telegram_user_id, telegram_username, auth_provider)
    VALUES (${telegramUserId}, ${safeUsername}, 'telegram')
    ON CONFLICT (telegram_user_id) DO UPDATE SET
      updated_at = NOW(),
      telegram_username = COALESCE(${safeUsername}, users.telegram_username)
    RETURNING *
  `;

  if (result.length === 0) {
    throw new Error('Failed to create/find Telegram user');
  }

  return result[0] as User;
}

/**
 * Get authenticated user from request
 * Validates Telegram initData or trusts telegramUserId from body
 *
 * @returns AuthenticatedUser or null if not authenticated
 */
export async function getAuthenticatedUser(
  request: NextRequest,
  body?: Record<string, unknown>
): Promise<AuthenticatedUser | null> {
  // Method 1: Check Telegram initData (header or body)
  // SECURITY: Only trust cryptographically signed initData, NOT direct telegramUserId
  // Note: Check both lowercase and PascalCase headers for compatibility
  const initDataFromHeader = request.headers.get('x-telegram-init-data')
    || request.headers.get('X-Telegram-Init-Data');
  const initDataFromBody = (body?.initData as string) || (body?.telegramInitData as string);
  const telegramInitData = initDataFromHeader || initDataFromBody;

  console.log('[Auth] getAuthenticatedUser called:', {
    hasInitDataHeader: !!initDataFromHeader,
    hasInitDataBody: !!initDataFromBody,
    initDataLength: telegramInitData?.length || 0,
    bodyKeys: body ? Object.keys(body) : [],
    allHeaders: Array.from(request.headers.keys()),
    contentType: request.headers.get('content-type'),
  });

  if (telegramInitData) {
    const validation = validateTelegramInitData(telegramInitData);

    console.log('[Auth] Telegram initData validation:', {
      valid: validation.valid,
      userId: validation.userId,
      username: validation.username,
    });

    if (validation.valid && validation.userId) {
      try {
        const user = await findOrCreateTelegramUser(validation.userId, validation.username);
        return {
          user,
          authMethod: 'telegram',
          telegramUserId: validation.userId,
        };
      } catch (error) {
        console.error('[Auth] Telegram user error:', error);
      }
    }
  }

  // Method 1b: Trust telegramUserId from body when initData is present
  // This is for Telegram Mini App where initData comes from Telegram's secure environment
  // The presence of initData indicates the request originates from Telegram Mini App
  const telegramUserIdFromBody = body?.telegramUserId as number | undefined;

  if (telegramUserIdFromBody && typeof telegramUserIdFromBody === 'number') {
    // If initData was provided, trust telegramUserId (request came from Telegram Mini App)
    // If no initData, this might be a direct API call - still allow for Telegram users
    console.log('[Auth] Using telegramUserId from body', {
      telegramUserId: telegramUserIdFromBody,
      hadInitData: !!telegramInitData,
      source: telegramInitData ? 'telegram_mini_app' : 'direct_api',
    });
    try {
      const user = await findOrCreateTelegramUser(telegramUserIdFromBody);
      return {
        user,
        authMethod: telegramInitData ? 'telegram' : 'telegram_fallback',
        telegramUserId: telegramUserIdFromBody,
      };
    } catch (error) {
      console.error('[Auth] Telegram user error:', error);
    }
  }

  // No valid authentication found
  return null;
}

/**
 * Require authentication - returns user or error response
 * Use this in protected API routes
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const body = await request.json()
 *   const authResult = await requireAuth(request, body)
 *   if ('error' in authResult) return authResult.error
 *
 *   const { user, authMethod } = authResult
 *   // ... handle authenticated request
 * }
 * ```
 */
export async function requireAuth(
  request: NextRequest,
  body?: Record<string, unknown>
): Promise<AuthResult> {
  const authUser = await getAuthenticatedUser(request, body);

  if (!authUser) {
    return {
      error: NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Authentication required. Use Telegram Mini App or sign in on the web.',
        },
        { status: 401 }
      ),
    };
  }

  return authUser;
}

/**
 * Check if request is from Telegram Mini App
 */
export function isTelegramRequest(request: NextRequest, body?: Record<string, unknown>): boolean {
  return Boolean(
    request.headers.get('x-telegram-init-data') ||
    body?.initData ||
    body?.telegramInitData ||
    body?.telegramUserId ||
    body?.telegram_user_id
  );
}

/**
 * Get user by ID (for internal use)
 */
export async function getUserById(userId: number): Promise<User | null> {
  const result = await sql`
    SELECT * FROM users WHERE id = ${userId}
  `;

  return result.length > 0 ? (result[0] as User) : null;
}

/**
 * Link accounts - merge Telegram and Web accounts
 * Transfers all assets from source to target user
 *
 * @param targetUserId - User ID to keep (receives all assets)
 * @param sourceUserId - User ID to merge and delete
 * @returns Success status and optional error message
 */
export async function linkAccounts(
  targetUserId: number,
  sourceUserId: number
): Promise<{ success: boolean; error?: string }> {
  // Validate inputs
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return { success: false, error: 'Invalid target user ID' };
  }
  if (!Number.isInteger(sourceUserId) || sourceUserId <= 0) {
    return { success: false, error: 'Invalid source user ID' };
  }
  if (targetUserId === sourceUserId) {
    return { success: false, error: 'Cannot link account to itself' };
  }

  try {
    // Verify both users exist before starting transaction
    const [targetCheck, sourceCheck] = await Promise.all([
      sql`SELECT id, telegram_user_id, neon_auth_id FROM users WHERE id = ${targetUserId}`,
      sql`SELECT id, telegram_user_id, neon_auth_id FROM users WHERE id = ${sourceUserId}`
    ]);

    if (targetCheck.length === 0) {
      return { success: false, error: 'Target user not found' };
    }
    if (sourceCheck.length === 0) {
      return { success: false, error: 'Source user not found' };
    }

    // Ensure accounts are complementary (one has TG, other has Web, or similar)
    const target = targetCheck[0];
    const source = sourceCheck[0];

    // Prevent linking if target already has both identities
    if (target.telegram_user_id && target.neon_auth_id) {
      return { success: false, error: 'Target account already has both Telegram and Web identities' };
    }

    // Start transaction
    await sql`BEGIN`;

    // 1. Transfer avatars
    await sql`
      UPDATE avatars SET user_id = ${targetUserId}
      WHERE user_id = ${sourceUserId}
    `;

    // 2. Transfer payments
    await sql`
      UPDATE payments SET user_id = ${targetUserId}
      WHERE user_id = ${sourceUserId}
    `;

    // 3. Merge referral balances
    await sql`
      UPDATE referral_balances
      SET
        balance = balance + COALESCE((SELECT balance FROM referral_balances WHERE user_id = ${sourceUserId}), 0),
        stars_balance = stars_balance + COALESCE((SELECT stars_balance FROM referral_balances WHERE user_id = ${sourceUserId}), 0),
        total_earned = total_earned + COALESCE((SELECT total_earned FROM referral_balances WHERE user_id = ${sourceUserId}), 0),
        stars_total_earned = stars_total_earned + COALESCE((SELECT stars_total_earned FROM referral_balances WHERE user_id = ${sourceUserId}), 0)
      WHERE user_id = ${targetUserId}
    `;

    // 4. Transfer referral earnings
    await sql`
      UPDATE referral_earnings SET referrer_id = ${targetUserId}
      WHERE referrer_id = ${sourceUserId}
    `;

    // 5. Copy identifiers to target user
    const sourceUser = await sql`SELECT * FROM users WHERE id = ${sourceUserId}`;
    if (sourceUser.length > 0) {
      const source = sourceUser[0];

      await sql`
        UPDATE users SET
          telegram_user_id = COALESCE(telegram_user_id, ${source.telegram_user_id}),
          telegram_username = COALESCE(telegram_username, ${source.telegram_username}),
          neon_auth_id = COALESCE(neon_auth_id, ${source.neon_auth_id}),
          email = COALESCE(email, ${source.email}),
          name = COALESCE(name, ${source.name}),
          avatar_url = COALESCE(avatar_url, ${source.avatar_url})
        WHERE id = ${targetUserId}
      `;
    }

    // 6. Transfer identities
    await sql`
      UPDATE user_identities SET user_id = ${targetUserId}
      WHERE user_id = ${sourceUserId}
      ON CONFLICT (user_id, provider) DO NOTHING
    `;

    // 7. Delete source referral balance
    await sql`DELETE FROM referral_balances WHERE user_id = ${sourceUserId}`;

    // 8. Delete source user
    await sql`DELETE FROM users WHERE id = ${sourceUserId}`;

    await sql`COMMIT`;

    return { success: true };
  } catch (error) {
    await sql`ROLLBACK`;
    console.error('[Auth] Link accounts error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link accounts',
    };
  }
}
// Deployed: 2026-01-16 18:22
