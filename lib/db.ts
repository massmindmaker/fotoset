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
  telegram_user_id: number  // PRIMARY identifier (NOT NULL, UNIQUE)
  pending_referral_code: string | null  // Saved on first login, used on first payment
  created_at: string
  updated_at: string
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
  status: "pending" | "succeeded" | "canceled"
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

export type ReferencePhoto = {
  id: number
  avatar_id: number
  image_url: string
  created_at: string
}
