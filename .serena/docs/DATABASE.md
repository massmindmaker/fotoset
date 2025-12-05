# Database Schema

## Overview

PinGlass uses **Neon PostgreSQL** (serverless) for data persistence.

**Connection:** Via `@neondatabase/serverless` package

**Client:** `lib/db.ts`

---

## Tables

### users

Stores user information and Pro subscription status.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  is_pro BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_users_device_id ON users(device_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| device_id | VARCHAR(255) | UNIQUE, NOT NULL | Browser UUID |
| is_pro | BOOLEAN | DEFAULT FALSE | Pro subscription status |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

---

### avatars

Stores user personas/avatars and their generation status.

```sql
CREATE TABLE avatars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255) DEFAULT 'Мой аватар',
  status VARCHAR(20) DEFAULT 'draft',
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_avatars_user_id ON avatars(user_id);
CREATE INDEX idx_avatars_status ON avatars(status);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| user_id | INTEGER | FOREIGN KEY | Reference to users.id |
| name | VARCHAR(255) | DEFAULT 'Мой аватар' | Avatar display name |
| status | VARCHAR(20) | DEFAULT 'draft' | Generation status |
| thumbnail_url | TEXT | | Preview image URL |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Status Values:**
- `draft` - Created, not yet processed
- `processing` - Generation in progress
- `ready` - Generation complete

---

### generated_photos

Stores AI-generated photos.

```sql
CREATE TABLE generated_photos (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id),
  style_id VARCHAR(50),
  prompt TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_generated_photos_avatar_id ON generated_photos(avatar_id);
CREATE INDEX idx_generated_photos_style_id ON generated_photos(style_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| avatar_id | INTEGER | FOREIGN KEY | Reference to avatars.id |
| style_id | VARCHAR(50) | | Style used for generation |
| prompt | TEXT | | Full prompt used |
| image_url | TEXT | | Generated image URL/data |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

---

### payments

Stores payment records.

```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  yookassa_payment_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'RUB',
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_id ON payments(yookassa_payment_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| user_id | INTEGER | FOREIGN KEY | Reference to users.id |
| yookassa_payment_id | VARCHAR(255) | | External payment ID |
| amount | DECIMAL(10,2) | | Payment amount |
| currency | VARCHAR(3) | DEFAULT 'RUB' | Currency code |
| status | VARCHAR(20) | | Payment status |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Status Values:**
- `pending` - Payment initiated
- `succeeded` - Payment completed
- `canceled` - Payment canceled/failed

---

### generation_jobs

Tracks photo generation progress.

```sql
CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id),
  style_id VARCHAR(50),
  status VARCHAR(20),
  total_photos INTEGER DEFAULT 23,
  completed_photos INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_generation_jobs_avatar_id ON generation_jobs(avatar_id);
CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| avatar_id | INTEGER | FOREIGN KEY | Reference to avatars.id |
| style_id | VARCHAR(50) | | Selected style |
| status | VARCHAR(20) | | Job status |
| total_photos | INTEGER | DEFAULT 23 | Total photos to generate |
| completed_photos | INTEGER | DEFAULT 0 | Photos generated so far |
| error_message | TEXT | | Error details if failed |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Status Values:**
- `processing` - Generation in progress
- `completed` - All photos generated
- `failed` - Generation failed

---

## Entity Relationships

```
┌───────────┐       ┌───────────┐       ┌──────────────────┐
│   users   │───┬──▶│  avatars  │───┬──▶│ generated_photos │
└───────────┘   │   └───────────┘   │   └──────────────────┘
                │                   │
                │                   └──▶┌──────────────────┐
                │                       │ generation_jobs  │
                │                       └──────────────────┘
                │
                └──▶┌───────────┐
                    │ payments  │
                    └───────────┘
```

**Relationships:**
- `users` 1:N `avatars` - One user can have multiple personas
- `users` 1:N `payments` - One user can have multiple payments
- `avatars` 1:N `generated_photos` - One avatar has many photos
- `avatars` 1:N `generation_jobs` - One avatar can have multiple jobs

---

## TypeScript Types

```typescript
// lib/db.ts

export interface User {
  id: number
  device_id: string
  is_pro: boolean
  created_at: Date
  updated_at: Date
}

export interface Avatar {
  id: number
  user_id: number
  name: string
  status: 'draft' | 'processing' | 'ready'
  thumbnail_url: string | null
  created_at: Date
  updated_at: Date
}

export interface GeneratedPhoto {
  id: number
  avatar_id: number
  style_id: string
  prompt: string
  image_url: string
  created_at: Date
}

export interface Payment {
  id: number
  user_id: number
  yookassa_payment_id: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'canceled'
  created_at: Date
  updated_at: Date
}

export interface GenerationJob {
  id: number
  avatar_id: number
  style_id: string
  status: 'processing' | 'completed' | 'failed'
  total_photos: number
  completed_photos: number
  error_message: string | null
  created_at: Date
  updated_at: Date
}
```

---

## Common Queries

### Get or Create User

```sql
-- Check if user exists
SELECT * FROM users WHERE device_id = $1;

-- Create new user
INSERT INTO users (device_id) VALUES ($1) RETURNING *;
```

### Update Pro Status

```sql
UPDATE users
SET is_pro = TRUE, updated_at = NOW()
WHERE device_id = $1;
```

### Create Avatar

```sql
INSERT INTO avatars (user_id, name, status)
VALUES ($1, $2, 'draft')
RETURNING *;
```

### Save Generated Photo

```sql
INSERT INTO generated_photos (avatar_id, style_id, prompt, image_url)
VALUES ($1, $2, $3, $4)
RETURNING id;
```

### Get User Photos

```sql
SELECT gp.*
FROM generated_photos gp
JOIN avatars a ON gp.avatar_id = a.id
JOIN users u ON a.user_id = u.id
WHERE u.device_id = $1
ORDER BY gp.created_at DESC;
```

### Update Generation Job Progress

```sql
UPDATE generation_jobs
SET completed_photos = completed_photos + 1,
    updated_at = NOW()
WHERE id = $1;
```

---

## Migration Scripts

### Initial Setup

```sql
-- Create all tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  is_pro BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE avatars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255) DEFAULT 'Мой аватар',
  status VARCHAR(20) DEFAULT 'draft',
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE generated_photos (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id),
  style_id VARCHAR(50),
  prompt TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  yookassa_payment_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'RUB',
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id),
  style_id VARCHAR(50),
  status VARCHAR(20),
  total_photos INTEGER DEFAULT 23,
  completed_photos INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_avatars_user_id ON avatars(user_id);
CREATE INDEX idx_generated_photos_avatar_id ON generated_photos(avatar_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_generation_jobs_avatar_id ON generation_jobs(avatar_id);
```

---

## Neon PostgreSQL Notes

- **Connection pooling** handled automatically
- **Serverless** - scales to zero when idle
- **WebSocket support** for real-time connections
- Use `neon()` function for queries (not Pool)
