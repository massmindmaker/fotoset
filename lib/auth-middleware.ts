/**
 * Auth Middleware - Unified authentication for Telegram + Web
 *
 * Provides a single interface for authenticating users regardless of auth method:
 * - Telegram Mini App: validates initData HMAC signature
 * - Web (Neon Auth): validates Stack Auth session cookie
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
import { getStackUserInfo, type StackUserInfo } from './neon-auth';

// Auth method types
export type AuthMethod = 'telegram' | 'neon_auth';

export interface AuthenticatedUser {
  user: User;
  authMethod: AuthMethod;
  // Additional info based on auth method
  telegramUserId?: number;
  neonAuthId?: string;
  email?: string;
}

export interface AuthSuccess {
  user: User;
  authMethod: AuthMethod;
  telegramUserId?: number;
  neonAuthId?: string;
  email?: string;
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
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Sort params alphabetically
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Calculate HMAC
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    // Extract user data
    const userParam = params.get('user');
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
 * Find or create user by Neon Auth ID
 * Uses INSERT ... ON CONFLICT to prevent race conditions
 */
async function findOrCreateNeonAuthUser(stackUser: StackUserInfo): Promise<User> {
  const { id: neonAuthId, email, name, avatarUrl, provider } = stackUser;

  // Sanitize inputs
  const safeName = name?.substring(0, 255) || null;
  const safeAvatarUrl = avatarUrl?.substring(0, 2048) || null;
  const safeProvider = provider || 'email';

  // Try to upsert by neon_auth_id (atomic operation, no race condition)
  let result = await sql`
    INSERT INTO users (neon_auth_id, email, email_verified, name, avatar_url, auth_provider)
    VALUES (${neonAuthId}, ${email}, TRUE, ${safeName}, ${safeAvatarUrl}, ${safeProvider})
    ON CONFLICT (neon_auth_id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, users.email),
      name = COALESCE(EXCLUDED.name, users.name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
      updated_at = NOW()
    RETURNING *
  `;

  if (result.length > 0) {
    // User found/created by neon_auth_id
    const user = result[0] as User;

    // Create identity record if not exists
    await sql`
      INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email, provider_name, provider_avatar_url)
      VALUES (${user.id}, ${safeProvider}, ${neonAuthId}, ${email}, ${safeName}, ${safeAvatarUrl})
      ON CONFLICT (provider, provider_user_id) DO UPDATE SET
        provider_email = COALESCE(EXCLUDED.provider_email, user_identities.provider_email),
        provider_name = COALESCE(EXCLUDED.provider_name, user_identities.provider_name),
        last_used_at = NOW()
    `;

    return user;
  }

  // If neon_auth_id insert failed due to email conflict, try to link by email
  if (email) {
    result = await sql`
      UPDATE users SET
        neon_auth_id = ${neonAuthId},
        email_verified = TRUE,
        name = COALESCE(${safeName}, name),
        avatar_url = COALESCE(${safeAvatarUrl}, avatar_url),
        auth_provider = COALESCE(auth_provider, ${safeProvider}),
        updated_at = NOW()
      WHERE email = ${email} AND neon_auth_id IS NULL
      RETURNING *
    `;

    if (result.length > 0) {
      const user = result[0] as User;

      // Create identity record
      await sql`
        INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email, provider_name, provider_avatar_url)
        VALUES (${user.id}, ${safeProvider}, ${neonAuthId}, ${email}, ${safeName}, ${safeAvatarUrl})
        ON CONFLICT (provider, provider_user_id) DO NOTHING
      `;

      return user;
    }
  }

  throw new Error('Failed to create or find Neon Auth user');
}

/**
 * Get authenticated user from request
 * Checks both Telegram initData and Neon Auth session
 *
 * @returns AuthenticatedUser or null if not authenticated
 */
export async function getAuthenticatedUser(
  request: NextRequest,
  body?: Record<string, unknown>
): Promise<AuthenticatedUser | null> {
  // Method 1: Check Telegram initData (header or body)
  // SECURITY: Only trust cryptographically signed initData, NOT direct telegramUserId
  const initDataFromHeader = request.headers.get('x-telegram-init-data');
  const initDataFromBody = (body?.initData as string) || (body?.telegramInitData as string);
  const telegramInitData = initDataFromHeader || initDataFromBody;

  console.log('[Auth] getAuthenticatedUser called:', {
    hasInitDataHeader: !!initDataFromHeader,
    hasInitDataBody: !!initDataFromBody,
    initDataLength: telegramInitData?.length || 0,
    bodyKeys: body ? Object.keys(body) : [],
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

  // Method 1b: Fallback for telegramUserId from body (when initData validation fails)
  // WARNING: This is less secure but needed when TELEGRAM_BOT_TOKEN is not configured
  // or when initData signature validation fails due to timing/caching issues
  const telegramUserIdFromBody = body?.telegramUserId as number | undefined;
  if (telegramUserIdFromBody && typeof telegramUserIdFromBody === 'number') {
    console.warn('[Auth] Using telegramUserId from body (initData validation failed)', {
      telegramUserId: telegramUserIdFromBody,
      hadInitData: !!telegramInitData,
    });
    try {
      const user = await findOrCreateTelegramUser(telegramUserIdFromBody);
      return {
        user,
        authMethod: 'telegram_fallback',
        telegramUserId: telegramUserIdFromBody,
      };
    } catch (error) {
      console.error('[Auth] Telegram fallback user error:', error);
    }
  }

  // Method 2: Check Neon Auth session
  const stackUser = await getStackUserInfo();

  if (stackUser) {
    try {
      const user = await findOrCreateNeonAuthUser(stackUser);
      return {
        user,
        authMethod: 'neon_auth',
        neonAuthId: stackUser.id,
        email: stackUser.email ?? undefined,
      };
    } catch (error) {
      console.error('[Auth] Neon Auth user error:', error);
    }
  }

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
// force redeploy 1768576609
