# PinGlass Database Migrations

Complete history of database schema changes.

---

## Migration Strategy

- **Tool:** Manual SQL scripts in `scripts/migrations/`
- **Naming:** `{number}_{description}.sql`
- **Execution:** Via `psql` or `run-migration.mjs` script
- **Rollback:** Manual (SQL scripts not reversible)
- **Testing:** Always test on local DB first

---

## Migration History

### 014_remove_device_id.sql (December 19, 2024) ⚠️ BREAKING CHANGE

**Status:** ✅ Deployed to production

**Purpose:** Migrate from device_id to Telegram-only authentication

**Changes:**
```sql
-- Remove device_id column from users table
ALTER TABLE users DROP COLUMN IF EXISTS device_id;

-- Set telegram_user_id as NOT NULL
ALTER TABLE users ALTER COLUMN telegram_user_id SET NOT NULL;

-- Add unique constraint on telegram_user_id
ALTER TABLE users ADD CONSTRAINT users_telegram_user_id_unique
  UNIQUE (telegram_user_id);

-- Drop device_id index if exists
DROP INDEX IF EXISTS idx_users_device_id;
```

**Breaking Changes:**
- ❌ `device_id` column removed
- ❌ API endpoints no longer accept `device_id` parameter
- ❌ `deviceId` removed from frontend `UserIdentifier` type
- ✅ `telegram_user_id` is now required (NOT NULL)
- ✅ Only Telegram Mini App authentication supported

**Frontend Changes:**
```typescript
// BEFORE (v1.x)
interface UserIdentifier {
  type: "telegram" | "device"
  telegramUserId?: number
  deviceId?: string
}

// AFTER (v2.0)
interface UserIdentifier {
  type: "telegram"
  telegramUserId: number  // Required
}
```

**Migration Steps:**
1. ✅ Backup database
2. ✅ Run SQL migration
3. ✅ Update backend code (10 files)
4. ✅ Update frontend code (3 files)
5. ✅ Deploy to Vercel
6. ✅ Test Telegram authentication
7. ✅ Verify payment flow

**Rollback:** Not recommended (data loss). To rollback:
```sql
-- Re-add device_id column
ALTER TABLE users ADD COLUMN device_id VARCHAR(255);

-- Populate from telegram_user_id
UPDATE users SET device_id = 'tg_' || telegram_user_id;

-- Add unique constraint
ALTER TABLE users ADD CONSTRAINT users_device_id_key UNIQUE (device_id);
```

**Impact:** All existing users continue working (telegram_user_id preserved)

**Testing Results:**
- ✅ Payment creation: Success (Payment ID: 7586227553)
- ✅ Avatar fetching: Success (50 avatars retrieved)
- ✅ Payment status check: Success
- ✅ Frontend authentication: Fixed (getInitialIdentifier bug)

---

### 013_add_generation_jobs.sql (December 15, 2024)

**Purpose:** Track background photo generation jobs

**Changes:**
```sql
CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id) ON DELETE CASCADE,
  style_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'processing',
  total_photos INTEGER DEFAULT 23,
  completed_photos INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_generation_jobs_avatar_id ON generation_jobs(avatar_id);
CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
```

**Purpose:** Enable progress tracking for long-running AI generation tasks

---

### 012_add_payments_table.sql (December 10, 2024)

**Purpose:** Add payment tracking for Pro subscriptions

**Changes:**
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tbank_payment_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RUB',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_tbank_payment_id ON payments(tbank_payment_id);
CREATE INDEX idx_payments_status ON payments(status);
```

**Purpose:** Track T-Bank payment transactions

---

### 011_add_telegram_user_id.sql (December 8, 2024)

**Purpose:** Add Telegram authentication support

**Changes:**
```sql
ALTER TABLE users ADD COLUMN telegram_user_id BIGINT;
ALTER TABLE users ADD CONSTRAINT users_telegram_user_id_unique
  UNIQUE (telegram_user_id);

CREATE INDEX idx_users_telegram_user_id ON users(telegram_user_id);
```

**Purpose:** Prepare for Telegram Mini App authentication (dual auth with device_id)

---

### 010_add_avatar_thumbnail.sql (December 5, 2024)

**Purpose:** Add thumbnail URLs for avatar gallery

**Changes:**
```sql
ALTER TABLE avatars ADD COLUMN thumbnail_url TEXT;
```

**Purpose:** Cache first generated photo as thumbnail for dashboard

---

### 009_add_generated_photos_prompt.sql (December 3, 2024)

**Purpose:** Store prompt used for each generated photo

**Changes:**
```sql
ALTER TABLE generated_photos ADD COLUMN prompt TEXT;
```

**Purpose:** Track which prompt generated each photo for debugging

---

### 008_add_avatar_status.sql (December 1, 2024)

**Purpose:** Track avatar processing status

**Changes:**
```sql
ALTER TABLE avatars ADD COLUMN status VARCHAR(20) DEFAULT 'draft';
-- Values: 'draft', 'processing', 'ready', 'failed'
```

**Purpose:** Show processing state in UI

---

### 007_add_is_pro.sql (November 28, 2024) [DEPRECATED]

**Purpose:** Add Pro subscription flag (DEPRECATED - column removed, use payments table instead)

**Changes:**
```sql
-- DEPRECATED: is_pro column removed
-- Pro status is now derived from successful payments:
-- SELECT EXISTS(SELECT 1 FROM payments WHERE user_id=? AND status='succeeded') as has_paid
```

**Note:** Pro status is determined by having a successful payment, not by a flag

---

### 006_add_style_id.sql (November 25, 2024)

**Purpose:** Track which style was used for generation

**Changes:**
```sql
ALTER TABLE generated_photos ADD COLUMN style_id VARCHAR(50);
-- Values: 'professional', 'lifestyle', 'creative'
```

**Purpose:** Allow multiple style generations per avatar

---

### 005_add_avatars_name.sql (November 22, 2024)

**Purpose:** Allow users to name their avatars

**Changes:**
```sql
ALTER TABLE avatars ADD COLUMN name VARCHAR(255) DEFAULT 'Мой аватар';
```

**Purpose:** Better UX with custom avatar names

---

### 004_create_generated_photos.sql (November 20, 2024)

**Purpose:** Store generated AI photos

**Changes:**
```sql
CREATE TABLE generated_photos (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_generated_photos_avatar_id ON generated_photos(avatar_id);
```

**Purpose:** Store 23 photos per avatar

---

### 003_create_avatars.sql (November 18, 2024)

**Purpose:** Create avatars (personas) table

**Changes:**
```sql
CREATE TABLE avatars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_avatars_user_id ON avatars(user_id);
```

**Purpose:** Support multiple personas per user

---

### 002_add_timestamps.sql (November 15, 2024)

**Purpose:** Add created_at/updated_at to users

**Changes:**
```sql
ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
```

**Purpose:** Track user registration date

---

### 001_initial_schema.sql (November 12, 2024)

**Purpose:** Create initial users table

**Changes:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL
);

CREATE INDEX idx_users_device_id ON users(device_id);
```

**Purpose:** Basic user identity via device fingerprinting

---

## Migration Commands

### Run Single Migration

```bash
# Using psql
psql $DATABASE_URL -f scripts/migrations/014_remove_device_id.sql

# Using node script
node scripts/run-migration.mjs scripts/migrations/014_remove_device_id.sql
```

### Run All Migrations

```bash
# Bash
for file in scripts/migrations/*.sql; do
  psql $DATABASE_URL -f "$file"
done

# PowerShell
Get-ChildItem scripts/migrations/*.sql | ForEach-Object {
  psql $env:DATABASE_URL -f $_.FullName
}
```

### Check Migration Status

```sql
-- List all tables
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check users table structure
\d users

-- Verify constraints
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'users'::regclass;
```

---

## Best Practices

### Before Running Migration

1. ✅ Backup database
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

2. ✅ Test on local database first
   ```bash
   psql $LOCAL_DATABASE_URL -f migration.sql
   ```

3. ✅ Review SQL for destructive operations
   - `DROP TABLE`
   - `DROP COLUMN`
   - `ALTER COLUMN ... DROP DEFAULT`

4. ✅ Check for foreign key constraints
   ```sql
   SELECT * FROM information_schema.table_constraints
   WHERE constraint_type = 'FOREIGN KEY';
   ```

### After Running Migration

1. ✅ Verify schema changes
   ```sql
   \d users  -- Check table structure
   ```

2. ✅ Test critical queries
   ```sql
   SELECT * FROM users LIMIT 1;
   SELECT * FROM avatars WHERE user_id = 1;
   ```

3. ✅ Run application tests
   ```bash
   pnpm test  # (if tests exist)
   ```

4. ✅ Monitor production logs
   - Check Vercel function logs
   - Check database slow queries

### Rollback Strategy

- Always have SQL rollback script ready
- Document breaking changes in migration file
- Consider gradual rollout:
  1. Add new columns (keep old)
  2. Deploy code supporting both schemas
  3. Migrate data
  4. Remove old columns

---

## Common Issues

### Issue: Foreign Key Violation

**Error:**
```
ERROR: update or delete on table "users" violates foreign key constraint
```

**Solution:**
```sql
-- Find referencing tables
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE confrelid = 'users'::regclass;

-- Add ON DELETE CASCADE if needed
ALTER TABLE avatars DROP CONSTRAINT avatars_user_id_fkey;
ALTER TABLE avatars ADD CONSTRAINT avatars_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

### Issue: Column Already Exists

**Error:**
```
ERROR: column "telegram_user_id" of relation "users" already exists
```

**Solution:**
```sql
-- Check if column exists first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'telegram_user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN telegram_user_id BIGINT;
  END IF;
END
$$;
```

### Issue: Index Already Exists

**Error:**
```
ERROR: relation "idx_users_telegram_user_id" already exists
```

**Solution:**
```sql
-- Drop and recreate
DROP INDEX IF EXISTS idx_users_telegram_user_id;
CREATE INDEX idx_users_telegram_user_id ON users(telegram_user_id);
```

---

## Future Migrations (Planned)

### 015_add_referral_system.sql (Planned)

**Purpose:** Add referral tracking

**Planned Changes:**
```sql
ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN referred_by INTEGER REFERENCES users(id);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);
```

### 016_add_photo_ratings.sql (Planned)

**Purpose:** Let users rate generated photos

**Planned Changes:**
```sql
ALTER TABLE generated_photos ADD COLUMN user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5);
CREATE INDEX idx_generated_photos_rating ON generated_photos(user_rating);
```

---

**Last Updated:** December 19, 2024
**Total Migrations:** 14
**Current Schema Version:** 2.0 (Telegram-only)
