/**
 * Neon Auth (Better Auth) Configuration
 *
 * Provides authentication for web users via Google OAuth and Email.
 * Works alongside existing Telegram Mini App authentication.
 *
 * @see https://neon.tech/docs/guides/neon-auth
 */

// Re-export from new auth modules
export { authClient, useSession, signIn, signOut, signUp } from './auth/client';
export { authServer, getAuthUser, getAuthUserId, isAuthenticated, getAuthUserInfo } from './auth/server';
export type { NeonAuthUser } from './auth/server';

// Environment validation
const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL;

// Check if Neon Auth is configured
export const isNeonAuthConfigured = Boolean(NEON_AUTH_BASE_URL);

// Legacy exports for backward compatibility with auth-middleware.ts
export const isStackAuthConfigured = isNeonAuthConfigured;

// Legacy stackServerApp/stackClientApp replaced by authServer/authClient
export const stackServerApp = null; // Deprecated - use authServer
export const stackClientApp = null; // Deprecated - use authClient

/**
 * Legacy function - use getAuthUserInfo instead
 */
export interface StackUserInfo {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  provider: 'google' | 'email' | 'github' | null;
}

/**
 * Get Stack Auth user info (legacy compatibility)
 * Use getAuthUserInfo from './auth/server' for new code
 */
export async function getStackUserInfo(): Promise<StackUserInfo | null> {
  const { getAuthUserInfo } = await import('./auth/server');
  const user = await getAuthUserInfo();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    avatarUrl: user.image,
    provider: user.email ? 'email' : null, // Better Auth doesn't expose provider directly
  };
}

/**
 * Legacy getStackUser function
 */
export async function getStackUser() {
  const { getAuthUser } = await import('./auth/server');
  return getAuthUser();
}
