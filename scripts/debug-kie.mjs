import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });
config({ path: '.env.prod' });

const sql = neon(process.env.DATABASE_URL);
const KIE_API_KEY = (process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)?.trim();
const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/createTask';

async function test() {
  // Get reference photos
  const photos = await sql`SELECT image_url FROM reference_photos WHERE avatar_id = 36 LIMIT 12`;
  const urls = photos.map(p => p.image_url);

  console.log('=== Debug Kie.ai Request ===');
  console.log('Reference URLs count:', urls.length);
  console.log('First URL:', urls[0]);

  // Test 1: Without image_input (should work)
  console.log('\n--- Test 1: Without image_input ---');
  const body1 = {
    model: 'nano-banana-pro',
    input: {
      prompt: 'Professional portrait',
      output_format: 'jpg',
      image_size: '3:4',
    },
  };
  console.log('Request body:', JSON.stringify(body1, null, 2));

  const res1 = await fetch(KIE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body1),
  });
  console.log('Response:', await res1.json());

  // Test 2: With image_input (MAX 8 URLs per docs)
  console.log('\n--- Test 2: With image_input (8 URLs - max allowed) ---');
  const body2 = {
    model: 'nano-banana-pro',
    input: {
      prompt: 'Professional portrait',
      image_input: urls.slice(0, 8),  // Max 8 images!
      output_format: 'jpg',
      image_size: '3:4',
    },
  };
  console.log('Request body (truncated):', JSON.stringify({ ...body2, input: { ...body2.input, image_input: `[${urls.length} URLs]` } }, null, 2));
  console.log('Actual image_input length:', body2.input.image_input.length);

  const res2 = await fetch(KIE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body2),
  });
  console.log('Response:', await res2.json());
}

test();
