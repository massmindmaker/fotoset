import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

console.log('DATABASE_URL ends with:', process.env.DATABASE_URL?.slice(-40));

const admins = await sql`
  SELECT id, email, LEFT(password_hash, 25) as hash_prefix
  FROM admin_users
  WHERE LOWER(email) = 'massmindmaker@gmail.com'
`;

console.log('Admin records:', JSON.stringify(admins, null, 2));
