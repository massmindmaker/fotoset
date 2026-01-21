/**
 * Environment Variable Validation for PinGlass
 *
 * Uses Zod to validate environment variables at startup.
 * Provides type-safe access to environment variables.
 *
 * Benefits:
 * - Catches missing/invalid env vars early (startup vs runtime)
 * - TypeScript autocomplete for env vars
 * - Clear error messages for misconfiguration
 *
 * Usage:
 *   import { env, serverEnv } from '@/lib/env'
 *
 *   // Type-safe access
 *   const dbUrl = serverEnv.DATABASE_URL
 *   const appUrl = env.NEXT_PUBLIC_APP_URL
 */

import { z } from 'zod'

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Server-side environment variables (secrets, never exposed to client)
 */
const serverSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database (required for production)
  DATABASE_URL: z.string().url().optional(),

  // Google AI
  GOOGLE_API_KEY: z.string().optional(),

  // Kie.ai API
  KIE_AI_API_KEY: z.string().optional(),
  KIE_API_KEY: z.string().optional(), // Legacy name

  // T-Bank Payment
  TBANK_TERMINAL_KEY: z.string().optional(),
  TBANK_PASSWORD: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // QStash
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

  // Sentry
  SENTRY_AUTH_TOKEN: z.string().optional(),
  fotoset_SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  fotoset_SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  fotoset_SENTRY_PROJECT: z.string().optional(),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  // TON Connect
  TON_WALLET_ADDRESS: z.string().optional(),
  TON_MANIFEST_URL: z.string().url().optional(),

  // Admin
  ADMIN_TELEGRAM_IDS: z.string().optional(),

  // YeScale Proxy
  YESCALE_API_KEY: z.string().optional(),

  // Feature flags
  ENABLE_PROD_INFO_LOGS: z.enum(['true', 'false']).optional(),
})

/**
 * Client-side environment variables (NEXT_PUBLIC_* prefix, exposed to browser)
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().optional(),
  NEXT_PUBLIC_TON_MANIFEST_URL: z.string().url().optional(),
})

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate server environment variables
 * Only runs on server-side
 */
function validateServerEnv() {
  // Skip validation on client-side
  if (typeof window !== 'undefined') {
    return {} as z.infer<typeof serverSchema>
  }

  const result = serverSchema.safeParse(process.env)

  if (!result.success) {
    console.error(
      '❌ Invalid server environment variables:',
      result.error.flatten().fieldErrors
    )

    // In production, don't throw - just log
    // App may still work with partial config
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ Continuing with potentially incomplete environment configuration')
      return process.env as unknown as z.infer<typeof serverSchema>
    }

    throw new Error('Invalid server environment variables')
  }

  return result.data
}

/**
 * Validate client environment variables
 */
function validateClientEnv() {
  const clientEnvObj = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
    NEXT_PUBLIC_TON_MANIFEST_URL: process.env.NEXT_PUBLIC_TON_MANIFEST_URL,
  }

  const result = clientSchema.safeParse(clientEnvObj)

  if (!result.success) {
    console.error(
      '❌ Invalid client environment variables:',
      result.error.flatten().fieldErrors
    )

    // Don't throw in production
    if (process.env.NODE_ENV === 'production') {
      return clientEnvObj as z.infer<typeof clientSchema>
    }

    throw new Error('Invalid client environment variables')
  }

  return result.data
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Validated server environment variables
 * Only use in server-side code (API routes, Server Components)
 */
export const serverEnv = validateServerEnv()

/**
 * Validated client environment variables
 * Safe to use in both server and client code
 */
export const env = validateClientEnv()

/**
 * Check if specific features are configured
 */
export const features = {
  /** Database is configured */
  hasDatabase: !!serverEnv.DATABASE_URL,

  /** Payment system is configured */
  hasPayments: !!(serverEnv.TBANK_TERMINAL_KEY && serverEnv.TBANK_PASSWORD),

  /** Telegram bot is configured */
  hasTelegram: !!serverEnv.TELEGRAM_BOT_TOKEN,

  /** Telegram webhook security is configured */
  hasTelegramWebhookSecurity: !!serverEnv.TELEGRAM_WEBHOOK_SECRET,

  /** QStash background jobs are configured */
  hasQStash: !!serverEnv.QSTASH_TOKEN,

  /** R2 storage is configured */
  hasR2Storage: !!(
    serverEnv.R2_ACCOUNT_ID &&
    serverEnv.R2_ACCESS_KEY_ID &&
    serverEnv.R2_SECRET_ACCESS_KEY
  ),

  /** Kie.ai is configured */
  hasKieAi: !!(serverEnv.KIE_AI_API_KEY || serverEnv.KIE_API_KEY),

  /** Google AI is configured */
  hasGoogleAi: !!serverEnv.GOOGLE_API_KEY,

  /** Sentry is configured */
  hasSentry: !!env.NEXT_PUBLIC_SENTRY_DSN,

  /** Is development mode */
  isDevelopment: serverEnv.NODE_ENV === 'development',

  /** Is production mode */
  isProduction: serverEnv.NODE_ENV === 'production',
}

export type ServerEnv = z.infer<typeof serverSchema>
export type ClientEnv = z.infer<typeof clientSchema>
