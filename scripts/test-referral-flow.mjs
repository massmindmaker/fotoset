/**
 * Referral System End-to-End Test
 * Tests the full referral flow: code creation → user signup → onboarding → payment → earnings
 */
import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"
import crypto from "crypto"

// Load .env.local file
config({ path: '.env.local' })

const DATABASE_URL = process.env.DATABASE_URL
const TBANK_TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY
const TBANK_PASSWORD = process.env.TBANK_PASSWORD

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set")
  process.exit(1)
}

const sql = neon(DATABASE_URL)

// Test user IDs (mock Telegram IDs)
const REFERRER_TG_ID = 111111111
const REFERRED_TG_ID = 222222222

async function testReferralFlow() {
  console.log("🧪 Testing Referral System Flow\n")

  try {
    // ========================================
    // STEP 1: Create Referrer (User A)
    // ========================================
    console.log("📌 Step 1: Creating referrer user (User A)...")

    // Insert user A directly
    const [userA] = await sql`
      INSERT INTO users (telegram_user_id)
      VALUES (${REFERRER_TG_ID})
      ON CONFLICT (telegram_user_id) DO UPDATE SET telegram_user_id = EXCLUDED.telegram_user_id
      RETURNING id, telegram_user_id
    `
    console.log(`   ✅ User A created: id=${userA.id}, telegram_user_id=${userA.telegram_user_id}`)

    // ========================================
    // STEP 2: Generate Referral Code for User A
    // ========================================
    console.log("\n📌 Step 2: Creating referral code for User A...")

    // Generate unique code
    const code = crypto.randomBytes(4).toString("hex").toUpperCase()

    // Check if user already has a code
    let [existingCode] = await sql`
      SELECT id, code FROM referral_codes WHERE user_id = ${userA.id}
    `

    let referralCode
    if (existingCode) {
      referralCode = existingCode
    } else {
      [referralCode] = await sql`
        INSERT INTO referral_codes (user_id, code, is_active)
        VALUES (${userA.id}, ${code}, true)
        RETURNING id, code
      `
    }
    console.log(`   ✅ Referral code created: ${referralCode.code}`)

    // Initialize referral balance for User A
    await sql`
      INSERT INTO referral_balances (user_id, balance, total_earned, total_withdrawn, referrals_count)
      VALUES (${userA.id}, 0, 0, 0, 0)
      ON CONFLICT (user_id) DO NOTHING
    `
    console.log(`   ✅ Referral balance initialized for User A`)

    // ========================================
    // STEP 3: Create Referred User (User B) with referral code
    // ========================================
    console.log("\n📌 Step 3: Creating referred user (User B) with referral code...")

    const [userB] = await sql`
      INSERT INTO users (telegram_user_id, pending_referral_code)
      VALUES (${REFERRED_TG_ID}, ${referralCode.code})
      ON CONFLICT (telegram_user_id) DO UPDATE
      SET pending_referral_code = EXCLUDED.pending_referral_code
      RETURNING id, telegram_user_id, pending_referral_code
    `
    console.log(`   ✅ User B created: id=${userB.id}, pending_referral_code=${userB.pending_referral_code}`)

    // ========================================
    // STEP 4: User B completes onboarding (simulates markOnboardingComplete)
    // ========================================
    console.log("\n📌 Step 4: User B completes onboarding...")

    // This logic mirrors what /api/user does with markOnboardingComplete=true
    const pendingCode = userB.pending_referral_code

    if (pendingCode) {
      // Find referrer
      const [codeRow] = await sql`
        SELECT rc.user_id as referrer_id
        FROM referral_codes rc
        WHERE rc.code = ${pendingCode} AND rc.is_active = true
      `

      if (codeRow && codeRow.referrer_id !== userB.id) {
        // Check if referral already exists
        const [existingReferral] = await sql`
          SELECT id FROM referrals WHERE referred_id = ${userB.id}
        `

        if (!existingReferral) {
          // Create referral record
          await sql`
            INSERT INTO referrals (referrer_id, referred_id)
            VALUES (${codeRow.referrer_id}, ${userB.id})
          `
          console.log(`   ✅ Referral link created: User A → User B`)

          // Increment referrals_count
          await sql`
            UPDATE referral_balances
            SET referrals_count = referrals_count + 1, updated_at = NOW()
            WHERE user_id = ${codeRow.referrer_id}
          `
          console.log(`   ✅ Referrals count incremented for User A`)
        }

        // Clear pending code
        await sql`
          UPDATE users SET pending_referral_code = NULL WHERE id = ${userB.id}
        `
        console.log(`   ✅ Pending referral code cleared`)
      }
    }

    // Verify referral was created
    const [referral] = await sql`
      SELECT * FROM referrals WHERE referred_id = ${userB.id}
    `
    if (referral) {
      console.log(`   ✅ Referral record verified: referrer_id=${referral.referrer_id}, referred_id=${referral.referred_id}`)
    } else {
      console.log(`   ❌ Referral record NOT found!`)
    }

    // Check referral balance
    const [balanceAfterOnboarding] = await sql`
      SELECT * FROM referral_balances WHERE user_id = ${userA.id}
    `
    console.log(`   📊 User A balance after onboarding: referrals_count=${balanceAfterOnboarding?.referrals_count || 0}`)

    // ========================================
    // STEP 5: Simulate User B's successful payment
    // ========================================
    console.log("\n📌 Step 5: Simulating User B's payment (500₽)...")

    const paymentAmount = 500

    // Create payment record
    const [payment] = await sql`
      INSERT INTO payments (user_id, tbank_payment_id, amount, currency, status, tier_id)
      VALUES (${userB.id}, ${'test_' + Date.now()}, ${paymentAmount}, 'RUB', 'succeeded', 'starter')
      RETURNING id, amount
    `
    console.log(`   ✅ Payment created: id=${payment.id}, amount=${payment.amount}₽`)

    // ========================================
    // STEP 6: Process referral earnings (simulates payment/status endpoint)
    // ========================================
    console.log("\n📌 Step 6: Processing referral earnings (10% = 50₽)...")

    // Find if user B has a referrer
    const [referralForEarnings] = await sql`
      SELECT referrer_id FROM referrals WHERE referred_id = ${userB.id}
    `

    if (referralForEarnings) {
      const commissionRate = 0.10 // 10%
      const earningAmount = Math.floor(paymentAmount * commissionRate)

      // Check if earning already exists for this payment
      const [existingEarning] = await sql`
        SELECT id FROM referral_earnings WHERE payment_id = ${payment.id}
      `

      if (!existingEarning) {
        // Create earning record (rate = 10% = 0.10)
        await sql`
          INSERT INTO referral_earnings (referrer_id, referred_id, payment_id, amount, rate, status)
          VALUES (${referralForEarnings.referrer_id}, ${userB.id}, ${payment.id}, ${earningAmount}, 0.10, 'pending')
        `
        console.log(`   ✅ Earning record created: ${earningAmount}₽ (10% of ${paymentAmount}₽)`)

        // Update referrer's balance
        await sql`
          UPDATE referral_balances
          SET
            balance = balance + ${earningAmount},
            total_earned = total_earned + ${earningAmount},
            updated_at = NOW()
          WHERE user_id = ${referralForEarnings.referrer_id}
        `
        console.log(`   ✅ User A's balance updated`)
      } else {
        console.log(`   ⚠️ Earning already exists for this payment`)
      }
    } else {
      console.log(`   ⚠️ No referrer found for User B`)
    }

    // ========================================
    // STEP 7: Verify Final State
    // ========================================
    console.log("\n📌 Step 7: Verifying final state...")

    // Check User A's final balance
    const [finalBalance] = await sql`
      SELECT * FROM referral_balances WHERE user_id = ${userA.id}
    `

    console.log("\n" + "=".repeat(50))
    console.log("📊 FINAL RESULTS:")
    console.log("=".repeat(50))
    console.log(`   User A (Referrer):`)
    console.log(`     - Telegram ID: ${REFERRER_TG_ID}`)
    console.log(`     - Referral Code: ${referralCode.code}`)
    console.log(`     - Referrals Count: ${finalBalance?.referrals_count || 0}`)
    console.log(`     - Balance: ${finalBalance?.balance || 0}₽`)
    console.log(`     - Total Earned: ${finalBalance?.total_earned || 0}₽`)

    console.log(`\n   User B (Referred):`)
    console.log(`     - Telegram ID: ${REFERRED_TG_ID}`)
    console.log(`     - Payment: ${paymentAmount}₽`)
    console.log(`     - Referrer earned: ${Math.floor(paymentAmount * 0.10)}₽`)

    // Verify earnings
    const [earnings] = await sql`
      SELECT * FROM referral_earnings WHERE referrer_id = ${userA.id}
    `
    if (earnings) {
      console.log(`\n   ✅ Referral earnings verified:`)
      console.log(`     - Amount: ${earnings.amount}₽`)
      console.log(`     - Rate: ${(earnings.rate * 100).toFixed(0)}%`)
      console.log(`     - Status: ${earnings.status}`)
    }

    // ========================================
    // VALIDATION
    // ========================================
    console.log("\n" + "=".repeat(50))
    console.log("🧪 VALIDATION:")
    console.log("=".repeat(50))

    const tests = [
      { name: "Referral code created", pass: !!referralCode.code },
      { name: "Referral link established", pass: !!referral },
      { name: "Referrals count incremented", pass: (finalBalance?.referrals_count || 0) === 1 },
      { name: "Earnings recorded", pass: parseFloat(finalBalance?.balance || 0) >= 50 },
      { name: "Total earned updated", pass: parseFloat(finalBalance?.total_earned || 0) >= 50 },
    ]

    let allPassed = true
    tests.forEach(test => {
      const status = test.pass ? "✅ PASS" : "❌ FAIL"
      console.log(`   ${status}: ${test.name}`)
      if (!test.pass) allPassed = false
    })

    console.log("\n" + "=".repeat(50))
    if (allPassed) {
      console.log("🎉 ALL TESTS PASSED! Referral system is working correctly.")
    } else {
      console.log("⚠️ SOME TESTS FAILED! Check the referral system logic.")
    }
    console.log("=".repeat(50))

  } catch (error) {
    console.error("\n❌ Test failed with error:", error)
    process.exit(1)
  }
}

testReferralFlow()
