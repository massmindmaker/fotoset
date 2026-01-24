import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  console.log('Creating test partner...')
  
  // Check existing users
  const users = await sql`
    SELECT u.id, u.telegram_user_id, u.telegram_username, 
           rb.is_partner, rb.commission_rate, rb.balance
    FROM users u
    LEFT JOIN referral_balances rb ON rb.user_id = u.id
    WHERE u.telegram_username IS NOT NULL
    ORDER BY u.created_at DESC
    LIMIT 5
  `
  
  console.log('Recent users with usernames:')
  console.log(users)
  
  // Find my user or create test partner from first user
  const myUser = users.find(u => u.telegram_username?.toLowerCase() === 'bobrikov') || users[0]
  
  if (!myUser) {
    console.log('No users found, creating test user...')
    const newUser = await sql`
      INSERT INTO users (telegram_user_id, telegram_username, created_at)
      VALUES (999999999, 'testpartner', NOW())
      RETURNING id, telegram_user_id, telegram_username
    `
    console.log('Created test user:', newUser[0])
    
    // Create referral balance with partner status
    await sql`
      INSERT INTO referral_balances (user_id, is_partner, commission_rate, balance, referral_code)
      VALUES (${newUser[0].id}, TRUE, 0.50, 0, 'TESTPARTNER')
      ON CONFLICT (user_id) DO UPDATE
      SET is_partner = TRUE, commission_rate = 0.50
    `
    console.log('Made test user a partner!')
    return
  }
  
  console.log('Setting user as partner:', myUser.telegram_username)
  
  // Update or insert referral balance
  const result = await sql`
    INSERT INTO referral_balances (user_id, is_partner, commission_rate, balance)
    VALUES (${myUser.id}, TRUE, 0.50, 0)
    ON CONFLICT (user_id) DO UPDATE
    SET is_partner = TRUE, commission_rate = 0.50, partner_approved_at = NOW()
    RETURNING *
  `
  
  console.log('Partner created/updated:', result[0])
  console.log('\nLogin credentials:')
  console.log('Username:', myUser.telegram_username)
  console.log('URL: /partner/login')
}

main().catch(console.error)
