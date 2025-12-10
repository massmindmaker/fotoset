const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running migration 005_add_reference_photos...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_photos (
        id SERIAL PRIMARY KEY,
        avatar_id INTEGER NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Table reference_photos created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reference_photos_avatar ON reference_photos(avatar_id)
    `);
    console.log('Index created');

    const result = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'reference_photos' ORDER BY ordinal_position
    `);

    console.log('Table structure:');
    result.rows.forEach(row => console.log('  -', row.column_name, ':', row.data_type));
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
