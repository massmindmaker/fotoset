import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL

// NOTE: DATABASE_URL checked at runtime in sql/query functions

export const sql = databaseUrl
  ? neon(databaseUrl)
  : ((() => {
      throw new Error("DATABASE_URL is not configured")
    }) as any)

// Query function with parameterized queries support (PostgreSQL $1, $2, etc.)
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[] }> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured")
  }

  const db = neon(process.env.DATABASE_URL)
  // neon .query() returns array directly (not { rows: [] } like pg Pool)
  const result = await db.query(text, params || [])
  return { rows: result as T[] }
}


export type User = {
  id: number
  // Telegram identity (nullable for web-only users)
  telegram_user_id: number | null  // Telegram ID (nullable after migration 033)
  telegram_username: string | null  // Telegram @username for admin panel display
  telegram_chat_id: number | null  // Telegram chat ID for notifications

  // Web identity (Neon Auth / Stack Auth)
  neon_auth_id: string | null  // Stack Auth user ID
  email: string | null  // Email from OAuth or magic link
  email_verified: boolean  // Email verification status
  name: string | null  // Display name from OAuth
  avatar_url: string | null  // Avatar URL from OAuth

  // Auth metadata
  auth_provider: 'telegram' | 'google' | 'email' | 'github' | null  // Primary auth method

  // Referral
  pending_referral_code: string | null  // Saved on first login, used on first payment

  // Active pack
  active_pack_id: number | null  // Currently selected photo pack for new generations

  // Timestamps
  created_at: string
  updated_at: string
}

// User identity for linking accounts
export type UserIdentity = {
  id: number
  user_id: number
  provider: 'telegram' | 'google' | 'github' | 'email'
  provider_user_id: string
  provider_email: string | null
  provider_name: string | null
  provider_avatar_url: string | null
  provider_metadata: Record<string, unknown>
  linked_at: string
  last_used_at: string
}

// Link tokens for account linking
export type LinkToken = {
  id: number
  user_id: number
  token: string
  token_type: 'web_to_tg' | 'tg_to_web'
  expires_at: string
  used_at: string | null
  created_at: string
}

export type Avatar = {
  id: number
  user_id: number
  name: string
  status: "draft" | "processing" | "ready"
  thumbnail_url: string | null
  idempotency_key?: string  // For atomic creation (race condition prevention)
  created_at: string
  updated_at: string
}

export type GeneratedPhoto = {
  id: number
  avatar_id: number
  style_id: string
  prompt: string
  image_url: string
  created_at: string
}

export type Payment = {
  id: number
  user_id: number
  tbank_payment_id: string
  amount: number
  currency: string
  status: "pending" | "succeeded" | "canceled" | "refunded" | "refunding"

  // Tier информация (миграция 002)
  tier_id: string | null  // 'starter' | 'standard' | 'premium'
  photo_count: number | null

  // Refund информация (миграция 016)
  refund_amount: number | null
  refund_status: string | null
  refund_reason: string | null
  refund_at: string | null

  created_at: string
  updated_at: string
}

export type GenerationJob = {
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

export type PhotoFavorite = {
  id: number
  user_id: number
  photo_id: number
  created_at: string
}

export type SharedGallery = {
  id: number
  share_token: string
  user_id: number
  avatar_id: number | null
  photo_ids: number[]
  title: string | null
  expires_at: string
  view_count: number
  created_at: string
}

// Referral Program Types
export type ReferralCode = {
  id: number
  user_id: number
  code: string
  created_at: string
  is_active: boolean
}

export type Referral = {
  id: number
  referrer_id: number
  referred_id: number
  referral_code: string | null
  created_at: string
}

export type ReferralEarning = {
  id: number
  referrer_id: number
  referred_id: number
  payment_id: number | null
  amount: number
  original_amount: number
  created_at: string
}

export type ReferralBalance = {
  id: number
  user_id: number
  balance: number
  total_earned: number
  total_withdrawn: number
  referrals_count: number
  commission_rate: number
  is_partner: boolean
  partner_approved_at: string | null
  partner_approved_by: string | null
  updated_at: string
}

export type ReferralWithdrawal = {
  id: number
  user_id: number
  amount: number
  ndfl_amount: number
  payout_amount: number
  status: "pending" | "processing" | "completed" | "rejected"
  payout_method: "card" | "sbp"
  card_number: string | null
  phone: string | null
  recipient_name: string
  processed_by: string | null
  processed_at: string | null
  rejection_reason: string | null
  ndfl_paid_at: string | null
  created_at: string
}

// User cards for T-Bank payouts (migration 035)
export type UserCard = {
  id: number
  user_id: number
  card_id: string  // T-Bank CardId
  card_mask: string  // **** **** **** 1234
  card_type: 'visa' | 'mastercard' | 'mir' | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// Withdrawal requests (migration 035)
export type Withdrawal = {
  id: number
  user_id: number
  amount: number
  currency: string
  card_id: number | null
  card_mask: string
  tbank_payment_id: string | null
  tbank_order_id: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  error_message: string | null
  error_code: string | null
  created_at: string
  processed_at: string | null
  completed_at: string | null
  idempotency_key: string | null
}

// Partner applications (migration 034)
export type PartnerApplication = {
  id: number
  user_id: number
  channel_url: string
  audience_size: string | null
  promotion_plan: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_by: number | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type ReferencePhoto = {
  id: number
  avatar_id: number
  image_url: string
  created_at: string
}

// Photo packs (migration 047)
export type PhotoPack = {
  id: number
  name: string
  slug: string
  description: string | null
  icon_emoji: string
  preview_images: string[] | null
  owner_type: 'admin' | 'partner'
  partner_user_id: number | null
  moderation_status: 'draft' | 'pending' | 'approved' | 'rejected'
  submitted_at: string | null
  reviewed_by: number | null
  reviewed_at: string | null
  rejection_reason: string | null
  is_active: boolean
  is_featured: boolean
  sort_order: number
  usage_count: number
  created_at: string
  updated_at: string
}

// Pack prompts (migration 047)
export type PackPrompt = {
  id: number
  pack_id: number
  prompt: string
  negative_prompt: string | null
  style_prefix: string | null
  style_suffix: string | null
  preview_url: string | null
  position: number
  is_active: boolean
  created_at: string
}

// Pack usage statistics (migration 047)
export type PackUsageStat = {
  id: number
  pack_id: number
  user_id: number | null
  generation_job_id: number | null
  photo_count: number
  created_at: string
}
