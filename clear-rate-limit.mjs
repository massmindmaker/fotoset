import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function clearRateLimit() {
  // Show current attempts
  const attempts = await sql`
    SELECT ip_address, email, success, attempted_at
    FROM login_attempts
    ORDER BY attempted_at DESC
    LIMIT 20
  `;
  console.log('Recent login attempts:', attempts);
  
  // Delete all login attempts for testing
  const deleted = await sql`
    DELETE FROM login_attempts
    WHERE attempted_at > NOW() - INTERVAL '2 hours'
    RETURNING id
  `;
  console.log('Deleted attempts:', deleted.length);
}

clearRateLimit().catch(console.error);
