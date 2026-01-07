'use client';

/**
 * Neon Auth Client
 *
 * Client-side authentication using Better Auth via Neon Auth.
 * Use in React components for auth state and sign-in/sign-out.
 */

import { createAuthClient } from '@neondatabase/auth/next';

export const authClient = createAuthClient();

// Export hooks for use in components
export const { useSession, signIn, signOut, signUp } = authClient;
