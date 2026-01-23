import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username обязателен' },
        { status: 400 }
      )
    }

    // Clean username (remove @ if present)
    const cleanUsername = username.replace('@', '').trim().toLowerCase()

    // Find user by telegram_username
    const users = await sql`
      SELECT u.id, u.telegram_user_id, u.telegram_username, rb.is_partner
      FROM users u
      LEFT JOIN referral_balances rb ON rb.user_id = u.id
      WHERE LOWER(u.telegram_username) = ${cleanUsername}
      LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Пользователь с таким username не найден' },
        { status: 404 }
      )
    }

    const user = users[0]

    // Check if user is a partner
    if (!user.is_partner) {
      return NextResponse.json(
        { success: false, error: 'Вы не являетесь партнёром. Подайте заявку в приложении.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      telegramUserId: user.telegram_user_id,
      username: user.telegram_username,
    })
  } catch (error) {
    console.error('Partner login error:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
