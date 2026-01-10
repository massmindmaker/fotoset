-- Migration: 042_add_missing_fk_indexes
-- Description: Add missing indexes for foreign keys to improve query performance
-- Date: 2026-01-10

-- HIGH PRIORITY: kie_tasks indexes
-- avatar_id is used in CASCADE deletes and lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kie_tasks_avatar_id
ON kie_tasks(avatar_id);

-- kie_task_id is used for Kie.ai polling callbacks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kie_tasks_kie_task_id
ON kie_tasks(kie_task_id);

-- MEDIUM PRIORITY: promo_code_usages indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promo_code_usages_code
ON promo_code_usages(promo_code_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promo_code_usages_user
ON promo_code_usages(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promo_code_usages_payment
ON promo_code_usages(payment_id);

-- LOW PRIORITY: Other missing FK indexes
-- pack_items.prompt_id - rarely queried by prompt
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pack_items_prompt
ON pack_items(prompt_id)
WHERE prompt_id IS NOT NULL;

-- telegram_broadcasts.admin_id - for admin filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_broadcasts_admin
ON telegram_broadcasts(admin_id);

-- payments.consumed_avatar_id - for generation tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_consumed_avatar
ON payments(consumed_avatar_id)
WHERE consumed_avatar_id IS NOT NULL;
