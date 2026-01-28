/**
 * Test endpoint to diagnose referral/stats issues
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  const steps: string[] = []

  try {
    const telegramUserIdParam = request.nextUrl.searchParams.get("telegram_user_id")
    steps.push(`param: ${telegramUserIdParam}`)

    if (!telegramUserIdParam) {
      return NextResponse.json({ error: "telegram_user_id required", steps }, { status: 400 })
    }

    const telegramUserId = parseInt(telegramUserIdParam)
    steps.push(`parsed: ${telegramUserId}`)

    // Find user
    steps.push('finding user')
    const userResult = await sql`
      SELECT id FROM users WHERE telegram_user_id = ${telegramUserId}
    `
    steps.push(`found ${userResult.length} users`)

    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found", steps }, { status: 404 })
    }

    const userId = userResult[0].id
    steps.push(`user_id: ${userId}`)

    // Get referral code
    steps.push('getting referral code')
    const codeResult = await sql`
      SELECT code FROM referral_codes WHERE user_id = ${userId} AND is_active = true
    `
    steps.push(`codes found: ${codeResult.length}`)

    // Get balance
    steps.push('getting balance')
    const balanceResult = await sql`
      SELECT * FROM referral_balances WHERE user_id = ${userId}
    `
    steps.push(`balance found: ${balanceResult.length}`)

    return NextResponse.json({
      success: true,
      steps,
      userId,
      hasCode: codeResult.length > 0,
      hasBalance: balanceResult.length > 0,
      balance: balanceResult[0] || null
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      steps
    }, { status: 500 })
  }
}
