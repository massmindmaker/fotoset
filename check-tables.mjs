import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function checkTables() {
  // Check if login_attempts table exists
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE '%attempt%' OR table_name LIKE '%rate%' OR table_name LIKE '%login%'
  `;
  console.log('Related tables:', tables);
  
  // Check table structure
  const loginAttemptsExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'login_attempts'
    )
  `;
  console.log('login_attempts exists:', loginAttemptsExists);
  
  if (loginAttemptsExists[0].exists) {
    const count = await sql`SELECT COUNT(*) FROM login_attempts`;
    console.log('login_attempts count:', count);
    
    const recent = await sql`
      SELECT * FROM login_attempts
      ORDER BY attempted_at DESC
      LIMIT 5
    `;
    console.log('Recent attempts:', recent);
  }
}

checkTables().catch(console.error);
