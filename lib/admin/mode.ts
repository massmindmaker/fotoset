import { neon } from '@neondatabase/serverless'

export type AppMode = 'test' | 'production'

export interface TBankCredentials {
  terminalKey: string
  password: string
  isTestMode: boolean
}

/**
 * Get current T-Bank mode from admin_settings
 */
export async function getCurrentMode(): Promise<AppMode> {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const [setting] = await sql`
      SELECT value->>'mode' as mode FROM admin_settings WHERE key = 'tbank_mode'
    `
    return (setting?.mode as AppMode) || 'test'
  } catch {
    return 'test'  // Default to test mode on error
  }
}

/**
 * Get T-Bank credentials based on current mode setting
 * Automatically switches between test and production terminals
 */
export async function getTBankCredentials(): Promise<TBankCredentials> {
  const mode = await getCurrentMode()

  if (mode === 'production') {
    // Production mode - use main credentials
    const terminalKey = (process.env.TBANK_TERMINAL_KEY || '').trim()
    const password = (process.env.TBANK_PASSWORD || '').trim()

    return {
      terminalKey,
      password,
      isTestMode: false
    }
  } else {
    // Test mode - prefer test credentials, fallback to main if DEMO
    const testTerminalKey = (process.env.TBANK_TEST_TERMINAL_KEY || '').trim()
    const testPassword = (process.env.TBANK_TEST_PASSWORD || '').trim()

    // If test credentials are set, use them
    if (testTerminalKey && testPassword) {
      return {
        terminalKey: testTerminalKey,
        password: testPassword,
        isTestMode: true
      }
    }

    // Fallback to main credentials (might be DEMO terminal)
    const terminalKey = (process.env.TBANK_TERMINAL_KEY || '').trim()
    const password = (process.env.TBANK_PASSWORD || '').trim()

    return {
      terminalKey,
      password,
      isTestMode: terminalKey.includes('DEMO') || terminalKey.toLowerCase().includes('test')
    }
  }
}

/**
 * Check if current terminal key indicates test mode
 */
export function isTestModeByTerminalKey(): boolean {
  const terminalKey = process.env.TBANK_TERMINAL_KEY || ''
  return terminalKey.includes('DEMO') || terminalKey.toLowerCase().includes('test')
}
