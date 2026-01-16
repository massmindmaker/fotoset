import { config } from 'dotenv';

// Load prod env with KIE keys
config({ path: '.env.prod' });

const KIE_API_KEY = (process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)?.trim();
const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/createTask';

console.log('=== Testing Kie.ai API ===');
console.log('API Key:', KIE_API_KEY ? `${KIE_API_KEY.slice(0, 8)}...` : 'NOT SET');

async function testKieBalance() {
  try {
    // Test with minimal valid request structure
    const response = await fetch(KIE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nano-banana-pro',
        input: {
          prompt: 'test portrait',
          output_format: 'jpg',
          image_size: '3:4',
        },
      }),
    });

    const data = await response.json();
    console.log('\n=== API Response ===');
    console.log('HTTP Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));

    if (data.code === 402) {
      console.log('\n❌ CREDITS INSUFFICIENT - Need to top up Kie.ai account');
      console.log('   Message:', data.msg);
    } else if (data.code === 401) {
      console.log('\n❌ INVALID API KEY or permissions issue');
      console.log('   Message:', data.msg);
    } else if (data.code === 0 || data.taskId || data.data?.taskId) {
      console.log('\n✅ SUCCESS! Task created');
      console.log('   TaskId:', data.taskId || data.data?.taskId);
    } else {
      console.log('\n⚠️ Other response:', data.msg || 'Unknown');
    }
  } catch (error) {
    console.error('\n❌ Network error:', error.message);
  }
}

testKieBalance();
