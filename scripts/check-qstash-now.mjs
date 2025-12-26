import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
console.log('QSTASH_TOKEN present:', !!QSTASH_TOKEN);

if (!QSTASH_TOKEN) {
  console.log('No QSTASH_TOKEN found');
  process.exit(1);
}

// Check DLQ
console.log('\n=== DLQ (Dead Letter Queue) ===');
const dlqRes = await fetch('https://qstash.upstash.io/v2/dlq', {
  headers: { 'Authorization': `Bearer ${QSTASH_TOKEN}` }
});
const dlqData = await dlqRes.json();
console.log('Failed messages:', dlqData.messages?.length || 0);

if (dlqData.messages?.length > 0) {
  for (const msg of dlqData.messages.slice(0, 5)) {
    console.log(`\n  DLQ ID: ${msg.dlqId}`);
    console.log(`  URL: ${msg.url}`);
    console.log(`  Response Status: ${msg.responseStatus}`);
    if (msg.responseBody) {
      console.log(`  Error: ${msg.responseBody.substring(0, 300)}`);
    }
  }
}

// Check events
console.log('\n=== Recent Events (last 15) ===');
const eventsRes = await fetch('https://qstash.upstash.io/v2/events?count=15', {
  headers: { 'Authorization': `Bearer ${QSTASH_TOKEN}` }
});
const eventsData = await eventsRes.json();
console.log('Total events:', eventsData.events?.length || 0);

const stateCounts = {};
if (eventsData.events?.length > 0) {
  for (const evt of eventsData.events) {
    stateCounts[evt.state] = (stateCounts[evt.state] || 0) + 1;
  }
  console.log('State counts:', stateCounts);

  console.log('\nRecent events:');
  for (const evt of eventsData.events.slice(0, 10)) {
    const time = new Date(evt.time).toISOString();
    console.log(`  [${time}] ${evt.state} - HTTP ${evt.responseStatus || 'N/A'}`);
  }
}
