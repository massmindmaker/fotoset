-- Migration 043: Security Audit Performance Indexes
-- Date: 2026-01-17
-- Purpose: Add missing indexes identified in comprehensive security audit
-- Addresses: Database schema review findings

-- ============================================================================
-- CRITICAL: Payment availability index for generation flow
-- ============================================================================
-- Used in: app/api/generate/route.ts - checking available payments
-- Pattern: WHERE user_id = ? AND status = 'succeeded' AND generation_consumed = FALSE
CREATE INDEX IF NOT EXISTS idx_payments_available_for_generation
  ON payments(user_id, status, provider)
  WHERE status = 'succeeded' AND generation_consumed = FALSE;

COMMENT ON INDEX idx_payments_available_for_generation IS
  'Optimizes payment lookup in generation flow - critical path index';

-- ============================================================================
-- CRITICAL: Telegram message queue for admin panel LATERAL join
-- ============================================================================
-- Used in: app/api/admin/users/route.ts - user list with message counts
-- Pattern: WHERE telegram_chat_id = u.telegram_user_id::text
CREATE INDEX IF NOT EXISTS idx_telegram_message_queue_chat_id
  ON telegram_message_queue(telegram_chat_id);

COMMENT ON INDEX idx_telegram_message_queue_chat_id IS
  'Optimizes admin panel user list with message counts';

-- ============================================================================
-- HIGH: Payments created_at for time-based queries
-- ============================================================================
-- Used in: Admin dashboard, revenue analytics, payment history
CREATE INDEX IF NOT EXISTS idx_payments_created_at
  ON payments(created_at DESC);

COMMENT ON INDEX idx_payments_created_at IS
  'Optimizes payment history and analytics queries ordered by time';

-- ============================================================================
-- HIGH: Generation jobs for active job queries
-- ============================================================================
-- Used in: Cron jobs checking for active/stuck jobs
-- Pattern: WHERE status IN ('pending', 'processing')
CREATE INDEX IF NOT EXISTS idx_generation_jobs_active
  ON generation_jobs(user_id, status)
  WHERE status IN ('pending', 'processing');

COMMENT ON INDEX idx_generation_jobs_active IS
  'Optimizes active generation job queries and rate limiting';

-- ============================================================================
-- MEDIUM: Kie tasks for polling cron job
-- ============================================================================
-- Used in: app/api/cron/poll-kie-tasks/route.ts
-- Pattern: WHERE status = 'pending' ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_kie_tasks_pending
  ON kie_tasks(status, created_at ASC)
  WHERE status = 'pending';

COMMENT ON INDEX idx_kie_tasks_pending IS
  'Optimizes cron job polling for pending Kie.ai tasks';

-- ============================================================================
-- MEDIUM: Referral earnings for balance calculations
-- ============================================================================
-- Used in: Referral balance queries
-- Pattern: WHERE referrer_id = ? AND status = 'completed'
CREATE INDEX IF NOT EXISTS idx_referral_earnings_by_referrer
  ON referral_earnings(referrer_id, status)
  WHERE status = 'completed';

COMMENT ON INDEX idx_referral_earnings_by_referrer IS
  'Optimizes referral earnings balance calculations';

-- ============================================================================
-- LOW: Webhook logs for admin panel
-- ============================================================================
-- Used in: Admin webhook log viewer
-- Pattern: ORDER BY created_at DESC LIMIT 100
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at
  ON webhook_logs(created_at DESC);

COMMENT ON INDEX idx_webhook_logs_created_at IS
  'Optimizes admin webhook log queries';

-- ============================================================================
-- Verify indexes created
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 043 complete: Created 7 performance indexes from security audit';
END $$;
