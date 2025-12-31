import { neon } from '@neondatabase/serverless'

export type AppMode = 'test' | 'production'

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
 * Check if current terminal key indicates test mode
 */
export function isTestModeByTerminalKey(): boolean {
  const terminalKey = process.env.TBANK_TERMINAL_KEY || ''
  return terminalKey.includes('DEMO') || terminalKey.toLowerCase().includes('test')
}
