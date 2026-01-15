# PinGlass Architecture Overview

## Core Architecture

PinGlass is a Next.js 16 application with App Router architecture for AI photo portrait generation.

### Key Components

1. **Frontend Layer**
   - React 19 with Server Components
   - Single main component: `components/persona-app.tsx` (1059 lines)
   - State machine pattern for view management (ONBOARDING → UPLOAD → STYLE → GENERATING → RESULTS)

2. **API Layer**
   - Next.js API Routes in `app/api/`
   - RESTful design with JSON responses
   - Device ID-based authentication (no passwords)

3. **Background Processing**
   - Async generation via `kie_tasks` table
   - QStash + Vercel Cron for polling
   - Fire-and-forget pattern to avoid Cloudflare 100s timeout

4. **Storage**
   - Neon PostgreSQL (serverless) for data
   - Cloudflare R2 for generated images

## Critical Anti-Patterns

```typescript
// ❌ NEVER use synchronous generation
await generateAndWait(prompt) // Cloudflare 100s timeout!

// ✅ ALWAYS use async task pattern
createKieTask() + cron polling via kie_tasks table
```

```sql
-- ❌ NO user statuses exist (Free/Pro)
-- Access = successful payment exists
SELECT COUNT(*) FROM payments WHERE user_id=? AND status='succeeded'
```

## Relations
@structure/api/endpoints
@code_style/patterns/async-generation
@testing/strategies/api-testing
