# PinGlass Database Schema

**Database:** Neon PostgreSQL (Serverless)
**Last Updated:** 2026-01-05

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ avatars : has
    users ||--o{ payments : makes
    users ||--o{ referral_balances : has
    users ||--o{ partner_applications : submits

    avatars ||--o{ reference_photos : contains
    avatars ||--o{ generated_photos : produces
    avatars ||--o{ generation_jobs : has

    generation_jobs ||--o{ kie_tasks : creates
    payments ||--o| generation_jobs : funds

    referral_balances ||--o{ referral_earnings : earns
    referral_balances ||--o{ withdrawal_requests : requests

    support_tickets ||--o{ ticket_messages : has

    users {
        int id PK
        bigint telegram_user_id UK
        varchar telegram_username
        varchar device_id
        varchar referral_code_used
        boolean is_banned
        timestamp created_at
    }

    avatars {
        int id PK
        int user_id FK
        varchar name
        varchar status
        text thumbnail_url
        timestamp created_at
    }

    payments {
        int id PK
        int user_id FK
        varchar payment_id UK
        varchar provider
        decimal amount
        varchar status
        varchar tier_id
        int photo_count
        boolean generation_consumed
        int consumed_avatar_id
        timestamp created_at
    }

    generation_jobs {
        int id PK
        int avatar_id FK
        int payment_id FK
        varchar style_id
        varchar status
        int total_photos
        int completed_photos
        text error_message
        timestamp created_at
    }

    kie_tasks {
        int id PK
        int job_id FK
        int avatar_id FK
        varchar kie_task_id
        text prompt
        int prompt_index
        varchar status
        text result_url
        int attempts
        timestamp created_at
    }

    generated_photos {
        int id PK
        int avatar_id FK
        varchar style_id
        text prompt
        text image_url
        timestamp created_at
    }

    reference_photos {
        int id PK
        int avatar_id FK
        text image_url
        timestamp created_at
    }

    referral_balances {
        int id PK
        int user_id FK UK
        varchar referral_code UK
        decimal balance
        int referrals_count
        decimal total_earned
        boolean is_partner
        decimal commission_rate
        timestamp created_at
    }
```

## Core Tables

### users
Main user table. Authentication via Telegram.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| telegram_user_id | BIGINT | Telegram user ID (unique) |
| telegram_username | VARCHAR(255) | Telegram @username |
| device_id | VARCHAR(255) | Legacy device identifier |
| referral_code_used | VARCHAR(20) | Referral code used at signup |
| is_banned | BOOLEAN | User ban status |
| banned_at | TIMESTAMP | When banned |
| ban_reason | TEXT | Reason for ban |
| created_at | TIMESTAMP | Registration date |

**Important:** No `is_pro` column! Pro status is derived from payments.

```sql
-- Check if user is Pro
SELECT EXISTS (
  SELECT 1 FROM payments
  WHERE user_id = ? AND status = 'succeeded'
) AS is_pro;
```

### avatars
User's avatar collections (each can generate photos).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK to users |
| name | VARCHAR(255) | Avatar name |
| status | VARCHAR(20) | draft/processing/ready |
| thumbnail_url | TEXT | Avatar thumbnail |
| created_at | TIMESTAMP | Creation date |

### payments
Multi-provider payment records.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK to users |
| payment_id | VARCHAR(255) | External payment ID |
| provider | VARCHAR(20) | tbank/stars/ton |
| amount | DECIMAL(10,2) | Amount in RUB |
| status | VARCHAR(20) | pending/succeeded/canceled/refunded |
| tier_id | VARCHAR(20) | starter/standard/premium |
| photo_count | INTEGER | Photos purchased |
| generation_consumed | BOOLEAN | Used for generation |
| consumed_at | TIMESTAMP | When consumed |
| consumed_avatar_id | INTEGER | Which avatar used it |
| telegram_charge_id | VARCHAR(255) | Telegram Stars charge ID |
| stars_amount | INTEGER | Stars amount |
| ton_tx_hash | CHAR(64) | TON transaction hash |
| ton_amount | DECIMAL(20,9) | TON amount |
| created_at | TIMESTAMP | Payment date |

### generation_jobs
Photo generation job tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| avatar_id | INTEGER | FK to avatars |
| payment_id | INTEGER | FK to payments |
| style_id | VARCHAR(50) | professional/lifestyle/creative |
| status | VARCHAR(20) | pending/processing/completed/failed |
| total_photos | INTEGER | Target photo count |
| completed_photos | INTEGER | Completed count |
| error_message | TEXT | Error details if failed |
| created_at | TIMESTAMP | Job start time |

### kie_tasks
Kie.ai async task tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| job_id | INTEGER | FK to generation_jobs |
| avatar_id | INTEGER | FK to avatars |
| kie_task_id | VARCHAR(255) | Kie.ai task UUID |
| prompt | TEXT | Generation prompt |
| prompt_index | INTEGER | Prompt position (0-22) |
| style_id | VARCHAR(50) | Style used |
| status | VARCHAR(20) | pending/completed/failed |
| result_url | TEXT | Generated image URL |
| attempts | INTEGER | Polling attempts |
| max_attempts | INTEGER | Max retry limit |
| created_at | TIMESTAMP | Task creation |

### generated_photos
Final generated photos.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| avatar_id | INTEGER | FK to avatars |
| style_id | VARCHAR(50) | Style used |
| prompt | TEXT | Full prompt used |
| image_url | TEXT | R2/CDN URL |
| created_at | TIMESTAMP | Generation date |

### reference_photos
User uploaded reference photos.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| avatar_id | INTEGER | FK to avatars |
| image_url | TEXT | R2 URL |
| created_at | TIMESTAMP | Upload date |

## Referral System Tables

### referral_balances
Referral program balance tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK to users (unique) |
| referral_code | VARCHAR(20) | User's unique code |
| balance | DECIMAL(10,2) | Available balance RUB |
| referrals_count | INTEGER | Total referrals |
| total_earned | DECIMAL(10,2) | Lifetime earnings |
| is_partner | BOOLEAN | Partner program member |
| commission_rate | DECIMAL(3,2) | 0.10 (10%) or 0.50 (50%) |
| partner_approved_at | TIMESTAMP | Partner approval date |
| created_at | TIMESTAMP | Record creation |

### referral_earnings
Individual earning records.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| referrer_user_id | INTEGER | FK to users |
| referred_user_id | INTEGER | FK to users |
| payment_id | INTEGER | FK to payments |
| amount | DECIMAL(10,2) | Earned amount |
| commission_rate | DECIMAL(3,2) | Rate at time |
| status | VARCHAR(20) | pending/credited |
| created_at | TIMESTAMP | Earning date |

### withdrawal_requests
Balance withdrawal requests.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK to users |
| amount | DECIMAL(10,2) | Withdrawal amount |
| method | VARCHAR(50) | card/bank/wallet |
| details | JSONB | Payment details |
| status | VARCHAR(20) | pending/approved/rejected/completed |
| processed_by | INTEGER | Admin who processed |
| processed_at | TIMESTAMP | Processing date |
| created_at | TIMESTAMP | Request date |

### partner_applications
Partner program applications.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK to users |
| contact_name | VARCHAR(255) | Full name |
| contact_email | VARCHAR(255) | Email |
| telegram_username | VARCHAR(255) | Telegram handle |
| audience_size | VARCHAR(50) | small/medium/large |
| promotion_channels | TEXT[] | instagram/youtube/etc |
| status | VARCHAR(20) | pending/approved/rejected |
| reviewed_by | INTEGER | Admin ID |
| created_at | TIMESTAMP | Application date |

## Support System Tables

### support_tickets
Customer support tickets.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| ticket_number | VARCHAR(20) | TKT-YYYY-NNN format |
| user_id | INTEGER | FK to users |
| telegram_chat_id | BIGINT | Telegram chat |
| subject | VARCHAR(255) | Ticket subject |
| category | VARCHAR(50) | payment/technical/account |
| priority | VARCHAR(10) | P1/P2/P3/P4 |
| status | VARCHAR(20) | open/in_progress/resolved/closed |
| assigned_to | VARCHAR(255) | Operator username |
| escalated | BOOLEAN | Escalation flag |
| sla_first_response_at | TIMESTAMP | SLA deadline |
| first_responded_at | TIMESTAMP | Actual response |
| created_at | TIMESTAMP | Ticket creation |

### ticket_messages
Ticket conversation messages.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| ticket_id | INTEGER | FK to support_tickets |
| sender_type | VARCHAR(20) | user/operator/system |
| sender_id | VARCHAR(255) | Sender identifier |
| sender_name | VARCHAR(255) | Display name |
| message | TEXT | Message content |
| message_type | VARCHAR(20) | text/system_note |
| telegram_message_id | INTEGER | Telegram msg ID |
| created_at | TIMESTAMP | Message time |

## Admin Tables

### admin_users
Admin panel users.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| username | VARCHAR(255) | Login username |
| password_hash | VARCHAR(255) | bcrypt hash |
| role | VARCHAR(20) | admin/operator/viewer |
| created_at | TIMESTAMP | Account creation |

### admin_audit_log
Admin action audit trail.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| admin_id | INTEGER | FK to admin_users |
| action | VARCHAR(100) | Action performed |
| target_type | VARCHAR(50) | user/payment/ticket |
| target_id | INTEGER | Target record ID |
| metadata | JSONB | Additional data |
| created_at | TIMESTAMP | Action time |

### pricing_tiers
Dynamic pricing configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(20) | starter/standard/premium |
| name | VARCHAR(100) | Display name |
| price | DECIMAL(10,2) | Price in RUB |
| photo_count | INTEGER | Photos included |
| is_popular | BOOLEAN | "Popular" badge |
| is_active | BOOLEAN | Available for purchase |
| sort_order | INTEGER | Display order |
| updated_at | TIMESTAMP | Last update |

### custom_prompts
Admin-managed generation prompts.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| prompt_key | VARCHAR(50) | Unique key |
| prompt_text | TEXT | Prompt content |
| style_category | VARCHAR(50) | Style grouping |
| is_active | BOOLEAN | Enabled flag |
| created_at | TIMESTAMP | Creation date |

## Indexes

```sql
-- Users
CREATE UNIQUE INDEX idx_users_telegram ON users(telegram_user_id);
CREATE INDEX idx_users_device ON users(device_id);

-- Payments
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_consumed ON payments(user_id, generation_consumed)
  WHERE generation_consumed = FALSE;

-- Generation
CREATE INDEX idx_jobs_avatar ON generation_jobs(avatar_id);
CREATE INDEX idx_jobs_status ON generation_jobs(status);
CREATE INDEX idx_kie_tasks_status ON kie_tasks(status);
CREATE INDEX idx_kie_tasks_job ON kie_tasks(job_id);

-- Photos
CREATE INDEX idx_photos_avatar ON generated_photos(avatar_id);
CREATE INDEX idx_refs_avatar ON reference_photos(avatar_id);

-- Referrals
CREATE UNIQUE INDEX idx_referral_user ON referral_balances(user_id);
CREATE UNIQUE INDEX idx_referral_code ON referral_balances(referral_code);
```

## Migrations

Migrations are in `scripts/migrations/` directory:
- Files named `001.sql` through `029.sql`
- Run with `node scripts/run-migration.mjs`

## Common Queries

### Get user with Pro status
```sql
SELECT
  u.*,
  EXISTS (
    SELECT 1 FROM payments p
    WHERE p.user_id = u.id AND p.status = 'succeeded'
  ) AS is_pro
FROM users u
WHERE u.telegram_user_id = $1;
```

### Get available payment for generation
```sql
SELECT id, amount, tier_id, photo_count
FROM payments
WHERE user_id = $1
  AND status = 'succeeded'
  AND COALESCE(generation_consumed, FALSE) = FALSE
  AND COALESCE(provider, 'tbank') = $2
ORDER BY created_at DESC
LIMIT 1;
```

### Get generation progress
```sql
SELECT
  j.id,
  j.status,
  j.total_photos,
  j.completed_photos,
  COUNT(gp.id) AS actual_photos
FROM generation_jobs j
LEFT JOIN generated_photos gp ON gp.avatar_id = j.avatar_id
WHERE j.id = $1
GROUP BY j.id;
```

### Get referral stats
```sql
SELECT
  rb.referral_code,
  rb.balance,
  rb.referrals_count,
  rb.total_earned,
  rb.commission_rate,
  rb.is_partner
FROM referral_balances rb
WHERE rb.user_id = $1;
```
