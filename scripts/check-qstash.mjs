import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
console.log('QSTASH_TOKEN present:', !!QSTASH_TOKEN);

if (!QSTASH_TOKEN) {
  console.log('No QSTASH_TOKEN in .env.prod');
  process.exit(1);
}

// Check DLQ (Dead Letter Queue)
console.log('\n=== Checking DLQ (Dead Letter Queue) ===');
const dlqRes = await fetch('https://qstash.upstash.io/v2/dlq', {
  headers: { 'Authorization': `Bearer ${QSTASH_TOKEN}` }
});
const dlqData = await dlqRes.json();
console.log('DLQ Status:', dlqRes.status);
console.log('Failed messages:', dlqData.messages?.length || 0);

if (dlqData.messages?.length > 0) {
  for (const msg of dlqData.messages.slice(0, 5)) {
    console.log(`\n  ID: ${msg.dlqId}`);
    console.log(`  URL: ${msg.url}`);
    console.log(`  Status: ${msg.responseStatus}`);
    const body = msg.responseBody || 'N/A';
    console.log(`  Error: ${body.substring(0, 200)}`);
  }
}

// Check events (logs)
console.log('\n=== Checking Recent Events ===');
const eventsRes = await fetch('https://qstash.upstash.io/v2/events?count=10', {
  headers: { 'Authorization': `Bearer ${QSTASH_TOKEN}` }
});
const eventsData = await eventsRes.json();
console.log('Events Status:', eventsRes.status);
console.log('Events count:', eventsData.events?.length || 0);

if (eventsData.events?.length > 0) {
  for (const evt of eventsData.events.slice(0, 5)) {
    console.log(`\n  Time: ${new Date(evt.time).toISOString()}`);
    console.log(`  State: ${evt.state}`);
    console.log(`  URL: ${evt.url}`);
    console.log(`  Status: ${evt.responseStatus || 'N/A'}`);
  }
}
