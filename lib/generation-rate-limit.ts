/**
 * Database-based Rate Limiting for Photo Generation
 *
 * Limits: 3 concurrent generations per user
 * Cooldown: 1 minute between generation starts
 */

import { sql } from '@/lib/db'

// Rate limit configuration
const MAX_CONCURRENT_GENERATIONS = 3
const COOLDOWN_SECONDS = 60

export interface GenerationRateLimitResult {
  allowed: boolean
  reason?: string
  currentCount: number
  cooldownRemaining?: number
}

/**
 * Check if a user can start a new generation
 */
export async function checkGenerationRateLimit(userId: number): Promise<GenerationRateLimitResult> {
  // Count active generations (pending or processing)
  const activeCount = await sql`
    SELECT COUNT(*) as count
    FROM generation_jobs
    WHERE user_id = ${userId}
      AND status IN ('pending', 'processing')
  `.then((rows: any[]) => parseInt(rows[0]?.count || '0'))

  if (activeCount >= MAX_CONCURRENT_GENERATIONS) {
    return {
      allowed: false,
      reason: `Maximum ${MAX_CONCURRENT_GENERATIONS} concurrent generations allowed`,
      currentCount: activeCount,
    }
  }

  // Check cooldown - last generation start time
  const lastGeneration = await sql`
    SELECT created_at
    FROM generation_jobs
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `.then((rows: any[]) => rows[0]?.created_at)

  if (lastGeneration) {
    const lastTime = new Date(lastGeneration).getTime()
    const now = Date.now()
    const elapsed = (now - lastTime) / 1000

    if (elapsed < COOLDOWN_SECONDS) {
      const remaining = Math.ceil(COOLDOWN_SECONDS - elapsed)
      return {
        allowed: false,
        reason: `Please wait ${remaining} seconds before starting another generation`,
        currentCount: activeCount,
        cooldownRemaining: remaining,
      }
    }
  }

  return {
    allowed: true,
    currentCount: activeCount,
  }
}

/**
 * Get user ID from generation_jobs via avatar
 * (used when we only have avatarId)
 */
export async function getUserIdFromAvatar(avatarId: number): Promise<number | null> {
  const result = await sql`
    SELECT user_id FROM avatars WHERE id = ${avatarId}
  `.then((rows: any[]) => rows[0]?.user_id)

  return result || null
}
