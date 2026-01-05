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

const migrations = process.argv.slice(2);

if (migrations.length === 0) {
  console.log('Usage: node scripts/apply-migrations.mjs <migration1.sql> [migration2.sql] ...');
  console.log('Example: node scripts/apply-migrations.mjs 027_support_tickets.sql 028_drop_is_pro.sql');
  process.exit(1);
}

/**
 * Parse SQL file into statements, properly handling:
 * - $$ dollar-quoted strings (for PL/pgSQL functions)
 * - DO blocks
 * - Multi-line statements
 * - Comments
 */
function parseSqlStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let inDollarQuote = false;
  let dollarTag = '';

  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments (but only outside dollar quotes)
    if (!inDollarQuote && (!trimmedLine || trimmedLine.startsWith('--'))) {
      continue;
    }

    currentStatement += line + '\n';

    // Check for dollar quote start/end
    // Match patterns like $$ or $tag$
    const dollarMatches = line.match(/\$([a-zA-Z_]*)\$/g);

    if (dollarMatches) {
      for (const match of dollarMatches) {
        if (!inDollarQuote) {
          // Starting a dollar-quoted block
          inDollarQuote = true;
          dollarTag = match;
        } else if (match === dollarTag) {
          // Ending the dollar-quoted block
          inDollarQuote = false;
          dollarTag = '';
        }
      }
    }

    // Only end statement on semicolon if not in dollar quote
    if (!inDollarQuote && trimmedLine.endsWith(';')) {
      const stmt = currentStatement.trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      currentStatement = '';
    }
  }

  // Handle any remaining statement
  const remaining = currentStatement.trim();
  if (remaining.length > 0) {
    statements.push(remaining);
  }

  return statements;
}

async function applyMigration(migrationFile) {
  const migrationPath = `scripts/migrations/${migrationFile}`;

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    return false;
  }

  const migration = fs.readFileSync(migrationPath, 'utf-8');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Applying migration: ${migrationFile}`);
  console.log('='.repeat(60));

  // Parse statements properly handling $$ blocks
  const statements = parseSqlStatements(migration);

  console.log(`Found ${statements.length} statements to execute\n`);

  try {
    // Execute each statement using sql.query for dynamic SQL
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      // Get first line for preview
      const firstLine = stmt.split('\n')[0];
      const preview = firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine;
      console.log(`[${i + 1}/${statements.length}] ${preview}`);
      await sql.query(stmt);
    }

    console.log(`\n✅ Migration ${migrationFile} completed successfully!`);
    return true;
  } catch (error) {
    console.error(`❌ Migration ${migrationFile} failed:`, error.message);
    return false;
  }
}

async function run() {
  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary: ${successCount} succeeded, ${failCount} failed`);
  console.log('='.repeat(60));

  if (failCount > 0) {
    process.exit(1);
  }
}

run();
