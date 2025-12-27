-- Kie.ai Tasks Table for async polling architecture
-- This allows us to avoid Cloudflare 100s timeout by:
-- 1. Creating Kie.ai task and returning immediately (~2s)
-- 2. Polling task status via cron every 10s

CREATE TABLE IF NOT EXISTS kie_tasks (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES generation_jobs(id),
  avatar_id INTEGER REFERENCES avatars(id),
  kie_task_id VARCHAR(255) NOT NULL,  -- Kie.ai taskId
  prompt_index INTEGER NOT NULL,       -- Which prompt (0-22)
  prompt TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  result_url TEXT,                      -- Final image URL
  error_message TEXT,
  attempts INTEGER DEFAULT 0,           -- Polling attempts
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient polling
CREATE INDEX IF NOT EXISTS idx_kie_tasks_status ON kie_tasks(status);
CREATE INDEX IF NOT EXISTS idx_kie_tasks_job_id ON kie_tasks(job_id);
