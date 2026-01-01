import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    console.error('DATABASE_URL or DATABASE_URL_UNPOOLED is not set');
    process.exit(1);
  }

  const sql = neon(connectionString);

  const migrationPath = path.join(__dirname, 'migrations', '023_pack_items_prompt_link.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Split by statements and execute each
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log('Running migration 023: pack_items_prompt_link');
  console.log(`Found ${statements.length} statements`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
    console.log(stmt.slice(0, 80) + (stmt.length > 80 ? '...' : ''));

    try {
      await sql.query(stmt);
      console.log('OK');
    } catch (error) {
      console.error('Error:', error.message);
      // Continue with other statements
    }
  }

  console.log('\nMigration 023 completed!');
}

runMigration().catch(console.error);
