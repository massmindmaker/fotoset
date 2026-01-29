import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

async function check() {
  // Check all login attempts
  const all = await sql`SELECT * FROM login_attempts ORDER BY attempted_at DESC LIMIT 50`;
  console.log('All login attempts:', JSON.stringify(all, null, 2));
  
  // Check table structure
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'login_attempts'
  `;
  console.log('\nTable structure:', cols);
}
check().catch(console.error);
