import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function clearDatabase() {
  console.log('Clearing database...\n');

  // Delete in order respecting foreign keys
  try {
    await sql`DELETE FROM generated_photos`;
    console.log('Cleared generated_photos');
  } catch (err) { console.log('generated_photos:', err.message); }

  try {
    await sql`DELETE FROM reference_photos`;
    console.log('Cleared reference_photos');
  } catch (err) { console.log('reference_photos:', err.message); }

  try {
    await sql`DELETE FROM generation_jobs`;
    console.log('Cleared generation_jobs');
  } catch (err) { console.log('generation_jobs:', err.message); }

  try {
    await sql`DELETE FROM photo_favorites`;
    console.log('Cleared photo_favorites');
  } catch (err) { console.log('photo_favorites:', err.message); }

  try {
    await sql`DELETE FROM payments`;
    console.log('Cleared payments');
  } catch (err) { console.log('payments:', err.message); }

  try {
    await sql`DELETE FROM avatars`;
    console.log('Cleared avatars');
  } catch (err) { console.log('avatars:', err.message); }

  try {
    await sql`DELETE FROM users`;
    console.log('Cleared users');
  } catch (err) { console.log('users:', err.message); }

  // Reset sequences
  console.log('\nResetting sequences...');

  try {
    await sql`ALTER SEQUENCE users_id_seq RESTART WITH 1`;
    console.log('Reset users_id_seq');
  } catch (err) { console.log('users_id_seq:', err.message); }

  try {
    await sql`ALTER SEQUENCE avatars_id_seq RESTART WITH 1`;
    console.log('Reset avatars_id_seq');
  } catch (err) { console.log('avatars_id_seq:', err.message); }

  try {
    await sql`ALTER SEQUENCE generated_photos_id_seq RESTART WITH 1`;
    console.log('Reset generated_photos_id_seq');
  } catch (err) { console.log('generated_photos_id_seq:', err.message); }

  try {
    await sql`ALTER SEQUENCE reference_photos_id_seq RESTART WITH 1`;
    console.log('Reset reference_photos_id_seq');
  } catch (err) { console.log('reference_photos_id_seq:', err.message); }

  try {
    await sql`ALTER SEQUENCE generation_jobs_id_seq RESTART WITH 1`;
    console.log('Reset generation_jobs_id_seq');
  } catch (err) { console.log('generation_jobs_id_seq:', err.message); }

  try {
    await sql`ALTER SEQUENCE payments_id_seq RESTART WITH 1`;
    console.log('Reset payments_id_seq');
  } catch (err) { console.log('payments_id_seq:', err.message); }

  console.log('\nDatabase cleared successfully!');
}

clearDatabase().catch(console.error);
