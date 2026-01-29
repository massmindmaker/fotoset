import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL);

async function verifyPassword() {
  const password = 'MegaAdmin2025!';
  
  // Get the stored hash
  const admins = await sql`
    SELECT id, email, password_hash
    FROM admin_users
    WHERE LOWER(email) = 'massmindmaker@gmail.com'
  `;
  
  if (admins.length === 0) {
    console.log('Admin not found');
    return;
  }
  
  const admin = admins[0];
  console.log('Admin found:', admin.email);
  console.log('Stored hash:', admin.password_hash);
  console.log('Hash length:', admin.password_hash?.length);
  
  // Verify password
  console.log('\nVerifying password...');
  const isValid = await bcrypt.compare(password, admin.password_hash);
  console.log('Password valid:', isValid);
  
  // Generate new hash for comparison
  console.log('\nGenerating new hash for comparison...');
  const newHash = await bcrypt.hash(password, 10);
  console.log('New hash:', newHash);
  
  // Verify new hash
  const newValid = await bcrypt.compare(password, newHash);
  console.log('New hash valid:', newValid);
}

verifyPassword().catch(console.error);
