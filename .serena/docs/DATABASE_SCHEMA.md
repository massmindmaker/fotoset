# Fotoset Database Schema

## Database: Neon PostgreSQL (Serverless)

Connection: `@neondatabase/serverless`

---

## Core Tables

### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  telegram_user_id INTEGER UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_device_id ON users(device_id);
```

### avatars
```sql
CREATE TABLE avatars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) DEFAULT 'My Avatar',
  status VARCHAR(20) DEFAULT 'draft', -- draft, processing, ready
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_avatars_user_id ON avatars(user_id);
```

### reference_photos
```sql
CREATE TABLE reference_photos (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### generated_photos
```sql
CREATE TABLE generated_photos (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  style_id VARCHAR(50) NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_generated_photos_avatar_id ON generated_photos(avatar_id);
```

### generation_jobs
```sql
CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  style_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  total_photos INTEGER DEFAULT 23,
  completed_photos INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### payments
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  yookassa_payment_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RUB',
  status VARCHAR(20) DEFAULT 'pending', -- pending, succeeded, canceled
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Referral Tables

### referral_codes
```sql
CREATE TABLE referral_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### referrals
```sql
CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES users(id),
  referred_id INTEGER NOT NULL REFERENCES users(id),
  referral_code VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### referral_balances
```sql
CREATE TABLE referral_balances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  balance DECIMAL(10, 2) DEFAULT 0,
  total_earned DECIMAL(10, 2) DEFAULT 0,
  total_withdrawn DECIMAL(10, 2) DEFAULT 0,
  referrals_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### referral_withdrawals
```sql
CREATE TABLE referral_withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount DECIMAL(10, 2) NOT NULL,
  ndfl_amount DECIMAL(10, 2) NOT NULL,      -- 13% tax
  payout_amount DECIMAL(10, 2) NOT NULL,    -- amount - ndfl
  status VARCHAR(20) DEFAULT 'pending',     -- pending, processing, completed, rejected
  payout_method VARCHAR(10) NOT NULL,       -- card, sbp
  card_number VARCHAR(20),
  phone VARCHAR(20),
  recipient_name VARCHAR(255) NOT NULL,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Entity Relationships

```
users (1) ──────(N) avatars
  │                   │
  │                   ├──(N) generated_photos
  │                   ├──(N) reference_photos
  │                   └──(N) generation_jobs
  │
  ├──(N) payments
  │
  └──(N) referral_codes
           │
           └── referrals → referral_balances → referral_withdrawals
```

---

## TypeScript Types

```typescript
type User = {
  id: number
  device_id: string
  telegram_user_id?: number
  created_at: string
  updated_at: string
}

type Avatar = {
  id: number
  user_id: number
  name: string
  status: 'draft' | 'processing' | 'ready'
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

type GeneratedPhoto = {
  id: number
  avatar_id: number
  style_id: string
  prompt: string
  image_url: string
  created_at: string
}

type Payment = {
  id: number
  user_id: number
  yookassa_payment_id: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'canceled'
  created_at: string
  updated_at: string
}
```
