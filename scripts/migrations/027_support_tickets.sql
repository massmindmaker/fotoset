-- Migration 027: Support Tickets System
-- Creates tables for customer support ticketing with 24h SLA

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., TKT-2026-0001

    -- User info
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    telegram_chat_id BIGINT NOT NULL,
    telegram_username VARCHAR(255),
    user_name VARCHAR(255),

    -- Ticket details
    subject VARCHAR(500),
    category VARCHAR(50) DEFAULT 'general', -- payment, generation, technical, feedback
    priority VARCHAR(10) DEFAULT 'P3', -- P1 (critical), P2 (high), P3 (medium), P4 (low)
    status VARCHAR(20) DEFAULT 'open', -- open, in_progress, waiting_user, resolved, closed

    -- SLA tracking
    sla_first_response_at TIMESTAMP, -- deadline for first response
    sla_resolution_at TIMESTAMP, -- deadline for resolution
    first_responded_at TIMESTAMP, -- when operator first responded
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,

    -- Assignment
    assigned_to VARCHAR(100), -- admin username or ID
    assigned_at TIMESTAMP,

    -- Escalation
    escalated BOOLEAN DEFAULT FALSE,
    escalated_at TIMESTAMP,
    escalation_reason TEXT,

    -- Metadata
    source VARCHAR(50) DEFAULT 'telegram', -- telegram, webapp, admin
    tags TEXT[], -- array of tags for categorization

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ticket messages (conversation history)
CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,

    -- Sender info
    sender_type VARCHAR(20) NOT NULL, -- user, operator, system, ai
    sender_id VARCHAR(100), -- telegram_chat_id for users, admin username for operators
    sender_name VARCHAR(255),

    -- Message content
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, photo, document, system_note
    attachments JSONB, -- [{type, url, filename}]

    -- AI assistance
    ai_suggested_response TEXT, -- AI-generated suggestion for operators
    ai_confidence DECIMAL(3,2), -- 0.00 - 1.00

    -- Telegram message tracking
    telegram_message_id BIGINT,

    created_at TIMESTAMP DEFAULT NOW()
);

-- FAQ Analytics (track which questions are asked most)
CREATE TABLE IF NOT EXISTS support_faq_analytics (
    id SERIAL PRIMARY KEY,
    faq_id VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    question TEXT,

    -- Counters
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,

    -- Last accessed
    last_viewed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(faq_id)
);

-- Operator settings
CREATE TABLE IF NOT EXISTS support_operators (
    id SERIAL PRIMARY KEY,
    admin_username VARCHAR(100) UNIQUE NOT NULL,
    telegram_user_id BIGINT,

    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    can_assign BOOLEAN DEFAULT TRUE,
    can_close BOOLEAN DEFAULT TRUE,
    max_open_tickets INTEGER DEFAULT 10,

    -- Stats
    tickets_resolved INTEGER DEFAULT 0,
    avg_response_time_minutes INTEGER,
    avg_resolution_time_minutes INTEGER,
    satisfaction_rating DECIMAL(3,2),

    -- Availability
    is_online BOOLEAN DEFAULT FALSE,
    last_activity_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Canned responses (quick replies for operators)
CREATE TABLE IF NOT EXISTS support_canned_responses (
    id SERIAL PRIMARY KEY,
    shortcut VARCHAR(50) UNIQUE NOT NULL, -- e.g., /greet, /payment_issue
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50),

    -- Usage stats
    use_count INTEGER DEFAULT 0,

    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- SLA Configuration
CREATE TABLE IF NOT EXISTS support_sla_config (
    id SERIAL PRIMARY KEY,
    priority VARCHAR(10) UNIQUE NOT NULL, -- P1, P2, P3, P4

    -- Time limits in minutes
    first_response_minutes INTEGER NOT NULL,
    resolution_minutes INTEGER NOT NULL,

    -- Escalation
    escalation_after_minutes INTEGER,
    escalate_to VARCHAR(100), -- admin username or group

    -- Description
    description TEXT,
    examples TEXT,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default SLA configuration
INSERT INTO support_sla_config (priority, first_response_minutes, resolution_minutes, escalation_after_minutes, description, examples) VALUES
    ('P1', 60, 240, 30, 'Критические проблемы с оплатой', 'Деньги списались, не пришли фото; двойное списание'),
    ('P2', 120, 480, 60, 'Проблемы с генерацией', 'Ошибка генерации; фото не появились; неправильный результат'),
    ('P3', 240, 1440, 180, 'Вопросы по функционалу', 'Как скачать; как работает; вопросы по тарифам'),
    ('P4', 1440, 4320, 720, 'Предложения и отзывы', 'Пожелания; обратная связь; не срочные вопросы')
ON CONFLICT (priority) DO NOTHING;

-- Insert default canned responses
INSERT INTO support_canned_responses (shortcut, title, content, category) VALUES
    ('/greet', 'Приветствие', 'Здравствуйте! Спасибо за обращение в поддержку PinGlass. Чем могу помочь?', 'general'),
    ('/thanks', 'Благодарность', 'Спасибо за обращение! Если возникнут ещё вопросы — обращайтесь.', 'general'),
    ('/payment_check', 'Проверка платежа', 'Проверяю ваш платёж, пожалуйста, подождите несколько минут.', 'payment'),
    ('/payment_found', 'Платёж найден', 'Нашёл ваш платёж! Статус обновлён, можете проверить в приложении.', 'payment'),
    ('/payment_refund', 'Возврат средств', 'Оформляю возврат средств. Деньги вернутся в течение 3-5 рабочих дней.', 'payment'),
    ('/generation_retry', 'Повтор генерации', 'Запускаю повторную генерацию. Результат будет готов через 5-10 минут.', 'generation'),
    ('/generation_queue', 'Очередь генерации', 'Ваша генерация в очереди. Обычно это занимает 5-10 минут.', 'generation'),
    ('/wait', 'Ожидание', 'Мне нужно немного времени для проверки. Ответю в ближайшее время.', 'general')
ON CONFLICT (shortcut) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_telegram_chat ON support_tickets(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_sla ON support_tickets(sla_first_response_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON support_ticket_messages(created_at);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_support_tickets_updated ON support_tickets;
CREATE TRIGGER trigger_support_tickets_updated
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_support_tickets_updated_at();

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    year_part VARCHAR(4);
    seq_num INTEGER;
    ticket_num VARCHAR(20);
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(ticket_number FROM 10 FOR 6) AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM support_tickets
    WHERE ticket_number LIKE 'TKT-' || year_part || '-%';

    ticket_num := 'TKT-' || year_part || '-' || LPAD(seq_num::TEXT, 6, '0');
    RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

-- Add user_rating column to support_tickets if not exists
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS user_rating INTEGER;

-- Ticket drafts (temporary state when creating ticket)
CREATE TABLE IF NOT EXISTS support_ticket_drafts (
    telegram_chat_id BIGINT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Auto-cleanup old drafts
CREATE OR REPLACE FUNCTION cleanup_old_ticket_drafts() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM support_ticket_drafts WHERE created_at < NOW() - INTERVAL '10 minutes';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_ticket_drafts ON support_ticket_drafts;
CREATE TRIGGER trigger_cleanup_ticket_drafts
    AFTER INSERT ON support_ticket_drafts
    EXECUTE FUNCTION cleanup_old_ticket_drafts();

-- Index for drafts cleanup
CREATE INDEX IF NOT EXISTS idx_ticket_drafts_created ON support_ticket_drafts(created_at);

-- Comments
COMMENT ON TABLE support_tickets IS 'Customer support tickets with SLA tracking';
COMMENT ON TABLE support_ticket_messages IS 'Conversation history for each ticket';
COMMENT ON TABLE support_faq_analytics IS 'Track FAQ usage for optimization';
COMMENT ON TABLE support_operators IS 'Operator settings and statistics';
COMMENT ON TABLE support_canned_responses IS 'Quick reply templates for operators';
COMMENT ON TABLE support_sla_config IS 'SLA time limits by priority level';
COMMENT ON TABLE support_ticket_drafts IS 'Temporary draft state when user is creating a ticket via /ticket command';
