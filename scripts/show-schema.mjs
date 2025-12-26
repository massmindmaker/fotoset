import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function showSchema() {
  console.log('=== PinGlass Database Schema ===\n');

  try {
    // Get all tables
    console.log('--- TABLES ---');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log(tables.map(t => t.table_name).join('\n'));

    // Get columns for each table
    console.log('\n--- COLUMNS BY TABLE ---\n');
    for (const table of tables) {
      console.log(`=== ${table.table_name.toUpperCase()} ===`);
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${table.table_name}
        ORDER BY ordinal_position
      `;
      columns.forEach(c => {
        const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
        console.log(`  ${c.column_name}: ${c.data_type} ${nullable}${def}`);
      });
      console.log('');
    }

    // Get foreign keys
    console.log('--- FOREIGN KEYS ---');
    const fks = await sql`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name
    `;
    fks.forEach(fk => {
      console.log(`${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

  } catch (e) {
    console.error('Error:', e.message);
    console.error('Full error:', e);
  }
}

showSchema();
