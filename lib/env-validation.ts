/**
 * Environment Variables Validation
 *
 * Validates required environment variables at startup.
 * Throws error in production if critical vars are missing.
 * Logs warnings in development for optional vars.
 */

interface EnvVarConfig {
  name: string
  required: 'always' | 'production' | 'never'
  description: string
}

const ENV_VARS: EnvVarConfig[] = [
  // Database - always required
  {
    name: 'DATABASE_URL',
    required: 'always',
    description: 'Neon PostgreSQL connection string'
  },

  // Security - required in production
  {
    name: 'ADMIN_SESSION_SECRET',
    required: 'production',
    description: 'Secret for admin JWT session tokens'
  },
  {
    name: 'TELEGRAM_WEBHOOK_SECRET',
    required: 'production',
    description: 'Secret for verifying Telegram Stars webhook authenticity'
  },

  // Payment system - required in production
  {
    name: 'TBANK_TERMINAL_KEY',
    required: 'production',
    description: 'T-Bank terminal key for payment processing'
  },
  {
    name: 'TBANK_PASSWORD',
    required: 'production',
    description: 'T-Bank terminal password'
  },

  // Background jobs - required in production
  {
    name: 'QSTASH_TOKEN',
    required: 'production',
    description: 'QStash token for background job processing'
  },

  // AI generation
  {
    name: 'KIE_AI_API_KEY',
    required: 'production',
    description: 'Kie.ai API key for photo generation'
  },

  // App URL - needed for callbacks
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: 'production',
    description: 'Public URL of the application'
  },
]

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate all environment variables
 * @returns ValidationResult with errors and warnings
 */
export function validateEnv(): ValidationResult {
  const isProduction = process.env.NODE_ENV === 'production'
  const errors: string[] = []
  const warnings: string[] = []

  for (const varConfig of ENV_VARS) {
    const value = process.env[varConfig.name]
    const isEmpty = !value || value.trim() === ''

    if (isEmpty) {
      if (varConfig.required === 'always') {
        errors.push(`Missing required env var: ${varConfig.name} (${varConfig.description})`)
      } else if (varConfig.required === 'production' && isProduction) {
        errors.push(`Missing production env var: ${varConfig.name} (${varConfig.description})`)
      } else if (varConfig.required === 'production' && !isProduction) {
        warnings.push(`Missing env var: ${varConfig.name} (${varConfig.description}) - required in production`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate environment and throw on critical errors
 * Call this at application startup
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv()

  // Log warnings
  for (const warning of result.warnings) {
    console.warn(`[Env Validation] WARNING: ${warning}`)
  }

  // Throw on errors
  if (!result.valid) {
    const errorMessage = [
      '[Env Validation] CRITICAL: Application cannot start due to missing environment variables:',
      '',
      ...result.errors.map(e => `  - ${e}`),
      '',
      'Please set these environment variables and restart the application.'
    ].join('\n')

    console.error(errorMessage)
    throw new Error(`Missing required environment variables: ${result.errors.join('; ')}`)
  }

  console.log('[Env Validation] All required environment variables are set')
}

/**
 * Ensure QStash idempotency table exists
 * Creates table if missing (safe for concurrent calls)
 */
export async function ensureQstashTable(): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { sql } = await import('@/lib/db')

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS qstash_processed_messages (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(255) NOT NULL UNIQUE,
        endpoint VARCHAR(255),
        job_id INTEGER,
        processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        response_status INTEGER,
        metadata JSONB
      )
    `

    // Create indexes if they don't exist
    await sql`
      CREATE INDEX IF NOT EXISTS idx_qstash_message_id
      ON qstash_processed_messages(message_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_qstash_processed_at
      ON qstash_processed_messages(processed_at)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_qstash_job_id
      ON qstash_processed_messages(job_id)
    `

    console.log('[Startup] QStash idempotency table ensured')
  } catch (error) {
    // Non-critical - table might already exist or DB not ready
    console.warn('[Startup] Could not ensure qstash table:', error)
  }
}
