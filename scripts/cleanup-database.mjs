/**
 * Database Cleanup Script
 * Clears all test data while preserving schema
 */
import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Load .env.local file
config({ path: '.env.local' })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set")
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function cleanup() {
  console.log("🧹 Starting database cleanup...")

  try {
    // Clear kie_tasks first (references generation_jobs)
    console.log("  → Clearing kie_tasks...")
    await sql`DELETE FROM kie_tasks`

    // Clear generated content first (foreign key dependencies)
    console.log("  → Clearing generated_photos...")
    await sql`DELETE FROM generated_photos`

    console.log("  → Clearing generation_jobs...")
    await sql`DELETE FROM generation_jobs`

    console.log("  → Clearing reference_photos...")
    await sql`DELETE FROM reference_photos`

    // Clear referral system BEFORE payments (foreign key dependency)
    console.log("  → Clearing referral_earnings...")
    await sql`DELETE FROM referral_earnings`

    console.log("  → Clearing payments...")
    await sql`DELETE FROM payments`

    console.log("  → Clearing avatars...")
    await sql`DELETE FROM avatars`

    // Clear remaining referral system
    console.log("  → Clearing referrals...")
    await sql`DELETE FROM referrals`

    console.log("  → Clearing referral_balances...")
    await sql`DELETE FROM referral_balances`

    console.log("  → Clearing referral_withdrawals...")
    await sql`DELETE FROM referral_withdrawals`

    console.log("  → Clearing referral_codes...")
    await sql`DELETE FROM referral_codes`

    // Reset users pending_referral_code
    console.log("  → Resetting users.pending_referral_code...")
    await sql`UPDATE users SET pending_referral_code = NULL`

    // Clear users (optional - can be commented out if you want to keep users)
    console.log("  → Clearing users...")
    await sql`DELETE FROM users`

    console.log("✅ Database cleanup complete!")
  } catch (error) {
    console.error("❌ Cleanup failed:", error)
    process.exit(1)
  }
}

cleanup()
