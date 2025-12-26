import { config } from 'dotenv';

config({ path: '.env.local' });

// QStash API endpoints
const QSTASH_API = 'https://qstash.upstash.io/v2';

async function checkQstashDLQ() {
  const token = process.env.QSTASH_TOKEN;

  if (!token) {
    console.error('QSTASH_TOKEN not set in .env.local');
    console.log('You can find it at: https://console.upstash.com/qstash');
    process.exit(1);
  }

  console.log('=== QStash Status Check ===\n');
  console.log(`Token configured: ${token.substring(0, 8)}...`);

  try {
    // Get DLQ messages
    console.log('\n--- Dead Letter Queue (failed messages) ---');
    const dlqRes = await fetch(`${QSTASH_API}/dlq`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!dlqRes.ok) {
      console.error(`DLQ request failed: ${dlqRes.status}`);
      const errorText = await dlqRes.text();
      console.error(errorText);
    } else {
      const dlq = await dlqRes.json();
      console.log(`DLQ messages count: ${dlq.messages?.length || 0}`);

      if (dlq.messages && dlq.messages.length > 0) {
        console.log('\nRecent failed messages:');
        dlq.messages.slice(0, 5).forEach((msg, i) => {
          console.log(`\n${i + 1}. Message ID: ${msg.messageId}`);
          console.log(`   URL: ${msg.url}`);
          console.log(`   Error: ${msg.responseStatus} - ${msg.responseBody?.substring(0, 200)}`);
          console.log(`   Retries: ${msg.retried}`);
          console.log(`   Created: ${new Date(msg.createdAt).toISOString()}`);
        });
      } else {
        console.log('No failed messages in DLQ');
      }
    }

    // Get events/logs
    console.log('\n--- Recent Events ---');
    const eventsRes = await fetch(`${QSTASH_API}/events`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!eventsRes.ok) {
      console.error(`Events request failed: ${eventsRes.status}`);
    } else {
      const events = await eventsRes.json();
      console.log(`Total events: ${events.events?.length || 0}`);

      if (events.events && events.events.length > 0) {
        // Filter for job processing events
        const jobEvents = events.events
          .filter(e => e.url?.includes('/api/jobs/process') || e.url?.includes('/api/jobs/failure'))
          .slice(0, 10);

        console.log(`\nJob-related events: ${jobEvents.length}`);
        jobEvents.forEach((e, i) => {
          console.log(`\n${i + 1}. ${e.state} at ${new Date(e.time).toISOString()}`);
          console.log(`   URL: ${e.url}`);
          console.log(`   Response: ${e.responseStatus}`);
          if (e.responseBody) {
            console.log(`   Body: ${e.responseBody.substring(0, 200)}`);
          }
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkQstashDLQ();
