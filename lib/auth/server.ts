/**
 * Neon Auth Server
 *
 * Server-side authentication using Better Auth via Neon Auth.
 * Use in API routes and server components.
 */

import { createAuthServer } from '@neondatabase/auth/next/server';

export const authServer = createAuthServer();

/**
 * User info type from Neon Auth
 */
export interface NeonAuthUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
}

/**
 * Get current authenticated user from session
 * Returns null if not authenticated
 */
export async function getAuthUser(): Promise<NeonAuthUser | null> {
  try {
    const session = await authServer.getSession();
    if (!session || !('user' in session)) return null;

    const user = session.user as {
      id?: string;
      email?: string;
      emailVerified?: boolean;
      name?: string;
      image?: string | null;
    };

    if (!user || !user.id) return null;

    return {
      id: user.id,
      email: user.email ?? null,
      emailVerified: user.emailVerified ?? false,
      name: user.name ?? null,
      image: user.image ?? null,
    };
  } catch (error) {
    console.error('[Neon Auth] Error getting session:', error);
    return null;
  }
}

/**
 * Get user ID from current session
 */
export async function getAuthUserId(): Promise<string | null> {
  const user = await getAuthUser();
  return user?.id ?? null;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getAuthUser();
  return user !== null;
}

/**
 * Get structured user info (alias for getAuthUser)
 */
export async function getAuthUserInfo(): Promise<NeonAuthUser | null> {
  return getAuthUser();
}
