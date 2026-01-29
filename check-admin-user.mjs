import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function checkAdmin() {
  try {
    console.log('Checking admin_users table...');
    const admins = await sql`
      SELECT id, email, password_hash IS NOT NULL as has_password, role, is_active, first_name, last_name
      FROM admin_users
      WHERE LOWER(email) = 'massmindmaker@gmail.com'
    `;
    console.log('Admin users found:', admins.length);
    if (admins.length > 0) {
      console.log('Admin:', JSON.stringify(admins[0], null, 2));
    }

    console.log('\nChecking all admin_users...');
    const allAdmins = await sql`
      SELECT id, email, role, is_active
      FROM admin_users
      LIMIT 5
    `;
    console.log('All admins:', JSON.stringify(allAdmins, null, 2));

    console.log('\nChecking partner_users...');
    const partners = await sql`
      SELECT id, email
      FROM partner_users
      WHERE LOWER(email) = 'massmindmaker@gmail.com'
    `;
    console.log('Partners found:', partners.length);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAdmin();
