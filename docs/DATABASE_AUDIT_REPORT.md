# Database Schema Audit Report - PinGlass

**Generated:** 2026-01-10
**Database:** PostgreSQL (Neon Serverless)
**Migration Count:** 37+ files analyzed

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Critical Issues](#critical-issues)
3. [Tables by Category](#tables-by-category)
4. [Detailed Table Schemas](#detailed-table-schemas)
5. [Index Analysis](#index-analysis)
6. [Foreign Key Map](#foreign-key-map)
7. [Migration Inconsistencies](#migration-inconsistencies)
8. [Recommendations](#recommendations)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Tables | 47 |
| Total Indexes | 80+ |
| Foreign Keys | 40+ |
| CHECK Constraints | 3 |
| UNIQUE Constraints | 25+ |
| Missing FK Indexes | 5 |
| Duplicate Table Definitions | 2 |

---

## Critical Issues

### 1. CRITICAL: Duplicate Table Definitions
**Files:** `004_add_referrals.sql` and `007_add_referral_system.sql`

Both migrations define the same tables with DIFFERENT schemas:
- `referral_codes`
- `referral_balances`
- `referrals`
- `referral_earnings`
- `referral_withdrawals`

**Example Conflict:**
```sql
-- 004_add_referrals.sql
CREATE TABLE referral_withdrawals (
  payout_method VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(200) NOT NULL,
  ...
);

-- 007_add_referral_system.sql
CREATE TABLE referral_withdrawals (
  method VARCHAR(20) DEFAULT 'card',  -- Different column name!
  -- NO recipient_name column
  ...
);
```

**Impact:** `IF NOT EXISTS` prevents errors but schema depends on migration order.

### 2. CRITICAL: Duplicate Migration Numbers
- `009_referral_earnings_unique.sql`
- `009_fix_telegram_constraint.sql`

- `020_admin_actions.sql`
- `020_partner_program.sql`

- `023_test_mode_tracking.sql`
- `023_pack_items_prompt_link.sql`

**Impact:** Migration order is undefined; may cause FK or index conflicts.

### 3. HIGH: Missing Migration 025, 030, 031
Numbering gaps: 024 -> 026, 029 -> 032

**Impact:** Confusing; may indicate deleted/failed migrations.

### 4. HIGH: Foreign Key Without Index
```sql
-- referral_earnings.payment_id - has index (OK)
-- referral_earnings.referrer_id - has index (OK)
-- referral_earnings.referred_id - has index (015_add_indexes.sql - OK)

-- MISSING:
-- promo_code_usages.promo_code_id - NO INDEX
-- promo_code_usages.user_id - NO INDEX
-- promo_code_usages.payment_id - NO INDEX
-- pack_items.prompt_id - NO INDEX (added 023)
-- telegram_broadcasts.admin_id - NO INDEX
```

### 5. MEDIUM: payments Table Missing provider Column in Base Schema
The base schema `001-create-tables.sql` doesn't define `provider`, but code expects it.

Columns added via migrations but not documented in base:
- `provider` VARCHAR(20)
- `telegram_charge_id` VARCHAR(255)
- `stars_amount` INTEGER
- `ton_tx_hash` CHAR(64)
- `ton_amount` DECIMAL(20,9)
- `ton_sender_address` VARCHAR(48)
- `ton_confirmations` INTEGER

### 6. MEDIUM: TypeScript Types Out of Sync
`lib/db.ts` is missing types for:
- `telegram_chat_id` on User (code uses it but not in type)
- Multi-currency referral fields (balance_ton, earned_ton, etc.)
- All payment provider columns

---

## Tables by Category

### Core Business (8 tables)
| Table | Records Est. | Purpose |
|-------|-------------|---------|
| users | High | User accounts |
| avatars | High | User personas |
| uploaded_photos | High | Reference photos |
| generated_photos | Very High | AI-generated results |
| reference_photos | High | Generation inputs |
| payments | High | All payment records |
| generation_jobs | High | Async job tracking |
| kie_tasks | Very High | Kie.ai polling tasks |

### Referral System (6 tables)
| Table | Purpose |
|-------|---------|
| referral_codes | User referral codes |
| referral_balances | Balance tracking (multi-currency) |
| referrals | Referral relationships |
| referral_earnings | Commission records |
| referral_withdrawals | Payout requests |
| partner_applications | Partner program applications |

### Telegram Integration (7 tables)
| Table | Purpose |
|-------|---------|
| telegram_sessions | User-chat linking |
| telegram_link_codes | Web-to-Telegram linking |
| telegram_message_queue | Notification queue |
| telegram_broadcasts | Mass messaging |
| telegram_mtproto_sessions | Admin MTProto sessions |
| telegram_affiliate_settings | Affiliate program config |
| support_ticket_drafts | Ticket creation state |

### Admin Panel (10 tables)
| Table | Purpose |
|-------|---------|
| admin_users | Admin accounts |
| admin_sessions | Admin JWT sessions |
| admin_activity_log | Audit trail |
| admin_notifications | Notification center |
| admin_actions | Action audit log |
| admin_settings | Configuration K/V |
| saved_prompts | Prompt library |
| photo_packs | Generation packs |
| pack_items | Pack contents |
| promo_codes | Discount codes |
| promo_code_usages | Usage tracking |

### Support System (6 tables)
| Table | Purpose |
|-------|---------|
| support_tickets | Customer tickets |
| support_ticket_messages | Ticket conversations |
| support_faq_analytics | FAQ usage stats |
| support_operators | Operator settings |
| support_canned_responses | Quick replies |
| support_sla_config | SLA configuration |

### Utility (5 tables)
| Table | Purpose |
|-------|---------|
| webhook_logs | Webhook audit |
| photo_favorites | User favorites |
| shared_galleries | Temporary share links |
| user_identities | OAuth providers |
| link_tokens | Account linking |
| user_cards | T-Bank payout cards |
| withdrawals | Withdrawal requests |
| withdrawal_logs | Withdrawal audit |
| qstash_processed_messages | Idempotency tracking |
| exchange_rates | Currency conversion |
| orphan_payments | Unmatched TON tx |

---

## Detailed Table Schemas

### 1. users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,

  -- Telegram identity (nullable after 033)
  telegram_user_id BIGINT,  -- UNIQUE constraint
  telegram_username VARCHAR(255),

  -- Web identity (033_hybrid_auth.sql)
  neon_auth_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  name VARCHAR(255),
  avatar_url TEXT,
  auth_provider VARCHAR(50),  -- 'telegram', 'google', 'email', 'github'

  -- Referral
  pending_referral_code VARCHAR(20),

  -- Pending generation (018)
  pending_generation_tier VARCHAR(20),
  pending_generation_avatar_id INTEGER REFERENCES avatars(id) ON DELETE SET NULL,
  pending_generation_at TIMESTAMP,

  -- Onboarding (019)
  onboarding_completed_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints (033)
  CONSTRAINT chk_user_has_identity
    CHECK (telegram_user_id IS NOT NULL OR neon_auth_id IS NOT NULL)
);

-- Indexes
CREATE UNIQUE INDEX idx_users_telegram_unique ON users(telegram_user_id);  -- 009_fix
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_neon_auth_id ON users(neon_auth_id) WHERE neon_auth_id IS NOT NULL;
CREATE INDEX idx_users_auth_provider ON users(auth_provider) WHERE auth_provider IS NOT NULL;
CREATE INDEX idx_users_pending_referral ON users(pending_referral_code);
CREATE INDEX idx_users_pending_generation ON users(pending_generation_tier) WHERE pending_generation_tier IS NOT NULL;
CREATE INDEX idx_users_onboarding ON users(onboarding_completed_at) WHERE onboarding_completed_at IS NOT NULL;
CREATE INDEX idx_users_telegram_username ON users(telegram_username);
```

**Issues:**
- `telegram_chat_id` referenced in code but NOT in schema - NEEDS MIGRATION
- TypeScript type missing several columns

---

### 2. avatars
```sql
CREATE TABLE avatars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'My avatar',
  status VARCHAR(50) DEFAULT 'draft',  -- draft, processing, ready
  thumbnail_url TEXT,
  idempotency_key VARCHAR(255),  -- 012_avatar_idempotency.sql
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_avatars_user_id ON avatars(user_id);
CREATE INDEX idx_avatars_status ON avatars(status);
CREATE INDEX idx_avatars_user_status ON avatars(user_id, status);
CREATE UNIQUE INDEX idx_avatars_idempotency_key ON avatars(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**Issues:** None identified.

---

### 3. payments
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  -- T-Bank
  tbank_payment_id VARCHAR(255) UNIQUE,

  -- Multi-provider (added via migrations, NOT in base schema)
  provider VARCHAR(20) DEFAULT 'tbank',  -- 'tbank', 'stars', 'ton'
  telegram_charge_id VARCHAR(255) UNIQUE,
  stars_amount INTEGER,
  ton_tx_hash CHAR(64) UNIQUE,
  ton_amount DECIMAL(20,9),
  ton_sender_address VARCHAR(48),
  ton_confirmations INTEGER,

  -- Amounts
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'RUB',
  original_currency VARCHAR(10),
  original_amount DECIMAL(20,9),
  exchange_rate DECIMAL(20,10),
  rate_locked_at TIMESTAMP,
  rate_expires_at TIMESTAMP,

  -- Status
  status VARCHAR(50) DEFAULT 'pending',  -- pending, succeeded, canceled, refunded, refunding

  -- Tier info (002)
  tier_id VARCHAR(50),
  photo_count INTEGER,

  -- Refund (016)
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_status VARCHAR(50),
  refund_reason TEXT,
  refund_at TIMESTAMP WITH TIME ZONE,

  -- Generation binding (026)
  generation_consumed BOOLEAN DEFAULT FALSE,
  consumed_at TIMESTAMP WITH TIME ZONE,
  consumed_avatar_id INTEGER REFERENCES avatars(id),

  -- Test mode (023)
  is_test_mode BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_test_mode ON payments(is_test_mode);
CREATE INDEX idx_payments_available ON payments(user_id, status, generation_consumed)
  WHERE status = 'succeeded' AND generation_consumed = FALSE;
```

**Issues:**
- Base schema doesn't define provider columns - causes confusion
- TypeScript `Payment` type is incomplete
- No index on `consumed_avatar_id` (FK without index)

---

### 4. generation_jobs
```sql
CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id) ON DELETE CASCADE,
  style_id VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed
  total_photos INTEGER DEFAULT 23,
  completed_photos INTEGER DEFAULT 0,
  error_message TEXT,

  -- Refund link (016)
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,

  -- Test mode (023)
  is_test_mode BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_generation_jobs_avatar_id ON generation_jobs(avatar_id);
CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX idx_generation_jobs_active ON generation_jobs(status)
  WHERE status IN ('pending', 'processing');
CREATE INDEX idx_generation_jobs_payment_id ON generation_jobs(payment_id);
CREATE INDEX idx_jobs_failed_with_payment ON generation_jobs(status, payment_id)
  WHERE status = 'failed' AND payment_id IS NOT NULL;
CREATE INDEX idx_generation_jobs_test_mode ON generation_jobs(is_test_mode);
```

**Issues:** None identified.

---

### 5. kie_tasks
```sql
CREATE TABLE kie_tasks (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES generation_jobs(id) ON DELETE CASCADE,
  avatar_id INTEGER REFERENCES avatars(id) ON DELETE CASCADE,
  kie_task_id VARCHAR(255) NOT NULL,
  prompt_index INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, completed, failed
  result_url TEXT,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_kie_tasks_status ON kie_tasks(status);
CREATE INDEX idx_kie_tasks_job_id ON kie_tasks(job_id);
```

**Issues:**
- No index on `avatar_id` (FK without index) - NEEDS INDEX
- Missing index on `kie_task_id` for Kie.ai polling

---

### 6. referral_balances (Final Schema after all migrations)
```sql
CREATE TABLE referral_balances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Legacy RUB (deprecated, use balance_rub)
  balance DECIMAL(10,2) DEFAULT 0,
  total_earned DECIMAL(10,2) DEFAULT 0,
  total_withdrawn DECIMAL(10,2) DEFAULT 0,

  -- Multi-currency (032)
  balance_rub DECIMAL(10,2) DEFAULT 0,
  balance_ton DECIMAL(20,9) DEFAULT 0,
  earned_rub DECIMAL(10,2) DEFAULT 0,
  earned_ton DECIMAL(20,9) DEFAULT 0,
  withdrawn_rub DECIMAL(10,2) DEFAULT 0,
  withdrawn_ton DECIMAL(20,9) DEFAULT 0,
  ton_wallet_address VARCHAR(48),

  -- Partner program (020)
  referral_code VARCHAR(20) UNIQUE,  -- From 013 migration
  commission_rate DECIMAL(5,4) DEFAULT 0.10,
  is_partner BOOLEAN DEFAULT FALSE,
  partner_approved_at TIMESTAMP,
  partner_approved_by VARCHAR(255),
  partner_since TIMESTAMP,  -- From 034

  referrals_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_referral_balances_is_partner ON referral_balances(is_partner) WHERE is_partner = TRUE;
CREATE INDEX idx_referral_balances_ton ON referral_balances(balance_ton) WHERE balance_ton > 0;
```

**Issues:**
- Duplicate columns: `balance` vs `balance_rub` - NEEDS CLEANUP
- TypeScript type missing multi-currency fields

---

### 7. referral_earnings
```sql
CREATE TABLE referral_earnings (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  payment_id INTEGER UNIQUE REFERENCES payments(id) ON DELETE SET NULL,  -- 009 + 015

  -- Amounts
  amount DECIMAL(10,2) NOT NULL,
  original_amount DECIMAL(10,2),
  rate DECIMAL(3,2) DEFAULT 0.10,

  -- Multi-currency (032)
  currency VARCHAR(3) DEFAULT 'RUB',
  native_amount DECIMAL(20,9),
  provider VARCHAR(20),  -- Added for tracking

  status VARCHAR(20) DEFAULT 'pending',  -- pending -> confirmed (029)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_referral_earnings_referrer ON referral_earnings(referrer_id);
CREATE INDEX idx_referral_earnings_referred ON referral_earnings(referred_id);
CREATE INDEX idx_referral_earnings_payment_id ON referral_earnings(payment_id);
CREATE INDEX idx_referral_earnings_currency ON referral_earnings(currency);
```

**Issues:**
- `referred_id` renamed to `referred_user_id` in code but not in migrations

---

### 8. support_tickets
```sql
CREATE TABLE support_tickets (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(20) UNIQUE NOT NULL,

  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  telegram_chat_id BIGINT NOT NULL,
  telegram_username VARCHAR(255),
  user_name VARCHAR(255),

  subject VARCHAR(500),
  category VARCHAR(50) DEFAULT 'general',
  priority VARCHAR(10) DEFAULT 'P3',
  status VARCHAR(20) DEFAULT 'open',

  -- SLA
  sla_first_response_at TIMESTAMP,
  sla_resolution_at TIMESTAMP,
  first_responded_at TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,

  -- Assignment
  assigned_to VARCHAR(100),
  assigned_at TIMESTAMP,

  -- Escalation
  escalated BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMP,
  escalation_reason TEXT,

  -- Meta
  source VARCHAR(50) DEFAULT 'telegram',
  tags TEXT[],
  user_rating INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger for auto-updated_at
CREATE TRIGGER trigger_support_tickets_updated
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_tickets_updated_at();
```

**Issues:** Well-designed, no major issues.

---

## Index Analysis

### Missing Indexes (Performance Impact)
| Table | Column | Impact |
|-------|--------|--------|
| kie_tasks | avatar_id | HIGH - FK lookups slow |
| promo_code_usages | promo_code_id | MEDIUM |
| promo_code_usages | user_id | MEDIUM |
| promo_code_usages | payment_id | MEDIUM |
| pack_items | prompt_id | LOW |
| telegram_broadcasts | admin_id | LOW |
| payments | consumed_avatar_id | LOW |

### Recommended New Indexes
```sql
-- HIGH PRIORITY
CREATE INDEX idx_kie_tasks_avatar_id ON kie_tasks(avatar_id);
CREATE INDEX idx_kie_tasks_kie_task_id ON kie_tasks(kie_task_id);

-- MEDIUM PRIORITY
CREATE INDEX idx_promo_code_usages_code ON promo_code_usages(promo_code_id);
CREATE INDEX idx_promo_code_usages_user ON promo_code_usages(user_id);
CREATE INDEX idx_promo_code_usages_payment ON promo_code_usages(payment_id);

-- LOW PRIORITY
CREATE INDEX idx_pack_items_prompt ON pack_items(prompt_id) WHERE prompt_id IS NOT NULL;
CREATE INDEX idx_telegram_broadcasts_admin ON telegram_broadcasts(admin_id);
CREATE INDEX idx_payments_consumed_avatar ON payments(consumed_avatar_id) WHERE consumed_avatar_id IS NOT NULL;
```

---

## Foreign Key Map

```
users
  |-- avatars (user_id) CASCADE
  |-- payments (user_id) CASCADE
  |-- referral_codes (user_id) CASCADE
  |-- referral_balances (user_id) CASCADE
  |-- referrals (referrer_id, referred_id)
  |-- referral_earnings (referrer_id, referred_id) CASCADE
  |-- referral_withdrawals (user_id)
  |-- photo_favorites (user_id) CASCADE
  |-- shared_galleries (user_id) CASCADE
  |-- telegram_sessions (user_id) CASCADE
  |-- telegram_link_codes (user_id) CASCADE
  |-- user_identities (user_id) CASCADE
  |-- link_tokens (user_id) CASCADE
  |-- user_cards (user_id) CASCADE
  |-- withdrawals (user_id) RESTRICT
  |-- support_tickets (user_id) SET NULL
  |-- partner_applications (user_id) CASCADE

avatars
  |-- uploaded_photos (avatar_id) CASCADE
  |-- generated_photos (avatar_id) CASCADE
  |-- reference_photos (avatar_id) CASCADE
  |-- generation_jobs (avatar_id) CASCADE
  |-- kie_tasks (avatar_id) CASCADE
  |-- shared_galleries (avatar_id) CASCADE
  |-- payments.consumed_avatar_id
  |-- users.pending_generation_avatar_id SET NULL

payments
  |-- referral_earnings (payment_id) SET NULL
  |-- promo_code_usages (payment_id) SET NULL
  |-- generation_jobs (payment_id) SET NULL

generation_jobs
  |-- kie_tasks (job_id) CASCADE

admin_users
  |-- admin_sessions (admin_id) CASCADE
  |-- admin_activity_log (admin_id)
  |-- saved_prompts (admin_id) SET NULL
  |-- photo_packs (admin_id) SET NULL
  |-- promo_codes (created_by)
  |-- admin_settings (updated_by)
  |-- partner_applications (reviewed_by)

photo_packs
  |-- pack_items (pack_id) CASCADE

saved_prompts
  |-- pack_items (prompt_id) SET NULL

promo_codes
  |-- promo_code_usages (promo_code_id) CASCADE

support_tickets
  |-- support_ticket_messages (ticket_id) CASCADE

user_cards
  |-- withdrawals (card_id)

withdrawals
  |-- withdrawal_logs (withdrawal_id) CASCADE
```

---

## Migration Inconsistencies

### 1. Duplicate Table Definitions
| Table | Migration 1 | Migration 2 | Resolution |
|-------|-------------|-------------|------------|
| referral_codes | 004 (code VARCHAR(12)) | 007 (code VARCHAR(20)) | Uses first due to IF NOT EXISTS |
| referral_balances | 004 | 007 | Uses first |
| referrals | 004 (UNIQUE(referred_id)) | 007 (UNIQUE(referrer_id, referred_id)) | Uses first |
| referral_earnings | 004 | 007 | Uses first |
| referral_withdrawals | 004 (has recipient_name) | 007 (has method) | Uses first |
| partner_applications | 020 | 034 | Different schemas! |

### 2. Column Name Conflicts
| Table | Migration 1 | Migration 2 | Code Uses |
|-------|-------------|-------------|-----------|
| referral_withdrawals | payout_method | method | payout_method |
| referral_earnings | referred_id | referred_user_id | Both exist in code |

### 3. referral_code Location Conflict
- 013_add_referral_code_column.sql adds to `referrals` table
- 020_partner_program.sql adds to `referral_balances` table
- Both are valid but confusing

---

## Recommendations

### Immediate Actions (P0)

1. **Create Missing Indexes**
```sql
-- Run immediately for performance
CREATE INDEX CONCURRENTLY idx_kie_tasks_avatar_id ON kie_tasks(avatar_id);
CREATE INDEX CONCURRENTLY idx_kie_tasks_kie_task_id ON kie_tasks(kie_task_id);
```

2. **Fix TypeScript Types**
Update `lib/db.ts` to include:
- All payment provider columns
- Multi-currency referral fields
- Missing user fields

3. **Add telegram_chat_id Migration**
```sql
-- Migration 038: Add telegram_chat_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
CREATE INDEX idx_users_telegram_chat ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
```

### Short-term Actions (P1)

4. **Consolidate Referral Migrations**
Create a single source-of-truth migration that defines the final referral schema.

5. **Fix Migration Numbering**
Rename duplicate migrations:
- `009_referral_earnings_unique.sql` -> `009a_referral_earnings_unique.sql`
- `009_fix_telegram_constraint.sql` -> `009b_fix_telegram_constraint.sql`

6. **Create Schema Documentation**
Generate schema from production DB and commit as `docs/schema.sql`.

### Long-term Actions (P2)

7. **Remove Deprecated Columns**
```sql
-- In referral_balances, balance/total_earned/total_withdrawn are duplicated
-- by balance_rub/earned_rub/withdrawn_rub
ALTER TABLE referral_balances DROP COLUMN balance;
ALTER TABLE referral_balances DROP COLUMN total_earned;
ALTER TABLE referral_balances DROP COLUMN total_withdrawn;
```

8. **Add Missing FK Indexes**
All FKs listed in "Missing Indexes" section.

9. **Implement Schema Versioning**
Add `schema_migrations` table to track applied migrations.

---

## Appendix: All Tables Summary

| # | Table | PK | Has FK | Indexes | Issues |
|---|-------|----|---------|---------| ------ |
| 1 | users | id | 1 FK | 7 | Missing telegram_chat_id |
| 2 | avatars | id | 1 FK | 4 | OK |
| 3 | uploaded_photos | id | 1 FK | 1 | OK |
| 4 | generated_photos | id | 1 FK | 1 | OK |
| 5 | reference_photos | id | 1 FK | 1 | OK |
| 6 | payments | id | 2 FKs | 5 | Missing provider cols in base |
| 7 | generation_jobs | id | 2 FKs | 6 | OK |
| 8 | kie_tasks | id | 2 FKs | 2 | Missing avatar_id index |
| 9 | photo_favorites | id | 2 FKs | 2 | OK |
| 10 | shared_galleries | id | 2 FKs | 2 | OK |
| 11 | telegram_sessions | id | 1 FK | 2 | OK |
| 12 | telegram_link_codes | id | 1 FK | 2 | OK |
| 13 | telegram_message_queue | id | 0 FKs | 2 | OK |
| 14 | referral_codes | id | 1 FK | 2 | Duplicate def |
| 15 | referrals | id | 2 FKs | 3 | Duplicate def |
| 16 | referral_earnings | id | 3 FKs | 4 | OK |
| 17 | referral_balances | id | 1 FK | 2 | Duplicate cols |
| 18 | referral_withdrawals | id | 1 FK | 2 | Duplicate def |
| 19 | webhook_logs | id | 0 FKs | 3 | OK |
| 20 | admin_actions | id | 0 FKs | 3 | OK |
| 21 | admin_users | id | 0 FKs | 1 | OK |
| 22 | admin_sessions | id | 1 FK | 2 | OK |
| 23 | admin_activity_log | id | 1 FK | 2 | OK |
| 24 | admin_notifications | id | 0 FKs | 1 | OK |
| 25 | saved_prompts | id | 1 FK | 3 | OK |
| 26 | photo_packs | id | 1 FK | 2 | OK |
| 27 | pack_items | id | 2 FKs | 3 | Missing prompt_id index |
| 28 | promo_codes | id | 1 FK | 2 | OK |
| 29 | promo_code_usages | id | 3 FKs | 2 | Missing 3 FK indexes |
| 30 | admin_settings | id | 1 FK | 1 | OK |
| 31 | partner_applications | id | 2 FKs | 2 | Duplicate def in 034 |
| 32 | support_tickets | id | 1 FK | 7 | OK |
| 33 | support_ticket_messages | id | 1 FK | 2 | OK |
| 34 | support_faq_analytics | id | 0 FKs | 0 | OK |
| 35 | support_operators | id | 0 FKs | 0 | OK |
| 36 | support_canned_responses | id | 0 FKs | 0 | OK |
| 37 | support_sla_config | id | 0 FKs | 0 | OK |
| 38 | support_ticket_drafts | telegram_chat_id | 0 FKs | 1 | OK |
| 39 | user_identities | id | 1 FK | 3 | OK |
| 40 | link_tokens | id | 1 FK | 2 | OK |
| 41 | telegram_mtproto_sessions | id | 0 FKs | 0 | OK |
| 42 | telegram_affiliate_settings | id | 0 FKs | 0 | OK |
| 43 | user_cards | id | 1 FK | 2 | OK |
| 44 | withdrawals | id | 2 FKs | 4 | OK |
| 45 | withdrawal_logs | id | 1 FK | 1 | OK |
| 46 | telegram_broadcasts | id | 0 FKs | 1 | Missing admin_id index |
| 47 | qstash_processed_messages | id | 0 FKs | 2 | OK |

---

*Report generated by Database Architect Agent*
*Based on analysis of 37 migration files + base schema*
