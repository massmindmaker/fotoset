import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.warn("[v0] DATABASE_URL is not set. Database operations will fail.")
}

export const sql = databaseUrl
  ? neon(databaseUrl)
  : ((() => {
      throw new Error("DATABASE_URL is not configured")
    }) as any)

export type User = {
  id: number
  device_id: string
  is_pro: boolean
  created_at: string
  updated_at: string
}

export type Avatar = {
  id: number
  user_id: number
  name: string
  status: "draft" | "processing" | "ready"
  thumbnail_url: string | null
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
  yookassa_payment_id: string
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
