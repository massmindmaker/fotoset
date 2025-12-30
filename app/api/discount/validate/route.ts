/**
 * POST /api/discount/validate
 * Public endpoint to validate a promo code
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return neon(url)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, device_id } = body

    if (!code) {
      return NextResponse.json(
        { valid: false, error: 'Код не указан' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // Find the promo code
    const [promoCode] = await sql`
      SELECT
        id,
        code,
        discount_type,
        discount_value,
        max_uses,
        current_uses,
        valid_from,
        valid_until,
        is_active
      FROM promo_codes
      WHERE UPPER(code) = UPPER(${code})
    `

    if (!promoCode) {
      return NextResponse.json({
        valid: false,
        error: 'Промокод не найден'
      })
    }

    // Check if active
    if (!promoCode.is_active) {
      return NextResponse.json({
        valid: false,
        error: 'Промокод неактивен'
      })
    }

    // Check date validity
    const now = new Date()
    if (promoCode.valid_from && new Date(promoCode.valid_from) > now) {
      return NextResponse.json({
        valid: false,
        error: 'Промокод ещё не активен'
      })
    }

    if (promoCode.valid_until && new Date(promoCode.valid_until) < now) {
      return NextResponse.json({
        valid: false,
        error: 'Промокод истёк'
      })
    }

    // Check max uses
    if (promoCode.max_uses !== null && promoCode.current_uses >= promoCode.max_uses) {
      return NextResponse.json({
        valid: false,
        error: 'Промокод исчерпан'
      })
    }

    // Check if user already used this code (if device_id provided)
    if (device_id) {
      const [user] = await sql`
        SELECT id FROM users WHERE device_id = ${device_id}
      `

      if (user) {
        const [usage] = await sql`
          SELECT id FROM promo_code_usages
          WHERE promo_code_id = ${promoCode.id} AND user_id = ${user.id}
        `

        if (usage) {
          return NextResponse.json({
            valid: false,
            error: 'Вы уже использовали этот промокод'
          })
        }
      }
    }

    // Calculate discount for base price (500₽)
    const basePrice = 500
    let discountAmount: number
    let finalPrice: number

    if (promoCode.discount_type === 'percentage') {
      discountAmount = Math.round(basePrice * (promoCode.discount_value / 100))
      finalPrice = basePrice - discountAmount
    } else {
      discountAmount = Math.min(promoCode.discount_value, basePrice)
      finalPrice = basePrice - discountAmount
    }

    return NextResponse.json({
      valid: true,
      code: promoCode.code,
      discount_type: promoCode.discount_type,
      discount_value: promoCode.discount_value,
      discount_amount: discountAmount,
      original_price: basePrice,
      final_price: Math.max(0, finalPrice),
      description: promoCode.discount_type === 'percentage'
        ? `Скидка ${promoCode.discount_value}%`
        : `Скидка ${promoCode.discount_value}₽`
    })
  } catch (error) {
    console.error('[Discount Validate] Error:', error)
    return NextResponse.json(
      { valid: false, error: 'Ошибка проверки промокода' },
      { status: 500 }
    )
  }
}
