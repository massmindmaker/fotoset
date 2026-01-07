/**
 * Telegram MTProto Client
 *
 * Uses gramjs for Telegram MTProto API access.
 * Required for Telegram Affiliate Program setup (user-only API, not available via Bot API).
 *
 * Flow:
 * 1. Admin initiates auth with phone number
 * 2. Telegram sends code to phone/app
 * 3. Admin enters code to complete auth
 * 4. Session is saved to DB for future use
 *
 * NOTE: Serverless-compatible - stores auth state in DB, not memory
 */

import { TelegramClient, Api } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { sql } from './db'

// Environment variables for Telegram API
const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0')
const API_HASH = process.env.TELEGRAM_API_HASH || ''

// Session name for admin account
const ADMIN_SESSION_NAME = 'admin_affiliate'

/**
 * Check if MTProto credentials are configured
 */
export function isMTProtoConfigured(): boolean {
  return API_ID > 0 && API_HASH.length > 0
}

/**
 * Get saved session from database
 */
async function getStoredSession(sessionName: string): Promise<string | null> {
  const result = await sql`
    SELECT session_string
    FROM telegram_mtproto_sessions
    WHERE session_name = ${sessionName}
      AND is_active = TRUE
    LIMIT 1
  `
  return result[0]?.session_string || null
}

/**
 * Save session to database
 */
async function saveSession(
  sessionName: string,
  sessionString: string,
  phoneNumber?: string,
  userId?: bigint
): Promise<void> {
  await sql`
    INSERT INTO telegram_mtproto_sessions (session_name, session_string, phone_number, user_id)
    VALUES (${sessionName}, ${sessionString}, ${phoneNumber || null}, ${userId?.toString() || null})
    ON CONFLICT (session_name)
    DO UPDATE SET
      session_string = EXCLUDED.session_string,
      phone_number = COALESCE(EXCLUDED.phone_number, telegram_mtproto_sessions.phone_number),
      user_id = COALESCE(EXCLUDED.user_id, telegram_mtproto_sessions.user_id),
      is_active = TRUE,
      updated_at = NOW()
  `
}

/**
 * Save pending auth state to database (for serverless compatibility)
 */
async function savePendingAuth(
  sessionName: string,
  phoneNumber: string,
  phoneCodeHash: string,
  partialSession: string
): Promise<void> {
  await sql`
    INSERT INTO telegram_mtproto_sessions (session_name, phone_number, phone_code_hash, session_string, is_active)
    VALUES (${sessionName}, ${phoneNumber}, ${phoneCodeHash}, ${partialSession}, FALSE)
    ON CONFLICT (session_name)
    DO UPDATE SET
      phone_number = EXCLUDED.phone_number,
      phone_code_hash = EXCLUDED.phone_code_hash,
      session_string = EXCLUDED.session_string,
      is_active = FALSE,
      updated_at = NOW()
  `
}

/**
 * Get pending auth state from database
 */
async function getPendingAuth(sessionName: string): Promise<{
  phoneNumber: string
  phoneCodeHash: string
  partialSession: string
} | null> {
  const result = await sql`
    SELECT phone_number, phone_code_hash, session_string
    FROM telegram_mtproto_sessions
    WHERE session_name = ${sessionName}
      AND is_active = FALSE
      AND phone_code_hash IS NOT NULL
    LIMIT 1
  `
  if (!result[0]) return null
  return {
    phoneNumber: result[0].phone_number,
    phoneCodeHash: result[0].phone_code_hash,
    partialSession: result[0].session_string || '',
  }
}

/**
 * Delete session from database
 */
async function deleteSession(sessionName: string): Promise<void> {
  await sql`
    UPDATE telegram_mtproto_sessions
    SET is_active = FALSE, phone_code_hash = NULL, updated_at = NOW()
    WHERE session_name = ${sessionName}
  `
}

/**
 * Create a new Telegram client
 */
export async function createClient(
  sessionName: string = ADMIN_SESSION_NAME,
  sessionString?: string
): Promise<TelegramClient> {
  if (!isMTProtoConfigured()) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set')
  }

  // Use provided session or try to load from DB
  const savedSession = sessionString ?? (await getStoredSession(sessionName))
  const stringSession = new StringSession(savedSession || '')

  const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: true,
  })

  return client
}

/**
 * Check if admin is already authenticated
 */
export async function isAuthenticated(sessionName: string = ADMIN_SESSION_NAME): Promise<boolean> {
  const savedSession = await getStoredSession(sessionName)
  if (!savedSession) return false

  try {
    const client = await createClient(sessionName, savedSession)
    await client.connect()
    const isAuth = await client.isUserAuthorized()
    await client.disconnect()
    return isAuth
  } catch (error) {
    console.error('[MTProto] isAuthenticated error:', error)
    return false
  }
}

/**
 * Start phone number authentication
 * Stores auth state in DB for serverless compatibility
 */
export async function startAuth(
  phoneNumber: string,
  sessionName: string = ADMIN_SESSION_NAME
): Promise<{ success: boolean; requiresCode: boolean; error?: string }> {
  if (!isMTProtoConfigured()) {
    return { success: false, requiresCode: false, error: 'MTProto not configured' }
  }

  let client: TelegramClient | null = null

  try {
    client = await createClient(sessionName, '')
    await client.connect()

    console.log('[MTProto] Sending code to:', phoneNumber)

    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: API_ID,
        apiHash: API_HASH,
        settings: new Api.CodeSettings({}),
      })
    )

    // Handle different response types
    const phoneCodeHash = 'phoneCodeHash' in result ? result.phoneCodeHash : ''
    if (!phoneCodeHash) {
      await client.disconnect()
      return { success: false, requiresCode: false, error: 'Failed to get phone code hash' }
    }

    // Save partial session and auth state to DB
    const partialSession = client.session.save() as unknown as string
    await savePendingAuth(sessionName, phoneNumber, phoneCodeHash, partialSession)

    console.log('[MTProto] Code sent, phoneCodeHash saved to DB')

    await client.disconnect()
    return { success: true, requiresCode: true }
  } catch (error) {
    console.error('[MTProto] Auth start error:', error)
    if (client) await client.disconnect().catch(() => {})
    return {
      success: false,
      requiresCode: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Complete authentication with the code
 * Retrieves auth state from DB
 */
export async function completeAuth(
  code: string,
  sessionName: string = ADMIN_SESSION_NAME
): Promise<{ success: boolean; userId?: string; error?: string }> {
  // Get pending auth from DB
  const pending = await getPendingAuth(sessionName)
  if (!pending) {
    return { success: false, error: 'No pending authentication. Please start again.' }
  }

  const { phoneNumber, phoneCodeHash, partialSession } = pending
  let client: TelegramClient | null = null

  try {
    // Recreate client with partial session
    client = await createClient(sessionName, partialSession)
    await client.connect()

    console.log('[MTProto] Verifying code for:', phoneNumber)

    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code,
      })
    )

    // Save completed session to database
    const sessionString = client.session.save() as unknown as string
    const userId = 'user' in result ? (result.user as Api.User).id : undefined
    const userIdBigInt = userId ? BigInt(userId.toString()) : undefined

    await saveSession(sessionName, sessionString, phoneNumber, userIdBigInt)

    console.log('[MTProto] Auth completed, session saved. User ID:', userId?.toString())

    await client.disconnect()
    return { success: true, userId: userId?.toString() }
  } catch (error) {
    console.error('[MTProto] Auth complete error:', error)

    // Check if 2FA is required
    if (error instanceof Error && error.message.includes('SESSION_PASSWORD_NEEDED')) {
      // Keep partial session for 2FA step
      return { success: false, error: '2FA_REQUIRED' }
    }

    if (client) await client.disconnect().catch(() => {})
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Complete 2FA authentication
 */
export async function complete2FA(
  password: string,
  sessionName: string = ADMIN_SESSION_NAME
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const pending = await getPendingAuth(sessionName)
  if (!pending) {
    return { success: false, error: 'No pending authentication' }
  }

  const { phoneNumber, partialSession } = pending
  let client: TelegramClient | null = null

  try {
    client = await createClient(sessionName, partialSession)
    await client.connect()

    // Get password info
    const passwordInfo = await client.invoke(new Api.account.GetPassword())

    // Compute password hash using SRP
    const { computeCheck } = await import('telegram/Password')
    const srpResult = await computeCheck(passwordInfo, password)

    // Complete auth with password
    const result = await client.invoke(
      new Api.auth.CheckPassword({
        password: srpResult,
      })
    )

    // Save session to database
    const sessionString = client.session.save() as unknown as string
    const userId = 'user' in result ? (result.user as Api.User).id : undefined
    const userIdBigInt = userId ? BigInt(userId.toString()) : undefined

    await saveSession(sessionName, sessionString, phoneNumber, userIdBigInt)

    await client.disconnect()
    return { success: true, userId: userId?.toString() }
  } catch (error) {
    console.error('[MTProto] 2FA error:', error)
    if (client) await client.disconnect().catch(() => {})
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Logout and clear session
 */
export async function logout(sessionName: string = ADMIN_SESSION_NAME): Promise<boolean> {
  try {
    const savedSession = await getStoredSession(sessionName)
    if (savedSession) {
      const client = await createClient(sessionName, savedSession)
      await client.connect()

      if (await client.isUserAuthorized()) {
        await client.invoke(new Api.auth.LogOut())
      }

      await client.disconnect()
    }

    await deleteSession(sessionName)
    return true
  } catch (error) {
    console.error('[MTProto] Logout error:', error)
    await deleteSession(sessionName) // Still delete local session
    return false
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(
  sessionName: string = ADMIN_SESSION_NAME
): Promise<{ id: string; firstName: string; lastName?: string; username?: string } | null> {
  try {
    const savedSession = await getStoredSession(sessionName)
    if (!savedSession) return null

    const client = await createClient(sessionName, savedSession)
    await client.connect()

    if (!(await client.isUserAuthorized())) {
      await client.disconnect()
      return null
    }

    const me = await client.getMe()
    await client.disconnect()

    if (!me) return null

    return {
      id: me.id.toString(),
      firstName: me.firstName || '',
      lastName: me.lastName,
      username: me.username,
    }
  } catch (error) {
    console.error('[MTProto] Get user error:', error)
    return null
  }
}
