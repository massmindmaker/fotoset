/**
 * Test Data Factory
 *
 * Provides factory functions for creating test data.
 * Use these factories to generate consistent, realistic test data.
 */

import { v4 as uuidv4 } from "uuid"
import crypto from "crypto"

// ============================================================================
// TYPES
// ============================================================================

export interface TestUser {
  id: number
  telegram_user_id: number
  device_id: string | null
  pending_referral_code: string | null
  pending_generation_tier: string | null
  pending_generation_avatar_id: number | null
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

export interface TestAvatar {
  id: number
  user_id: number
  name: string
  status: "draft" | "processing" | "ready"
  thumbnail_url: string | null
  idempotency_key: string | null
  created_at: string
  updated_at: string
}

export interface TestPayment {
  id: number
  user_id: number
  tbank_payment_id: string
  amount: number
  currency: string
  status: "pending" | "succeeded" | "canceled" | "refunded" | "refunding"
  tier_id: "starter" | "standard" | "premium"
  photo_count: number
  refund_amount: number | null
  refund_status: string | null
  refund_reason: string | null
  refund_at: string | null
  created_at: string
  updated_at: string
}

export interface TestGenerationJob {
  id: number
  avatar_id: number
  style_id: string
  status: "pending" | "processing" | "completed" | "failed"
  total_photos: number
  completed_photos: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface TestGeneratedPhoto {
  id: number
  avatar_id: number
  style_id: string
  prompt: string
  image_url: string
  created_at: string
}

export interface TestReferencePhoto {
  id: number
  avatar_id: number
  image_url: string
  created_at: string
}

export interface TestReferralCode {
  id: number
  user_id: number
  code: string
  uses_count: number
  is_active: boolean
  created_at: string
}

export interface TestReferral {
  id: number
  referrer_id: number
  referred_id: number
  created_at: string
}

export interface TestReferralEarning {
  id: number
  referrer_id: number
  payment_id: number
  amount: number
  created_at: string
}

export interface TestReferralBalance {
  id: number
  user_id: number
  balance: number
  total_earned: number
  total_withdrawn: number
  referrals_count: number
  created_at: string
  updated_at: string
}

export interface TestTBankWebhook {
  TerminalKey: string
  PaymentId: string
  OrderId: string
  Amount: number
  Status: string
  Success: boolean
  ErrorCode: string
  Pan?: string
  ExpDate?: string
  CardId?: string
  Token: string
}

// ============================================================================
// PRICING TIERS
// ============================================================================

export const PRICING_TIERS = {
  starter: { amount: 49900, photoCount: 7 }, // 499 RUB in kopeks
  standard: { amount: 99900, photoCount: 15 }, // 999 RUB
  premium: { amount: 149900, photoCount: 23 }, // 1499 RUB
} as const

// ============================================================================
// ID GENERATORS
// ============================================================================

let userIdCounter = 1
let avatarIdCounter = 1
let paymentIdCounter = 1
let jobIdCounter = 1
let photoIdCounter = 1
let referralIdCounter = 1

export function resetIdCounters() {
  userIdCounter = 1
  avatarIdCounter = 1
  paymentIdCounter = 1
  jobIdCounter = 1
  photoIdCounter = 1
  referralIdCounter = 1
}

function nextUserId(): number {
  return userIdCounter++
}

function nextAvatarId(): number {
  return avatarIdCounter++
}

function nextPaymentId(): number {
  return paymentIdCounter++
}

function nextJobId(): number {
  return jobIdCounter++
}

function nextPhotoId(): number {
  return photoIdCounter++
}

function nextReferralId(): number {
  return referralIdCounter++
}

// ============================================================================
// FACTORIES
// ============================================================================

/**
 * Create a test user
 */
export function createUser(overrides: Partial<TestUser> = {}): TestUser {
  const now = new Date().toISOString()
  return {
    id: nextUserId(),
    telegram_user_id: Math.floor(Math.random() * 1000000000) + 100000000,
    device_id: null, // Deprecated, use telegram_user_id
    pending_referral_code: null,
    pending_generation_tier: null,
    pending_generation_avatar_id: null,
    onboarding_completed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/**
 * Create a user with completed onboarding
 * Note: Pro status is determined by having a successful payment, not a flag
 */
export function createProUser(overrides: Partial<TestUser> = {}): TestUser {
  return createUser({
    onboarding_completed_at: new Date().toISOString(),
    ...overrides,
  })
}

/**
 * Create an avatar
 */
export function createAvatar(
  userId: number,
  overrides: Partial<TestAvatar> = {}
): TestAvatar {
  const now = new Date().toISOString()
  return {
    id: nextAvatarId(),
    user_id: userId,
    name: "Test Avatar",
    status: "draft",
    thumbnail_url: null,
    idempotency_key: uuidv4(),
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/**
 * Create an avatar ready for generation
 */
export function createReadyAvatar(
  userId: number,
  overrides: Partial<TestAvatar> = {}
): TestAvatar {
  return createAvatar(userId, {
    status: "ready",
    thumbnail_url: "https://cdn.pinglass.ru/thumbnails/test.jpg",
    ...overrides,
  })
}

/**
 * Create a payment
 */
export function createPayment(
  userId: number,
  tier: "starter" | "standard" | "premium" = "standard",
  overrides: Partial<TestPayment> = {}
): TestPayment {
  const now = new Date().toISOString()
  const tierConfig = PRICING_TIERS[tier]

  return {
    id: nextPaymentId(),
    user_id: userId,
    tbank_payment_id: `pay_${uuidv4().slice(0, 12)}`,
    amount: tierConfig.amount,
    currency: "RUB",
    status: "pending",
    tier_id: tier,
    photo_count: tierConfig.photoCount,
    refund_amount: null,
    refund_status: null,
    refund_reason: null,
    refund_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/**
 * Create a succeeded payment
 */
export function createSucceededPayment(
  userId: number,
  tier: "starter" | "standard" | "premium" = "standard",
  overrides: Partial<TestPayment> = {}
): TestPayment {
  return createPayment(userId, tier, {
    status: "succeeded",
    ...overrides,
  })
}

/**
 * Create a generation job
 */
export function createGenerationJob(
  avatarId: number,
  tier: "starter" | "standard" | "premium" = "standard",
  overrides: Partial<TestGenerationJob> = {}
): TestGenerationJob {
  const now = new Date().toISOString()
  const tierConfig = PRICING_TIERS[tier]

  return {
    id: nextJobId(),
    avatar_id: avatarId,
    style_id: "pinglass",
    status: "pending",
    total_photos: tierConfig.photoCount,
    completed_photos: 0,
    error_message: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/**
 * Create a completed generation job
 */
export function createCompletedJob(
  avatarId: number,
  tier: "starter" | "standard" | "premium" = "standard",
  overrides: Partial<TestGenerationJob> = {}
): TestGenerationJob {
  const tierConfig = PRICING_TIERS[tier]
  return createGenerationJob(avatarId, tier, {
    status: "completed",
    completed_photos: tierConfig.photoCount,
    ...overrides,
  })
}

/**
 * Create a generated photo
 */
export function createGeneratedPhoto(
  avatarId: number,
  overrides: Partial<TestGeneratedPhoto> = {}
): TestGeneratedPhoto {
  return {
    id: nextPhotoId(),
    avatar_id: avatarId,
    style_id: "pinglass",
    prompt: "Professional business portrait, high quality",
    image_url: `https://cdn.pinglass.ru/photos/test-${nextPhotoId()}.jpg`,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create multiple generated photos
 */
export function createGeneratedPhotos(
  avatarId: number,
  count: number
): TestGeneratedPhoto[] {
  return Array.from({ length: count }, (_, i) =>
    createGeneratedPhoto(avatarId, {
      prompt: `Style ${i + 1} portrait`,
    })
  )
}

/**
 * Create a reference photo
 */
export function createReferencePhoto(
  avatarId: number,
  overrides: Partial<TestReferencePhoto> = {}
): TestReferencePhoto {
  return {
    id: nextPhotoId(),
    avatar_id: avatarId,
    image_url: `https://cdn.pinglass.ru/references/test-${nextPhotoId()}.jpg`,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create multiple reference photos
 */
export function createReferencePhotos(
  avatarId: number,
  count: number
): TestReferencePhoto[] {
  return Array.from({ length: count }, () => createReferencePhoto(avatarId))
}

/**
 * Create a referral code
 */
export function createReferralCode(
  userId: number,
  overrides: Partial<TestReferralCode> = {}
): TestReferralCode {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const code = Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("")

  return {
    id: nextReferralId(),
    user_id: userId,
    code,
    uses_count: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create a referral relationship
 */
export function createReferral(
  referrerId: number,
  referredId: number,
  overrides: Partial<TestReferral> = {}
): TestReferral {
  return {
    id: nextReferralId(),
    referrer_id: referrerId,
    referred_id: referredId,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create a referral earning
 */
export function createReferralEarning(
  referrerId: number,
  paymentId: number,
  amount: number,
  overrides: Partial<TestReferralEarning> = {}
): TestReferralEarning {
  return {
    id: nextReferralId(),
    referrer_id: referrerId,
    payment_id: paymentId,
    amount, // 10% of payment in kopeks
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create a referral balance
 */
export function createReferralBalance(
  userId: number,
  overrides: Partial<TestReferralBalance> = {}
): TestReferralBalance {
  const now = new Date().toISOString()
  return {
    id: nextReferralId(),
    user_id: userId,
    balance: 0,
    total_earned: 0,
    total_withdrawn: 0,
    referrals_count: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

// ============================================================================
// T-BANK WEBHOOK FACTORY
// ============================================================================

/**
 * Generate T-Bank webhook signature (SHA256)
 */
export function generateTBankSignature(
  data: Record<string, unknown>,
  password: string
): string {
  // Sort keys alphabetically
  const sortedKeys = Object.keys(data).sort()

  // Concatenate values (excluding Token)
  const values = sortedKeys
    .filter((key) => key !== "Token")
    .map((key) => String(data[key]))
    .join("")

  // Add password
  const stringToSign = values + password

  // SHA256 hash
  return crypto.createHash("sha256").update(stringToSign).digest("hex")
}

/**
 * Create a T-Bank webhook payload
 */
export function createTBankWebhook(
  paymentId: string,
  status: "CONFIRMED" | "AUTHORIZED" | "REJECTED" | "REFUNDED" | "CANCELED" = "CONFIRMED",
  overrides: Partial<TestTBankWebhook> = {}
): TestTBankWebhook {
  const terminalKey = process.env.TBANK_TERMINAL_KEY || "TestTerminal"
  const password = process.env.TBANK_PASSWORD || "TestPassword"

  const payload: TestTBankWebhook = {
    TerminalKey: terminalKey,
    PaymentId: paymentId,
    OrderId: `order_${uuidv4().slice(0, 8)}`,
    Amount: 99900, // 999 RUB
    Status: status,
    Success: status === "CONFIRMED" || status === "AUTHORIZED",
    ErrorCode: "0",
    Pan: "430000******0777",
    ExpDate: "1230",
    CardId: `card_${uuidv4().slice(0, 8)}`,
    Token: "", // Will be computed
    ...overrides,
  }

  // Compute signature
  payload.Token = generateTBankSignature(payload, password)

  return payload
}

/**
 * Create a T-Bank webhook with invalid signature
 */
export function createInvalidTBankWebhook(
  paymentId: string,
  status: "CONFIRMED" | "REJECTED" = "CONFIRMED"
): TestTBankWebhook {
  const webhook = createTBankWebhook(paymentId, status)
  webhook.Token = "invalid_signature_12345"
  return webhook
}

/**
 * Create a T-Bank webhook with tampered amount
 */
export function createTamperedAmountWebhook(
  paymentId: string,
  originalAmount: number,
  tamperedAmount: number
): TestTBankWebhook {
  // Create webhook with original amount (valid signature)
  const webhook = createTBankWebhook(paymentId, "CONFIRMED", {
    Amount: originalAmount,
  })

  // Tamper the amount (signature now invalid)
  webhook.Amount = tamperedAmount

  return webhook
}

// ============================================================================
// COMPLETE SCENARIO FACTORIES
// ============================================================================

/**
 * Create a complete user scenario with avatar and photos
 */
export function createCompleteUserScenario(
  tier: "starter" | "standard" | "premium" = "premium"
) {
  const user = createProUser()
  const avatar = createReadyAvatar(user.id)
  const payment = createSucceededPayment(user.id, tier)
  const job = createCompletedJob(avatar.id, tier)
  const photos = createGeneratedPhotos(avatar.id, PRICING_TIERS[tier].photoCount)
  const references = createReferencePhotos(avatar.id, 8)

  return { user, avatar, payment, job, photos, references }
}

/**
 * Create a referral scenario
 */
export function createReferralScenario() {
  const referrer = createProUser()
  const referred = createUser()
  const referralCode = createReferralCode(referrer.id)
  const referral = createReferral(referrer.id, referred.id)
  const payment = createSucceededPayment(referred.id)
  const earning = createReferralEarning(
    referrer.id,
    payment.id,
    Math.floor(payment.amount * 0.1) // 10% commission
  )
  const balance = createReferralBalance(referrer.id, {
    balance: earning.amount,
    total_earned: earning.amount,
    referrals_count: 1,
  })

  return { referrer, referred, referralCode, referral, payment, earning, balance }
}

/**
 * Create a pending payment scenario
 */
export function createPendingPaymentScenario(
  tier: "starter" | "standard" | "premium" = "standard"
) {
  const user = createUser({
    pending_generation_tier: tier,
  })
  const avatar = createAvatar(user.id)
  const payment = createPayment(user.id, tier)

  return { user, avatar, payment }
}

// ============================================================================
// TEST CONSTANTS
// ============================================================================

export const TEST_TELEGRAM_USER_ID = 123456789
export const TEST_DEVICE_ID = "test-device-12345"
export const TEST_EMAIL = "test@pinglass.ru"
export const TEST_REFERRAL_CODE = "TEST01"

export const TEST_CARDS = {
  success: "4111111111111111",
  decline: "4000000000000002",
  expired: "4000000000000069",
  insufficient: "4000000000009995",
}

export const TEST_BASE64_IMAGE =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof"
