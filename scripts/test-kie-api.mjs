import { config } from 'dotenv';
config({ path: '.env.local' });

const KIE_API_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_STATUS_URL = "https://api.kie.ai/api/v1/jobs/getTask";

async function testKieApi() {
  const apiKey = (process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)?.trim();

  console.log('=== Kie.ai API Test ===\n');
  console.log('API Key:', apiKey ? `SET (${apiKey.length} chars)` : 'NOT SET');

  if (!apiKey) {
    console.log('\nERROR: No API key configured');
    process.exit(1);
  }

  console.log('\n--- Creating test task ---');

  try {
    const createResponse = await fetch(KIE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nano-banana-pro",
        input: {
          prompt: "A simple test portrait",
          output_format: "jpg",
          image_size: "1:1",
        },
      }),
    });

    console.log(`Response status: ${createResponse.status}`);
    const responseText = await createResponse.text();
    console.log('Response:', responseText.substring(0, 500));

    if (!createResponse.ok) {
      console.log('\nERROR: Task creation failed');
      process.exit(1);
    }

    console.log('\nSUCCESS: Task created');

  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

testKieApi();
