/**
 * Neon Auth API Handler
 *
 * Proxies all auth requests to Neon Auth (Better Auth).
 * Handles: sign-in, sign-out, OAuth callbacks, session management.
 */

import { authApiHandler } from '@neondatabase/auth/next/server';

export const { GET, POST } = authApiHandler();
