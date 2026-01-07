/**
 * MTProto Authentication API
 *
 * POST /api/admin/mtproto
 * Actions: start-auth, verify-code, verify-2fa, logout, status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import {
  isMTProtoConfigured,
  startAuth,
  completeAuth,
  complete2FA,
  logout,
  getCurrentUser,
  isAuthenticated,
} from '@/lib/telegram-mtproto'

export async function POST(request: NextRequest) {
  try {
    // Check admin session
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Check if MTProto is configured
    if (!isMTProtoConfigured()) {
      return NextResponse.json(
        { error: 'MTProto not configured. Set TELEGRAM_API_ID and TELEGRAM_API_HASH.' },
        { status: 500 }
      )
    }

    switch (action) {
      case 'start':
      case 'start-auth': {
        const { phoneNumber } = body
        if (!phoneNumber) {
          return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
        }

        console.log('[MTProto API] Starting auth for:', phoneNumber)
        const result = await startAuth(phoneNumber)
        console.log('[MTProto API] Start auth result:', result)

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          requiresCode: result.requiresCode,
        })
      }

      case 'verify':
      case 'verify-code': {
        const { code } = body
        if (!code) {
          return NextResponse.json({ error: 'Verification code required' }, { status: 400 })
        }

        console.log('[MTProto API] Verifying code')
        const result = await completeAuth(code)
        console.log('[MTProto API] Verify result:', result)

        if (!result.success) {
          // Check if 2FA is required
          if (result.error === '2FA_REQUIRED') {
            return NextResponse.json({
              success: false,
              requires2FA: true,
            })
          }
          return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          userId: result.userId,
        })
      }

      case '2fa':
      case 'verify-2fa': {
        const { password } = body
        if (!password) {
          return NextResponse.json({ error: 'Password required' }, { status: 400 })
        }

        console.log('[MTProto API] Verifying 2FA')
        const result = await complete2FA(password)
        console.log('[MTProto API] 2FA result:', result)

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          userId: result.userId,
        })
      }

      case 'logout': {
        console.log('[MTProto API] Logging out')
        await logout()
        return NextResponse.json({ success: true })
      }

      case 'status': {
        const isAuth = await isAuthenticated()
        let user = null

        if (isAuth) {
          user = await getCurrentUser()
        }

        return NextResponse.json({
          configured: true,
          authenticated: isAuth,
          user,
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[MTProto API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configured = isMTProtoConfigured()

    if (!configured) {
      return NextResponse.json({
        configured: false,
        authenticated: false,
        user: null,
      })
    }

    const isAuth = await isAuthenticated()
    let user = null

    if (isAuth) {
      user = await getCurrentUser()
    }

    return NextResponse.json({
      configured: true,
      authenticated: isAuth,
      user,
    })
  } catch (error) {
    console.error('[MTProto API] GET Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[MTProto API] Logging out via DELETE')
    await logout()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[MTProto API] DELETE Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
