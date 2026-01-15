# AI Photo Generation System

## Overview

PinGlass generates 23 unique AI portraits per session using reference photos uploaded by the user.

## Generation Pipeline

```
User Photos (5-8) → Style Selection → Kie.ai Tasks → Cron Polling → Results Gallery
```

## Style Presets

### Professional
- Business portraits for LinkedIn, resumes
- Clean corporate backgrounds
- Prompt indices: 3, 4, 11, 6, 18, 21, 0, 19, 7

### Lifestyle
- Casual photos for social media
- Natural locations (cafes, parks, streets)
- Prompt indices: 0, 1, 2, 5, 8, 12, 15, 20, 22

### Creative
- Artistic portraits for portfolios
- Creative lighting and composition
- Prompt indices: 7, 9, 10, 13, 14, 16, 17, 19, 21

## Async Architecture (Critical!)

```typescript
// ❌ NEVER do synchronous generation
await generateAndWait(prompt); // Cloudflare 100s timeout!

// ✅ ALWAYS use fire-and-forget + polling
// Step 1: Create task
const task = await db.query(`
  INSERT INTO kie_tasks (job_id, kie_task_id, prompt_index, status)
  VALUES ($1, $2, $3, 'pending')
`, [jobId, kieTaskId, promptIndex]);

// Step 2: Fire request (don't await)
kieApi.createTask(prompt).catch(console.error);

// Step 3: Cron polls every minute
// GET /api/cron/check-kie-tasks
```

## Database Tables

```sql
-- Generation jobs
CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  avatar_id INTEGER REFERENCES avatars(id),
  style_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'processing',
  photos_completed INTEGER DEFAULT 0,
  photos_total INTEGER DEFAULT 23,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Individual AI tasks
CREATE TABLE kie_tasks (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES generation_jobs(id),
  kie_task_id VARCHAR(255) NOT NULL,
  prompt_index INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  result_url TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Fallback Strategy

1. Primary: Kie.ai
2. Fallback: Replicate API
3. On failure: Skip photo, continue with remaining

## Relations
@structure/architecture
@code_style/patterns/async-generation
@testing/strategies/integration-testing
