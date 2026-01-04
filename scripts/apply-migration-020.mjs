import fs from 'fs';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

console.log('Connecting to Neon database...');
const sql = neon(databaseUrl);

const migrationPath = 'scripts/migrations/020_partner_program.sql';
const migration = fs.readFileSync(migrationPath, 'utf-8');

async function run() {
  try {
    // Execute as single transaction
    console.log('Applying migration 020_partner_program.sql...');

    // Split into individual statements (handling multi-line)
    const statements = [];
    let currentStatement = '';

    for (const line of migration.split('\n')) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('--')) continue;

      currentStatement += ' ' + line;

      // If line ends with semicolon, it's end of statement
      if (trimmedLine.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    // Execute each statement using sql.query for dynamic SQL
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[${i + 1}/${statements.length}] ${stmt.slice(0, 50)}...`);
      await sql.query(stmt);
    }

    console.log('\n✅ Migration 020_partner_program.sql completed successfully!');

    // Verify tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'partner_applications'
    `;
    console.log('✅ partner_applications table exists:', tables.length > 0);

    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'referral_balances'
      AND column_name IN ('commission_rate', 'is_partner')
    `;
    console.log('✅ referral_balances columns added:', columns.map(c => c.column_name).join(', '));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

run();
