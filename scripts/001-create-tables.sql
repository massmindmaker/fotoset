-- Создание таблиц для PinGlass AI

-- Таблица пользователей (без авторизации - по device_id)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    is_pro BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица аватаров (персон)
CREATE TABLE IF NOT EXISTS avatars (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Мой аватар',
    status VARCHAR(50) DEFAULT 'draft', -- draft, processing, ready
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица загруженных фото
CREATE TABLE IF NOT EXISTS uploaded_photos (
    id SERIAL PRIMARY KEY,
    avatar_id INTEGER REFERENCES avatars(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL, -- URL в Vercel Blob или base64
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица сгенерированных фото
CREATE TABLE IF NOT EXISTS generated_photos (
    id SERIAL PRIMARY KEY,
    avatar_id INTEGER REFERENCES avatars(id) ON DELETE CASCADE,
    style_id VARCHAR(50) NOT NULL,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица платежей
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tbank_payment_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'RUB',
    status VARCHAR(50) DEFAULT 'pending', -- pending, succeeded, canceled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица задач генерации
CREATE TABLE IF NOT EXISTS generation_jobs (
    id SERIAL PRIMARY KEY,
    avatar_id INTEGER REFERENCES avatars(id) ON DELETE CASCADE,
    style_id VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    total_photos INTEGER DEFAULT 23,
    completed_photos INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_avatars_user_id ON avatars(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_photos_avatar_id ON uploaded_photos(avatar_id);
CREATE INDEX IF NOT EXISTS idx_generated_photos_avatar_id ON generated_photos(avatar_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_avatar_id ON generation_jobs(avatar_id);
