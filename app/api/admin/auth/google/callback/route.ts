/**
 * GET /api/admin/auth/google/callback
 * Google OAuth callback handler
 */

import { NextRequest, NextResponse } from 'next/server'
import { findOrCreateGoogleAdmin } from '@/lib/admin/auth'
import { createSession, setSessionCookie } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'

interface GoogleTokenResponse {
  access_token: string
  id_token: string
  expires_in: number
  token_type: string
}

interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Check for OAuth errors
  if (error) {
    console.error('[Google OAuth] Error:', error)
    return NextResponse.redirect(`${appUrl}/admin/login?error=oauth_error`)
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/admin/login?error=no_code`)
  }

  // Verify state
  const storedState = request.cookies.get('oauth_state')?.value
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/admin/login?error=invalid_state`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
                     `${appUrl}/api/admin/auth/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/admin/login?error=oauth_not_configured`)
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[Google OAuth] Token exchange error:', errorData)
      return NextResponse.redirect(`${appUrl}/admin/login?error=token_error`)
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json()

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    })

    if (!userResponse.ok) {
      console.error('[Google OAuth] User info error')
      return NextResponse.redirect(`${appUrl}/admin/login?error=user_info_error`)
    }

    const userInfo: GoogleUserInfo = await userResponse.json()

    if (!userInfo.email_verified) {
      return NextResponse.redirect(`${appUrl}/admin/login?error=email_not_verified`)
    }

    // Get IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    // Find or create admin
    const { admin, isNew } = await findOrCreateGoogleAdmin({
      googleId: userInfo.sub,
      email: userInfo.email,
      firstName: userInfo.given_name,
      lastName: userInfo.family_name,
      avatarUrl: userInfo.picture
    })

    // Create session
    const token = await createSession(
      admin.id,
      admin.email,
      admin.role,
      ipAddress,
      userAgent
    )

    await setSessionCookie(token)

    // Log successful login
    await logAdminAction({
      adminId: admin.id,
      action: 'login',
      metadata: { method: 'google', isNew },
      ipAddress
    })

    // Clear state cookie and redirect
    const response = NextResponse.redirect(`${appUrl}/admin`)
    response.cookies.delete('oauth_state')

    return response
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error)

    if (error instanceof Error && error.message === 'ADMIN_NOT_ALLOWED') {
      return NextResponse.redirect(`${appUrl}/admin/login?error=not_allowed`)
    }

    return NextResponse.redirect(`${appUrl}/admin/login?error=callback_error`)
  }
}
