/**
 * TON Payment Status Endpoint Integration Tests
 *
 * Tests the GET /api/payment/ton/status endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { sql } from '@/lib/db'

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

describe('POST /api/payment/ton/status', () => {
  let testUserId: number
  let testPaymentId: number
  const testTelegramUserId = Math.floor(Math.random() * 1000000000)

  beforeAll(async () => {
    // Create test user
    const [user] = await sql`
      INSERT INTO users (telegram_user_id, telegram_username)
      VALUES (${testTelegramUserId}, 'test_ton_status')
      RETURNING id
    `
    testUserId = user.id

    // Create test TON payment
    const [payment] = await sql`
      INSERT INTO payments (
        user_id,
        provider,
        amount,
        ton_amount,
        status,
        tier_id,
        photo_count,
        provider_payment_id,
        exchange_rate,
        rate_expires_at
      )
      VALUES (
        ${testUserId},
        'ton',
        1499,
        4.5,
        'pending',
        'premium',
        23,
        ${`PG${Math.floor(Math.random() * 100000)}`},
        333.11,
        NOW() + INTERVAL '30 minutes'
      )
      RETURNING id
    `
    testPaymentId = payment.id
  })

  afterAll(async () => {
    // Cleanup
    await sql`DELETE FROM payments WHERE user_id = ${testUserId}`
    await sql`DELETE FROM users WHERE id = ${testUserId}`
  })

  it('should return 400 if telegram_user_id is missing', async () => {
    const response = await fetch(`${API_BASE}/api/payment/ton/status`)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('telegram_user_id is required')
  })

  it('should return 404 if user not found', async () => {
    const response = await fetch(
      `${API_BASE}/api/payment/ton/status?telegram_user_id=999999999999`
    )

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('User not found')
  })

  it('should return latest TON payment when payment_id not provided', async () => {
    const response = await fetch(
      `${API_BASE}/api/payment/ton/status?telegram_user_id=${testTelegramUserId}`
    )

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data).toMatchObject({
      paymentId: testPaymentId,
      status: 'pending',
      provider: 'ton',
      amount: {
        rub: 1499,
        ton: 4.5,
      },
      exchangeRate: 333.11,
      isExpired: false,
    })

    expect(data.comment).toMatch(/^PG\d+$/)
    expect(data.walletAddress).toBeTruthy()
    expect(data.expiresAt).toBeTruthy()
    expect(data.createdAt).toBeTruthy()
    expect(data.updatedAt).toBeTruthy()
  })

  it('should return specific payment when payment_id provided', async () => {
    const response = await fetch(
      `${API_BASE}/api/payment/ton/status?telegram_user_id=${testTelegramUserId}&payment_id=${testPaymentId}`
    )

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.paymentId).toBe(testPaymentId)
    expect(data.status).toBe('pending')
  })

  it('should return 403 if payment belongs to different user', async () => {
    // Create another user
    const [otherUser] = await sql`
      INSERT INTO users (telegram_user_id, telegram_username)
      VALUES (${testTelegramUserId + 1}, 'other_user')
      RETURNING id
    `

    const response = await fetch(
      `${API_BASE}/api/payment/ton/status?telegram_user_id=${testTelegramUserId + 1}&payment_id=${testPaymentId}`
    )

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('Payment does not belong to this user')

    // Cleanup
    await sql`DELETE FROM users WHERE id = ${otherUser.id}`
  })

  it('should mark expired payment as expired', async () => {
    // Create expired payment
    const [expiredPayment] = await sql`
      INSERT INTO payments (
        user_id,
        provider,
        amount,
        ton_amount,
        status,
        tier_id,
        photo_count,
        provider_payment_id,
        exchange_rate,
        rate_expires_at
      )
      VALUES (
        ${testUserId},
        'ton',
        499,
        1.5,
        'pending',
        'starter',
        7,
        'PG_EXPIRED',
        333.11,
        NOW() - INTERVAL '1 hour'
      )
      RETURNING id
    `

    const response = await fetch(
      `${API_BASE}/api/payment/ton/status?telegram_user_id=${testTelegramUserId}&payment_id=${expiredPayment.id}`
    )

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.status).toBe('expired')
    expect(data.isExpired).toBe(true)

    // Verify database was updated
    const [updated] = await sql`
      SELECT status FROM payments WHERE id = ${expiredPayment.id}
    `
    expect(updated.status).toBe('expired')

    // Cleanup
    await sql`DELETE FROM payments WHERE id = ${expiredPayment.id}`
  })

  it('should include transaction details for processing payment', async () => {
    // Create processing payment with transaction
    const [processingPayment] = await sql`
      INSERT INTO payments (
        user_id,
        provider,
        amount,
        ton_amount,
        status,
        tier_id,
        photo_count,
        provider_payment_id,
        ton_tx_hash,
        ton_confirmations,
        exchange_rate,
        rate_expires_at
      )
      VALUES (
        ${testUserId},
        'ton',
        999,
        3.0,
        'processing',
        'standard',
        15,
        'PG_PROCESSING',
        'abc123def456',
        5,
        333.11,
        NOW() + INTERVAL '30 minutes'
      )
      RETURNING id
    `

    const response = await fetch(
      `${API_BASE}/api/payment/ton/status?telegram_user_id=${testTelegramUserId}&payment_id=${processingPayment.id}`
    )

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.status).toBe('processing')
    expect(data.transaction).toMatchObject({
      hash: 'abc123def456',
      confirmations: 5,
      requiredConfirmations: 10,
    })

    // Cleanup
    await sql`DELETE FROM payments WHERE id = ${processingPayment.id}`
  })

  it('should return no_payment if user has no TON payments', async () => {
    // Create user without payments
    const [userNoPay] = await sql`
      INSERT INTO users (telegram_user_id, telegram_username)
      VALUES (${testTelegramUserId + 99}, 'no_payments')
      RETURNING id
    `

    const response = await fetch(
      `${API_BASE}/api/payment/ton/status?telegram_user_id=${testTelegramUserId + 99}`
    )

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.status).toBe('no_payment')
    expect(data.message).toContain('No TON payments found')

    // Cleanup
    await sql`DELETE FROM users WHERE id = ${userNoPay.id}`
  })

  it('should process referral earning for succeeded payment', async () => {
    // Create referrer
    const [referrer] = await sql`
      INSERT INTO users (telegram_user_id, telegram_username)
      VALUES (${testTelegramUserId + 100}, 'referrer')
      RETURNING id
    `

    // Create referral code
    await sql`
      INSERT INTO referral_codes (user_id, code, is_active)
      VALUES (${referrer.id}, 'TESTREF', true)
    `

    // Create referral balance
    await sql`
      INSERT INTO referral_balances (user_id, balance, total_earned, referrals_count)
      VALUES (${referrer.id}, 0, 0, 0)
    `

    // Create referral link
    await sql`
      INSERT INTO referrals (referrer_id, referred_user_id)
      VALUES (${referrer.id}, ${testUserId})
    `

    // Create succeeded payment
    const [succeededPayment] = await sql`
      INSERT INTO payments (
        user_id,
        provider,
        amount,
        ton_amount,
        status,
        tier_id,
        photo_count,
        provider_payment_id,
        ton_tx_hash,
        ton_confirmations,
        exchange_rate,
        rate_expires_at
      )
      VALUES (
        ${testUserId},
        'ton',
        1499,
        4.5,
        'succeeded',
        'premium',
        23,
        'PG_SUCCESS',
        'success_tx_hash',
        10,
        333.11,
        NOW() + INTERVAL '30 minutes'
      )
      RETURNING id
    `

    const response = await fetch(
      `${API_BASE}/api/payment/ton/status?telegram_user_id=${testTelegramUserId}&payment_id=${succeededPayment.id}`
    )

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.status).toBe('succeeded')

    // Verify referral earning was created
    const [earning] = await sql`
      SELECT * FROM referral_earnings
      WHERE payment_id = ${succeededPayment.id}
    `

    expect(earning).toBeTruthy()
    expect(earning.referrer_id).toBe(referrer.id)
    expect(earning.referred_user_id).toBe(testUserId)
    expect(Number(earning.amount)).toBe(149.9) // 10% of 1499

    // Verify balance was updated
    const [balance] = await sql`
      SELECT balance FROM referral_balances WHERE user_id = ${referrer.id}
    `
    expect(Number(balance.balance)).toBe(149.9)

    // Cleanup
    await sql`DELETE FROM referral_earnings WHERE payment_id = ${succeededPayment.id}`
    await sql`DELETE FROM referrals WHERE referrer_id = ${referrer.id}`
    await sql`DELETE FROM referral_balances WHERE user_id = ${referrer.id}`
    await sql`DELETE FROM referral_codes WHERE user_id = ${referrer.id}`
    await sql`DELETE FROM payments WHERE id = ${succeededPayment.id}`
    await sql`DELETE FROM users WHERE id = ${referrer.id}`
  })
})
