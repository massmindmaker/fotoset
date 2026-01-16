import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// Get reference photos from DB
async function getRefPhotos(avatarId) {
  const photos = await sql`
    SELECT image_url
    FROM reference_photos
    WHERE avatar_id = ${avatarId}
    LIMIT 5
  `;
  return photos.map(p => p.image_url);
}

async function testGeneration() {
  const avatarId = 62;
  const referenceImages = await getRefPhotos(avatarId);

  console.log('=== Test API Generation ===');
  console.log('Reference photos:', referenceImages.length);

  const payload = {
    prompt: 'Professional portrait of a young woman in a modern office setting, natural lighting, confident pose, business casual attire',
    referenceImages,
    photoCount: 2, // Test with 2 photos
    aspectRatio: '3:4',
  };

  console.log('\nSending request to /api/admin/test-prompt...');
  console.log('Payload:', JSON.stringify({ ...payload, referenceImages: `[${payload.referenceImages.length} images]` }));

  try {
    const response = await fetch('https://pinglass.ru/api/admin/test-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('\n=== Response ===');
    console.log('Status:', response.status);
    console.log('Success:', data.success);

    if (data.success && data.results) {
      console.log('\n✅ Generation successful!');
      console.log('Photos generated:', data.results.length);
      data.results.forEach((r, i) => {
        console.log(`\n  Photo ${i + 1}:`);
        console.log(`    URL: ${r.imageUrl}`);
        console.log(`    Latency: ${r.latency}ms`);
        console.log(`    TaskId: ${r.taskId}`);
      });
    } else {
      console.log('\n❌ Generation failed');
      console.log('Error:', JSON.stringify(data.error, null, 2));
    }
  } catch (error) {
    console.error('Network error:', error.message);
  }
}

testGeneration();
