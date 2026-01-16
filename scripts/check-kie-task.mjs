import { config } from 'dotenv';

config({ path: '.env.prod' });

const KIE_API_KEY = (process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY)?.trim();
const KIE_STATUS_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';
const TASK_ID = process.argv[2] || '9d6209b092f85c372aa8d6032f000cee';

console.log('=== Checking Kie.ai Task Status ===');
console.log('Task ID:', TASK_ID);

async function checkStatus() {
  const response = await fetch(`${KIE_STATUS_URL}?taskId=${TASK_ID}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
    },
  });

  const data = await response.json();
  console.log('\n=== Task Status ===');
  console.log(JSON.stringify(data, null, 2));

  const status = data.data?.status;
  if (status === 'SUCCESS') {
    console.log('\n✅ Generation complete!');
    console.log('   Image URL:', data.data?.output?.image_url);
  } else if (status === 'FAILED') {
    console.log('\n❌ Generation failed:', data.data?.message);
  } else {
    console.log('\n⏳ Status:', status);
  }
}

checkStatus();
