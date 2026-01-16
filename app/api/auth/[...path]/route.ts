/**
 * Neon Auth API Handler
 *
 * Proxies all auth requests to Neon Auth (Better Auth).
 * Handles: sign-in, sign-out, OAuth callbacks, session management.
 *
 * Requires NEON_AUTH_BASE_URL environment variable.
 * If not configured, returns 503 Service Unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';

// Check if Neon Auth is configured
const isNeonAuthConfigured = Boolean(process.env.NEON_AUTH_BASE_URL);

// Fallback handler when Neon Auth is not configured
const notConfiguredHandler = async () => {
  return NextResponse.json(
    { error: 'AUTH_NOT_CONFIGURED', message: 'Neon Auth is not configured. Use Telegram login.' },
    { status: 503 }
  );
};

// Cached handler
let cachedHandler: ReturnType<typeof import('@neondatabase/auth/next/server').authApiHandler> | null = null;

async function getHandler() {
  if (!isNeonAuthConfigured) {
    return null;
  }
  if (!cachedHandler) {
    const { authApiHandler } = await import('@neondatabase/auth/next/server');
    cachedHandler = authApiHandler();
  }
  return cachedHandler;
}

export async function GET(request: NextRequest) {
  const handler = await getHandler();
  if (!handler) return notConfiguredHandler();
  return handler.GET(request);
}

export async function POST(request: NextRequest) {
  const handler = await getHandler();
  if (!handler) return notConfiguredHandler();
  return handler.POST(request);
}
