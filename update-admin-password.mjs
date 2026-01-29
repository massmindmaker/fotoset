import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL);

async function updatePassword() {
  const password = 'MegaAdmin2025!';
  
  // Generate new hash
  const hash = await bcrypt.hash(password, 10);
  console.log('Generated hash:', hash);
  
  // Update password
  const result = await sql`
    UPDATE admin_users
    SET password_hash = ${hash}
    WHERE LOWER(email) = 'massmindmaker@gmail.com'
    RETURNING id, email
  `;
  
  console.log('Updated:', result);
  
  // Verify
  const verify = await sql`
    SELECT password_hash FROM admin_users
    WHERE LOWER(email) = 'massmindmaker@gmail.com'
  `;
  
  const isValid = await bcrypt.compare(password, verify[0].password_hash);
  console.log('Password verification after update:', isValid);
}

updatePassword().catch(console.error);
