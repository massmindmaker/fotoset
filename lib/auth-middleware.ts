/**
 * Auth Middleware - Unified authentication for Telegram + Web
 *
 * Provides a single interface for authenticating users regardless of auth method:
 * - Telegram Mini App: validates initData HMAC signature
 * - Web (Neon Auth): validates Stack Auth session cookie
 *
 * NOTE: Uses Web Crypto API for Edge runtime compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, type User } from './db';
import { getStackUserInfo, type StackUserInfo } from './neon-auth';

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

export type AuthMethod = 'telegram' | 'telegram_fallback' | 'neon_auth';

export interface AuthenticatedUser {
  user: User;
  authMethod: AuthMethod;
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

// ============================================================================
// Telegram Validation (Web Crypto)
// ============================================================================

/**
 * Validate Telegram initData HMAC signature (async for Web Crypto)
 */
async function validateTelegramInitData(initData: string): Promise<{ valid: boolean; userId?: number; username?: string }> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn('[Auth] TELEGRAM_BOT_TOKEN not configured');
      return { valid: false };
    }

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
        dataMap.set(key, decodeURIComponent(value));
      }
    }

    if (!hash) {
      console.error('[Auth] No hash in initData');
      return { valid: false };
    }

    const sortedParams = Array.from(dataMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Calculate HMAC using Web Crypto
    const encoder = new TextEncoder();
    const secretKeyBuffer = await hmacSha256(encoder.encode('WebAppData'), botToken);
    const calculatedHashBuffer = await hmacSha256(new Uint8Array(secretKeyBuffer), sortedParams);
    const calculatedHash = arrayBufferToHex(calculatedHashBuffer);

    if (calculatedHash !== hash) {
      console.error('[Auth] Hash mismatch');
      return { valid: false };
    }

    console.log('[Auth] Hash validated successfully');

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

// ============================================================================
// User Management
// ============================================================================

function sanitizeTelegramUsername(username: string | undefined): string | null {
  if (!username) return null;
  const sanitized = username.replace(/[^\w]/g, '').substring(0, 32);
  return sanitized || null;
}

async function findOrCreateTelegramUser(telegramUserId: number, username?: string): Promise<User> {
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    throw new Error('Invalid Telegram user ID');
  }

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

async function findOrCreateNeonAuthUser(stackUser: StackUserInfo): Promise<User> {
  const { id: neonAuthId, email, name, avatarUrl, provider } = stackUser;

  const safeName = name?.substring(0, 255) || null;
  const safeAvatarUrl = avatarUrl?.substring(0, 2048) || null;
  const safeProvider = provider || 'email';

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
    const user = result[0] as User;

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

// ============================================================================
// Authentication
// ============================================================================

export async function getAuthenticatedUser(
  request: NextRequest,
  body?: Record<string, unknown>
): Promise<AuthenticatedUser | null> {
  const initDataFromHeader = request.headers.get('x-telegram-init-data')
    || request.headers.get('X-Telegram-Init-Data');
  const initDataFromBody = (body?.initData as string) || (body?.telegramInitData as string);
  const telegramInitData = initDataFromHeader || initDataFromBody;

  if (telegramInitData) {
    const validation = await validateTelegramInitData(telegramInitData);

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

  const telegramUserIdFromBody = body?.telegramUserId as number | undefined;

  if (telegramUserIdFromBody && typeof telegramUserIdFromBody === 'number') {
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

export function isTelegramRequest(request: NextRequest, body?: Record<string, unknown>): boolean {
  return Boolean(
    request.headers.get('x-telegram-init-data') ||
    body?.initData ||
    body?.telegramInitData ||
    body?.telegramUserId ||
    body?.telegram_user_id
  );
}

export async function getUserById(userId: number): Promise<User | null> {
  const result = await sql`
    SELECT * FROM users WHERE id = ${userId}
  `;

  return result.length > 0 ? (result[0] as User) : null;
}

export async function linkAccounts(
  targetUserId: number,
  sourceUserId: number
): Promise<{ success: boolean; error?: string }> {
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

    const target = targetCheck[0];

    if (target.telegram_user_id && target.neon_auth_id) {
      return { success: false, error: 'Target account already has both Telegram and Web identities' };
    }

    await sql`BEGIN`;

    await sql`UPDATE avatars SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`;
    await sql`UPDATE payments SET user_id = ${targetUserId} WHERE user_id = ${sourceUserId}`;

    await sql`
      UPDATE referral_balances
      SET
        balance = balance + COALESCE((SELECT balance FROM referral_balances WHERE user_id = ${sourceUserId}), 0),
        stars_balance = stars_balance + COALESCE((SELECT stars_balance FROM referral_balances WHERE user_id = ${sourceUserId}), 0),
        total_earned = total_earned + COALESCE((SELECT total_earned FROM referral_balances WHERE user_id = ${sourceUserId}), 0),
        stars_total_earned = stars_total_earned + COALESCE((SELECT stars_total_earned FROM referral_balances WHERE user_id = ${sourceUserId}), 0)
      WHERE user_id = ${targetUserId}
    `;

    await sql`UPDATE referral_earnings SET referrer_id = ${targetUserId} WHERE referrer_id = ${sourceUserId}`;

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

    await sql`
      UPDATE user_identities SET user_id = ${targetUserId}
      WHERE user_id = ${sourceUserId}
      ON CONFLICT (user_id, provider) DO NOTHING
    `;

    await sql`DELETE FROM referral_balances WHERE user_id = ${sourceUserId}`;
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
