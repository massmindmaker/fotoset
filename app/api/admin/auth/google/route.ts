/**
 * GET /api/admin/auth/google
 * Initiates Google OAuth flow
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
                     `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/auth/google/callback`

  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    )
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID()

  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent'
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  // Set state in cookie for verification
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/'
  })

  return response
}
