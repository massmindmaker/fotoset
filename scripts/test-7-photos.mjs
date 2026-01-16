import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });
config({ path: '.env.prod' });

const sql = neon(process.env.DATABASE_URL);
const KIE_API_KEY = (process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)?.trim();
const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_STATUS_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';

// Professional style prompts
const PROMPTS = [
  'Professional headshot portrait with confident expression, clean studio background, business attire, soft natural lighting',
  'Corporate executive portrait, modern office setting, natural window light, professional look',
  'LinkedIn professional photo, friendly smile, neutral backdrop, business casual attire',
  'Professional business portrait, contemporary style, subtle background, confident pose',
  'Modern professional headshot, relaxed confident expression, clean minimalist background',
  'Executive portrait, warm natural lighting, modern workspace, professional appearance',
  'Business profile photo, approachable expression, soft studio lighting, professional attire',
];

async function getRefPhotos(avatarId) {
  // Max 8 images per Kie.ai API docs!
  const photos = await sql`
    SELECT image_url FROM reference_photos
    WHERE avatar_id = ${avatarId}
    LIMIT 8
  `;
  return photos.map(p => p.image_url);
}

async function createTask(prompt, referenceImages) {
  const response = await fetch(KIE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nano-banana-pro',
      input: {
        prompt,
        image_input: referenceImages,
        output_format: 'jpg',
        image_size: '3:4',
      },
    }),
  });
  return response.json();
}

async function checkStatus(taskId) {
  const response = await fetch(`${KIE_STATUS_URL}?taskId=${taskId}`, {
    headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
  });
  return response.json();
}

async function main() {
  console.log('=== Testing 7-Photo Generation Package ===\n');

  // Get reference photos (avatar 36 has 14 photos)
  const avatarId = 36;
  const referenceImages = await getRefPhotos(avatarId);
  console.log(`Reference photos: ${referenceImages.length}`);
  console.log(`API Key: ${KIE_API_KEY?.slice(0, 8)}...`);

  // Create 7 tasks
  console.log('\n--- Creating 7 tasks ---');
  const tasks = [];
  for (let i = 0; i < 7; i++) {
    const prompt = PROMPTS[i];
    console.log(`\n[${i + 1}/7] Creating task...`);
    console.log(`   Prompt: ${prompt.slice(0, 50)}...`);

    const result = await createTask(prompt, referenceImages);
    if (result.code === 200 && result.data?.taskId) {
      tasks.push({ index: i, taskId: result.data.taskId, prompt });
      console.log(`   ✅ TaskId: ${result.data.taskId}`);
    } else {
      console.log(`   ❌ Error:`, result);
    }
  }

  console.log(`\n--- ${tasks.length} tasks created, waiting for results ---`);

  // Poll for results
  const MAX_WAIT = 180000; // 3 minutes
  const POLL_INTERVAL = 3000;
  const startTime = Date.now();
  const results = [];
  const pending = [...tasks];

  while (pending.length > 0 && Date.now() - startTime < MAX_WAIT) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    for (let i = pending.length - 1; i >= 0; i--) {
      const task = pending[i];
      const status = await checkStatus(task.taskId);

      if (status.data?.state === 'success') {
        const resultJson = JSON.parse(status.data.resultJson || '{}');
        const imageUrl = resultJson.resultUrls?.[0];
        results.push({ ...task, imageUrl, latency: elapsed * 1000 });
        pending.splice(i, 1);
        console.log(`[${elapsed}s] ✅ Photo ${task.index + 1} completed`);
      } else if (status.data?.state === 'failed') {
        console.log(`[${elapsed}s] ❌ Photo ${task.index + 1} failed:`, status.data?.failMsg);
        pending.splice(i, 1);
      }
    }

    console.log(`[${elapsed}s] Progress: ${results.length}/7 completed, ${pending.length} pending`);
  }

  // Final report
  console.log('\n========================================');
  console.log('       GENERATION RESULTS');
  console.log('========================================\n');

  if (results.length === 7) {
    console.log('✅ SUCCESS! All 7 photos generated!\n');
  } else if (results.length > 0) {
    console.log(`⚠️ PARTIAL: ${results.length}/7 photos generated\n`);
  } else {
    console.log('❌ FAILED: No photos generated\n');
  }

  results.forEach((r, i) => {
    console.log(`Photo ${r.index + 1}:`);
    console.log(`  URL: ${r.imageUrl}`);
    console.log(`  Latency: ${r.latency}ms\n`);
  });

  console.log(`Total time: ${Math.round((Date.now() - startTime) / 1000)}s`);
}

main().catch(console.error);
