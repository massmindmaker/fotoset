/**
 * Next.js Edge Middleware
 *
 * SECURITY: Implements global security headers
 * - Runs on Edge Runtime (before API routes execute)
 * - Adds security headers to all responses
 * - Prevents common web vulnerabilities (XSS, clickjacking, MIME sniffing)
 *
 * NOTE: Rate limiting removed (2025-12-20)
 * - In-memory rate limiting doesn't work on Vercel serverless
 * - Protection provided by: Telegram auth, payment barrier, API quotas
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers configuration
 */
const SECURITY_HEADERS = {
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable browser XSS protection (legacy, but still useful)
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy - only send origin for cross-origin requests
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy - disable unnecessary browser features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://telegram.org https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.vercel-insights.com https://*.google.com https://*.googleapis.com https://api.yescale.ai wss://ws.yescale.ai https://*.sentry.io https://*.ingest.sentry.io https://api.replicate.com https://*.upstash.io https://qstash.upstash.io",
    "frame-src 'self' https://telegram.org https://yoomoney.ru https://securepayments.tinkoff.ru",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
  ].join('; '),

  // Strict Transport Security (HTTPS only) - only in production
  ...(process.env.NODE_ENV === 'production'
    ? {
        'Strict-Transport-Security':
          'max-age=31536000; includeSubDomains; preload',
      }
    : {}),
} as const;

/**
 * Middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create base response
  let response = NextResponse.next();

  // Add security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Additional security checks for specific routes
  if (pathname.startsWith('/api/generate')) {
    // Ensure POST method only
    if (request.method !== 'POST') {
      return new NextResponse(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  if (pathname.startsWith('/api/payment/create')) {
    // Ensure POST method only
    if (request.method !== 'POST') {
      return new NextResponse(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // CORS headers for API routes - SECURITY: Restrict to allowed origins only
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || 'https://fotoset.vercel.app',
      'https://fotoset.vercel.app',
      'https://pinglass.ru',
      'https://www.pinglass.ru',
      'https://telegram.org',
      'https://web.telegram.org',
    ];

    // Only set CORS headers if origin is allowed (SECURE: exact match only)
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    } else if (origin) {
      console.warn('[Security] Rejected CORS request from:', origin);
    }
    // For same-origin requests (no origin header), allow them through

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-device-id, x-telegram-init-data');
    response.headers.set('Access-Control-Max-Age', '86400');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      // Only respond to preflight if origin is allowed (SECURE: exact match)
      if (origin && allowedOrigins.includes(origin)) {
        return new NextResponse(null, { status: 204, headers: response.headers });
      }
      // Block preflight from unknown origins
      return new NextResponse(null, { status: 403 });
    }
  }

  return response;
}

/**
 * Matcher configuration
 * Middleware runs only on matched routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (meta files)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp)).*)',
  ],
};
