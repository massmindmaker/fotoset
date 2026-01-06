/**
 * MTProto Authentication API
 *
 * Handles admin authentication for Telegram MTProto API.
 * Required for Telegram Affiliate Program configuration.
 *
 * Endpoints:
 * - GET: Check auth status
 * - POST: Start auth / complete auth / complete 2FA
 * - DELETE: Logout
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  isMTProtoConfigured,
  isAuthenticated,
  startAuth,
  completeAuth,
  complete2FA,
  logout,
  getCurrentUser,
} from '@/lib/telegram-mtproto'

// Check auth status
export async function GET() {
  try {
    const configured = isMTProtoConfigured()

    if (!configured) {
      return NextResponse.json({
        configured: false,
        authenticated: false,
        error: 'TELEGRAM_API_ID and TELEGRAM_API_HASH not configured',
      })
    }

    const authenticated = await isAuthenticated()
    let user = null

    if (authenticated) {
      user = await getCurrentUser()
    }

    return NextResponse.json({
      configured: true,
      authenticated,
      user,
    })
  } catch (error) {
    console.error('[MTProto API] Status check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Auth actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, phoneNumber, code, password } = body

    if (!isMTProtoConfigured()) {
      return NextResponse.json(
        { error: 'MTProto not configured' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'start': {
        if (!phoneNumber) {
          return NextResponse.json(
            { error: 'Phone number required' },
            { status: 400 }
          )
        }

        const result = await startAuth(phoneNumber)
        return NextResponse.json(result)
      }

      case 'verify': {
        if (!code) {
          return NextResponse.json(
            { error: 'Verification code required' },
            { status: 400 }
          )
        }

        const result = await completeAuth(code)

        // Check if 2FA is needed
        if (!result.success && result.error === '2FA_REQUIRED') {
          return NextResponse.json({
            success: false,
            requires2FA: true,
          })
        }

        return NextResponse.json(result)
      }

      case '2fa': {
        if (!password) {
          return NextResponse.json(
            { error: '2FA password required' },
            { status: 400 }
          )
        }

        const result = await complete2FA(password)
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[MTProto API] Auth error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Logout
export async function DELETE() {
  try {
    const result = await logout()
    return NextResponse.json({ success: result })
  } catch (error) {
    console.error('[MTProto API] Logout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
