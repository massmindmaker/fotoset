-- Migration: Add refund system support
-- Date: 2025-12-23
-- Purpose: Link generation_jobs to payments for automatic refunds

-- Add payment_id to generation_jobs for refund tracking
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id);

-- Add refund tracking to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_at TIMESTAMP WITH TIME ZONE;

-- Index for finding jobs that need refund processing
CREATE INDEX IF NOT EXISTS idx_generation_jobs_payment_id ON generation_jobs(payment_id);

-- Index for finding failed jobs with payments
CREATE INDEX IF NOT EXISTS idx_jobs_failed_with_payment ON generation_jobs(status, payment_id)
WHERE status = 'failed' AND payment_id IS NOT NULL;
