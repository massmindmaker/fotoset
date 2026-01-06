/**
 * Telegram Affiliate Program API
 *
 * Uses MTProto API to manage the official Telegram Stars Affiliate Program.
 * Documentation: https://core.telegram.org/api/bots/referrals
 *
 * Key methods:
 * - bots.updateStarRefProgram: Configure affiliate program (commission, duration)
 * - payments.connectStarRefBot: Affiliates get referral links
 * - payments.getStarTransactions: View affiliate earnings
 */

import { TelegramClient, Api } from 'telegram'
import { createClient, isAuthenticated } from './telegram-mtproto'
import { sql } from './db'

// Bot username for affiliate program
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'PinGlassBot'

export interface AffiliateSettings {
  commissionPermille: number // 100 = 10%, 500 = 50%
  durationMonths: number // 0 = indefinite
  isActive: boolean
  lastSyncedAt?: Date
}

export interface AffiliateStats {
  totalEarnings: number // in Stars
  pendingEarnings: number
  affiliateCount: number
  transactions: AffiliateTransaction[]
}

export interface AffiliateTransaction {
  id: string
  date: Date
  amount: number // Stars
  affiliateUserId: string
  affiliateUsername?: string
}

/**
 * Get current affiliate program settings from database
 */
export async function getAffiliateSettings(): Promise<AffiliateSettings | null> {
  const result = await sql`
    SELECT commission_permille, duration_months, is_active, last_synced_at
    FROM telegram_affiliate_settings
    WHERE bot_username = ${BOT_USERNAME}
    LIMIT 1
  `

  if (result.length === 0) return null

  return {
    commissionPermille: result[0].commission_permille,
    durationMonths: result[0].duration_months,
    isActive: result[0].is_active,
    lastSyncedAt: result[0].last_synced_at,
  }
}

/**
 * Save affiliate program settings to database
 */
async function saveAffiliateSettings(settings: AffiliateSettings): Promise<void> {
  await sql`
    INSERT INTO telegram_affiliate_settings
      (bot_username, commission_permille, duration_months, is_active, last_synced_at)
    VALUES
      (${BOT_USERNAME}, ${settings.commissionPermille}, ${settings.durationMonths}, ${settings.isActive}, NOW())
    ON CONFLICT (id)
    DO UPDATE SET
      commission_permille = EXCLUDED.commission_permille,
      duration_months = EXCLUDED.duration_months,
      is_active = EXCLUDED.is_active,
      last_synced_at = NOW(),
      updated_at = NOW()
  `
}

/**
 * Update Telegram Affiliate Program settings via MTProto
 *
 * @param commissionPermille - Commission rate in per-mille (100 = 10%, 500 = 50%)
 * @param durationMonths - Duration in months (0 = indefinite)
 */
export async function updateAffiliateProgram(
  commissionPermille: number,
  durationMonths: number = 0
): Promise<{ success: boolean; error?: string }> {
  // Validate commission (must be between 0 and 1000)
  if (commissionPermille < 0 || commissionPermille > 1000) {
    return { success: false, error: 'Commission must be between 0 and 1000 (0% to 100%)' }
  }

  // Check if authenticated
  if (!(await isAuthenticated())) {
    return { success: false, error: 'Not authenticated. Please login first.' }
  }

  let client: TelegramClient | null = null

  try {
    client = await createClient()
    await client.connect()

    // Get bot entity
    const botEntity = await client.getInputEntity(BOT_USERNAME)

    // Update affiliate program
    const result = await client.invoke(
      new Api.bots.UpdateStarRefProgram({
        bot: botEntity,
        commissionPermille,
        durationMonths,
      })
    )

    console.log('[Affiliate] Program updated:', result)

    // Save to database
    await saveAffiliateSettings({
      commissionPermille,
      durationMonths,
      isActive: true,
    })

    return { success: true }
  } catch (error) {
    console.error('[Affiliate] Update error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    if (client) {
      await client.disconnect()
    }
  }
}

/**
 * Disable the affiliate program
 */
export async function disableAffiliateProgram(): Promise<{ success: boolean; error?: string }> {
  if (!(await isAuthenticated())) {
    return { success: false, error: 'Not authenticated' }
  }

  let client: TelegramClient | null = null

  try {
    client = await createClient()
    await client.connect()

    const botEntity = await client.getInputEntity(BOT_USERNAME)

    // Setting commission to 0 effectively disables the program
    await client.invoke(
      new Api.bots.UpdateStarRefProgram({
        bot: botEntity,
        commissionPermille: 0,
        durationMonths: 0,
      })
    )

    // Update database
    await sql`
      UPDATE telegram_affiliate_settings
      SET is_active = FALSE, updated_at = NOW()
      WHERE bot_username = ${BOT_USERNAME}
    `

    return { success: true }
  } catch (error) {
    console.error('[Affiliate] Disable error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    if (client) {
      await client.disconnect()
    }
  }
}

/**
 * Get affiliate referral link for a user
 * This allows partners to get their personalized referral link
 */
export async function getAffiliateLink(
  userId: number
): Promise<{ success: boolean; link?: string; error?: string }> {
  // For now, we generate a simple link format
  // The actual link is generated when user connects to the bot via MTProto
  const referralLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`

  return { success: true, link: referralLink }
}

/**
 * Get affiliate program statistics from Telegram
 * Uses getStarTransactions to fetch affiliate earnings
 */
export async function getAffiliateStats(): Promise<{
  success: boolean
  stats?: AffiliateStats
  error?: string
}> {
  if (!(await isAuthenticated())) {
    return { success: false, error: 'Not authenticated' }
  }

  let client: TelegramClient | null = null

  try {
    client = await createClient()
    await client.connect()

    // Get bot peer
    const botEntity = await client.getInputEntity(BOT_USERNAME)

    // Get star transactions for affiliate program
    const transactions = await client.invoke(
      new Api.payments.GetStarsTransactions({
        peer: botEntity,
        inbound: true, // Incoming affiliate commissions
        offset: '',
        limit: 100,
      })
    )

    // Process transactions
    const affiliateTransactions: AffiliateTransaction[] = []
    let totalEarnings = 0

    if ('history' in transactions && transactions.history) {
      for (const tx of transactions.history) {
        // Filter for affiliate program transactions
        // Note: Actual type checking may vary based on gramjs version
        const peerClassName = tx.peer && 'className' in tx.peer ? (tx.peer as { className: string }).className : ''
        if (peerClassName.includes('Affiliate') || peerClassName.includes('affiliate')) {
          const amount = Number(tx.stars)
          totalEarnings += amount

          affiliateTransactions.push({
            id: tx.id,
            date: new Date(tx.date * 1000),
            amount,
            affiliateUserId: '', // Would need to extract from peer
          })
        }
      }
    }

    return {
      success: true,
      stats: {
        totalEarnings,
        pendingEarnings: 0, // Stars are held for 21 days
        affiliateCount: affiliateTransactions.length,
        transactions: affiliateTransactions,
      },
    }
  } catch (error) {
    console.error('[Affiliate] Get stats error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    if (client) {
      await client.disconnect()
    }
  }
}

/**
 * Check if affiliate program is properly configured and active
 */
export async function checkAffiliateProgramStatus(): Promise<{
  configured: boolean
  authenticated: boolean
  active: boolean
  settings?: AffiliateSettings
}> {
  const settings = await getAffiliateSettings()
  const authenticated = await isAuthenticated()

  return {
    configured: settings !== null,
    authenticated,
    active: settings?.isActive ?? false,
    settings: settings ?? undefined,
  }
}
