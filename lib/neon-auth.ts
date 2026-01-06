/**
 * Neon Auth (Stack Auth) Configuration
 *
 * Provides authentication for web users via Google OAuth and Email magic links.
 * Works alongside existing Telegram Mini App authentication.
 *
 * @see https://docs.stack-auth.com/
 */

import { StackServerApp, StackClientApp } from '@stackframe/stack';

// Environment validation
const STACK_PROJECT_ID = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
const STACK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_KEY;
const STACK_SECRET_KEY = process.env.STACK_SECRET_SERVER_KEY;

// Check if Stack Auth is configured
export const isStackAuthConfigured = Boolean(
  STACK_PROJECT_ID && STACK_PUBLISHABLE_KEY && STACK_SECRET_KEY
);

/**
 * Stack Auth Server App
 * Use this in API routes and server components
 */
export const stackServerApp = isStackAuthConfigured
  ? new StackServerApp({
      tokenStore: 'nextjs-cookie',
      urls: {
        home: '/',
        signIn: '/auth/sign-in',
        signUp: '/auth/sign-up',
        afterSignIn: '/dashboard',
        afterSignUp: '/dashboard',
        afterSignOut: '/',
      },
    })
  : null;

/**
 * Stack Auth Client App
 * Use this in client components
 */
export const stackClientApp = isStackAuthConfigured
  ? new StackClientApp({
      tokenStore: 'nextjs-cookie',
      urls: {
        home: '/',
        signIn: '/auth/sign-in',
        signUp: '/auth/sign-up',
        afterSignIn: '/dashboard',
        afterSignUp: '/dashboard',
        afterSignOut: '/',
      },
    })
  : null;

/**
 * Get current Stack Auth user (server-side)
 * Returns null if not authenticated or Stack Auth not configured
 */
export async function getStackUser() {
  if (!stackServerApp) return null;

  try {
    const user = await stackServerApp.getUser();
    return user;
  } catch (error) {
    console.error('[Neon Auth] Error getting user:', error);
    return null;
  }
}

/**
 * Get Stack Auth user ID from current session
 * Returns the Stack Auth user ID or null
 */
export async function getStackUserId(): Promise<string | null> {
  const user = await getStackUser();
  return user?.id ?? null;
}

/**
 * Extract user info from Stack Auth user object
 */
export interface StackUserInfo {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  provider: 'google' | 'email' | 'github' | null;
}

export async function getStackUserInfo(): Promise<StackUserInfo | null> {
  const user = await getStackUser();
  if (!user) return null;

  // Determine primary auth provider from available user data
  // Stack Auth doesn't expose connectedAccounts directly on CurrentServerUser
  // We infer provider from email domain or fallback to 'email'
  let provider: StackUserInfo['provider'] = null;

  const email = user.primaryEmail;
  if (email) {
    // If user has email, assume email-based auth
    // OAuth providers (Google/GitHub) also provide email
    provider = 'email';
  }

  return {
    id: user.id,
    email: email ?? null,
    emailVerified: user.primaryEmailVerified ?? false,
    name: user.displayName ?? null,
    avatarUrl: user.profileImageUrl ?? null,
    provider,
  };
}

/**
 * Check if user is authenticated via Stack Auth
 */
export async function isStackAuthenticated(): Promise<boolean> {
  if (!stackServerApp) return false;
  const user = await getStackUser();
  return user !== null;
}

/**
 * Sign out from Stack Auth (server-side)
 */
export async function signOutStack() {
  if (!stackServerApp) return;

  try {
    await stackServerApp.signOut();
  } catch (error) {
    console.error('[Neon Auth] Error signing out:', error);
  }
}

// Type exports for use in other files
export type { StackServerApp, StackClientApp };
