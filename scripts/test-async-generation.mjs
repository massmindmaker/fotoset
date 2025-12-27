#!/usr/bin/env node

// E2E Test for async Kie.ai generation
// Usage: node scripts/test-async-generation.mjs

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://fotoset.vercel.app';

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function testGeneration() {
  console.log('=== E2E Test: Async Kie.ai Generation ===\n');

  // 1. Get reference images from avatar 9
  const refs = await sql`
    SELECT image_url FROM reference_photos WHERE avatar_id = 9 LIMIT 4
  `;
  console.log(`Found ${refs.length} reference images for avatar 9`);

  if (refs.length === 0) {
    console.error('No reference images found!');
    process.exit(1);
  }

  // 2. Create a test generation job
  const jobResult = await sql`
    INSERT INTO generation_jobs (avatar_id, style_id, status, total_photos)
    VALUES (9, 'test-async', 'pending', 1)
    RETURNING id
  `;
  const jobId = jobResult[0].id;
  console.log(`Created test job: ${jobId}`);

  // 3. Call the jobs/process endpoint via HTTP (simulating QStash)
  // In dev we skip QStash signature verification
  const payload = {
    jobId,
    avatarId: 9,
    telegramUserId: 123456,
    styleId: 'test-async',
    photoCount: 1,
    referenceImages: refs.map(r => r.image_url),
    startIndex: 0,
    chunkSize: 1,
  };

  console.log('\nCalling /api/jobs/process...');
  const startTime = Date.now();

  try {
    const response = await fetch(`${APP_URL}/api/jobs/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Dev mode skips signature verification
        'X-Skip-Signature': 'true',
      },
      body: JSON.stringify(payload),
    });

    const elapsed = Date.now() - startTime;
    const result = await response.json();

    console.log(`Response (${elapsed}ms):`, JSON.stringify(result, null, 2));

    if (result.success && result.tasksCreated > 0) {
      console.log('\n✓ Task created successfully!');
      console.log('  The cron job will poll and complete it within 1-2 minutes.');

      // Check kie_tasks table
      const tasks = await sql`
        SELECT id, kie_task_id, status, prompt_index FROM kie_tasks
        WHERE job_id = ${jobId}
      `;
      console.log(`\nKie tasks in DB:`, tasks.length);
      for (const task of tasks) {
        console.log(`  - Task ${task.id}: ${task.kie_task_id} (status: ${task.status})`);
      }

      // Wait and poll
      console.log('\nPolling for completion (max 3 minutes)...');
      for (let i = 0; i < 18; i++) { // 18 * 10s = 3 minutes
        await new Promise(r => setTimeout(r, 10000));

        // Call poll endpoint manually
        await fetch(`${APP_URL}/api/cron/poll-kie-tasks`);

        const updated = await sql`
          SELECT status, result_url FROM kie_tasks WHERE job_id = ${jobId}
        `;

        const task = updated[0];
        console.log(`  [${(i + 1) * 10}s] Task status: ${task?.status}`);

        if (task?.status === 'completed') {
          console.log('\n✓ GENERATION COMPLETE!');
          console.log(`  Result URL: ${task.result_url?.substring(0, 80)}...`);

          // Check generated_photos
          const photos = await sql`
            SELECT id, image_url FROM generated_photos
            WHERE avatar_id = 9 AND style_id = 'test-async'
          `;
          console.log(`  Photos in DB: ${photos.length}`);
          break;
        }

        if (task?.status === 'failed') {
          console.log('\n✗ GENERATION FAILED');
          const failedTask = await sql`
            SELECT error_message FROM kie_tasks WHERE job_id = ${jobId}
          `;
          console.log(`  Error: ${failedTask[0]?.error_message}`);
          break;
        }
      }
    } else {
      console.log('\n✗ Failed to create task');
    }

  } catch (error) {
    console.error('Error:', error);
  }

  // Cleanup
  console.log('\nCleaning up test data...');
  await sql`DELETE FROM kie_tasks WHERE job_id = ${jobId}`;
  await sql`DELETE FROM generated_photos WHERE avatar_id = 9 AND style_id = 'test-async'`;
  await sql`DELETE FROM generation_jobs WHERE id = ${jobId}`;
  console.log('Done!');
}

testGeneration().catch(console.error);
