import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

const QSTASH_TOKEN = process.env.QSTASH_TOKEN;

const eventsRes = await fetch('https://qstash.upstash.io/v2/events?count=50', {
  headers: { 'Authorization': `Bearer ${QSTASH_TOKEN}` }
});
const eventsData = await eventsRes.json();

// Group by state
const grouped = {};
for (const evt of eventsData.events || []) {
  grouped[evt.state] = (grouped[evt.state] || 0) + 1;
}
console.log('Events by state:', grouped);

// Show errors
console.log('\n=== ERRORS ===');
const errors = (eventsData.events || []).filter(e => e.state === 'ERROR' || e.responseStatus >= 400);
for (const evt of errors) {
  const time = new Date(evt.time).toISOString();
  console.log(`Time: ${time}, Status: ${evt.responseStatus}, URL: ${evt.url}`);
}

// Show timeouts (524)
console.log('\n=== TIMEOUTS (524) ===');
const timeouts = (eventsData.events || []).filter(e => e.responseStatus === 524);
console.log(`Total timeouts: ${timeouts.length}`);
