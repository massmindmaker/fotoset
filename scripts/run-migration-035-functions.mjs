#!/usr/bin/env node
import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function main() {
  console.log('Running 035 functions and views...')

  // Function: log_withdrawal_status_change
  try {
    await sql`
      CREATE OR REPLACE FUNCTION log_withdrawal_status_change()
      RETURNS TRIGGER AS $func$
      BEGIN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          INSERT INTO withdrawal_logs (withdrawal_id, status, message, actor_type, metadata)
          VALUES (
            NEW.id,
            NEW.status,
            CASE
              WHEN NEW.status = 'processing' THEN 'Withdrawal sent to T-Bank'
              WHEN NEW.status = 'completed' THEN 'Withdrawal completed successfully'
              WHEN NEW.status = 'failed' THEN 'Withdrawal failed: ' || COALESCE(NEW.error_message, 'Unknown error')
              WHEN NEW.status = 'cancelled' THEN 'Withdrawal cancelled'
              ELSE 'Status changed to ' || NEW.status
            END,
            'system',
            jsonb_build_object(
              'old_status', OLD.status,
              'new_status', NEW.status,
              'tbank_payment_id', NEW.tbank_payment_id
            )
          );
        END IF;
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql
    `
    console.log('OK: log_withdrawal_status_change function created')
  } catch (e) {
    console.log('log_withdrawal_status_change:', e.message)
  }

  // Trigger
  try {
    await sql`DROP TRIGGER IF EXISTS trg_withdrawal_status_change ON withdrawals`
    await sql`
      CREATE TRIGGER trg_withdrawal_status_change
        AFTER UPDATE ON withdrawals
        FOR EACH ROW
        EXECUTE FUNCTION log_withdrawal_status_change()
    `
    console.log('OK: trg_withdrawal_status_change trigger created')
  } catch (e) {
    console.log('trigger:', e.message)
  }

  // View: withdrawal_stats
  try {
    await sql`
      CREATE OR REPLACE VIEW withdrawal_stats AS
      SELECT
        user_id,
        COUNT(*) AS total_withdrawals,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_withdrawals,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_withdrawals,
        SUM(amount) FILTER (WHERE status = 'completed') AS total_withdrawn,
        SUM(amount) FILTER (WHERE status = 'pending') AS pending_amount,
        MAX(completed_at) AS last_withdrawal_at
      FROM withdrawals
      GROUP BY user_id
    `
    console.log('OK: withdrawal_stats view created')
  } catch (e) {
    console.log('withdrawal_stats:', e.message)
  }

  // Function: can_user_withdraw
  try {
    await sql`
      CREATE OR REPLACE FUNCTION can_user_withdraw(p_user_id INTEGER, p_amount DECIMAL)
      RETURNS TABLE (
        can_withdraw BOOLEAN,
        reason TEXT,
        available_balance DECIMAL
      ) AS $func$
      DECLARE
        v_balance DECIMAL;
        v_pending DECIMAL;
        v_has_card BOOLEAN;
      BEGIN
        SELECT COALESCE(balance, 0) INTO v_balance
        FROM referral_balances
        WHERE user_id = p_user_id;

        SELECT COALESCE(SUM(amount), 0) INTO v_pending
        FROM withdrawals
        WHERE user_id = p_user_id AND status IN ('pending', 'processing');

        SELECT EXISTS(
          SELECT 1 FROM user_cards
          WHERE user_id = p_user_id AND is_active = TRUE
        ) INTO v_has_card;

        available_balance := v_balance - v_pending;

        IF v_balance IS NULL OR v_balance = 0 THEN
          can_withdraw := FALSE;
          reason := 'No referral balance';
        ELSIF p_amount < 5000 THEN
          can_withdraw := FALSE;
          reason := 'Minimum withdrawal is 5000 RUB';
        ELSIF available_balance < p_amount THEN
          can_withdraw := FALSE;
          reason := 'Insufficient funds (pending withdrawals considered)';
        ELSIF NOT v_has_card THEN
          can_withdraw := FALSE;
          reason := 'Add a card for withdrawal';
        ELSE
          can_withdraw := TRUE;
          reason := NULL;
        END IF;

        RETURN NEXT;
      END;
      $func$ LANGUAGE plpgsql
    `
    console.log('OK: can_user_withdraw function created')
  } catch (e) {
    console.log('can_user_withdraw:', e.message)
  }

  // Verification
  console.log('\n=== Verification ===')

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('link_tokens', 'user_identities', 'partner_applications', 'user_cards', 'withdrawals', 'withdrawal_logs')
    ORDER BY table_name
  `
  console.log('New tables:', tables.map(t => t.table_name).join(', '))

  const columns = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name IN ('email', 'neon_auth_id', 'auth_provider', 'name', 'avatar_url')
    ORDER BY column_name
  `
  console.log('New user columns:', columns.map(c => c.column_name).join(', '))

  const functions = await sql`
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN ('log_withdrawal_status_change', 'can_user_withdraw')
  `
  console.log('Functions:', functions.map(f => f.routine_name).join(', '))

  const userCount = await sql`SELECT COUNT(*) as count FROM users`
  const identityCount = await sql`SELECT COUNT(*) as count FROM user_identities`

  console.log(`\nUsers: ${userCount[0].count}, Identities: ${identityCount[0].count}`)
  console.log('\nAll migrations completed successfully!')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
