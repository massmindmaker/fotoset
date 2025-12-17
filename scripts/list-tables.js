require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function listTables() {
  // Get list of tables
  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  console.log('Tables in database:');
  console.log('-------------------');

  let total = 0;
  for (const t of tables) {
    try {
      // Use tagged template for each table
      const name = t.tablename;
      let count;

      // Manual switch for known tables
      switch(name) {
        case 'avatars': count = await sql`SELECT COUNT(*) as c FROM avatars`; break;
        case 'users': count = await sql`SELECT COUNT(*) as c FROM users`; break;
        case 'payments': count = await sql`SELECT COUNT(*) as c FROM payments`; break;
        case 'generated_photos': count = await sql`SELECT COUNT(*) as c FROM generated_photos`; break;
        case 'generation_jobs': count = await sql`SELECT COUNT(*) as c FROM generation_jobs`; break;
        case 'reference_photos': count = await sql`SELECT COUNT(*) as c FROM reference_photos`; break;
        case 'referral_earnings': count = await sql`SELECT COUNT(*) as c FROM referral_earnings`; break;
        case 'webhook_logs': count = await sql`SELECT COUNT(*) as c FROM webhook_logs`; break;
        default: count = [{ c: '?' }];
      }

      const rows = count[0]?.c ?? 0;
      total += Number(rows) || 0;
      console.log(`  ${name}: ${rows} rows`);
    } catch (e) {
      console.log(`  ${t.tablename}: error - ${e.message}`);
    }
  }

  console.log('-------------------');
  console.log(`Total: ${tables.length} tables, ${total} rows`);
}

listTables().catch(console.error);
