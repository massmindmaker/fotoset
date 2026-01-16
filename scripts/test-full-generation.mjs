import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// Get test user's avatar with uploaded photos
async function getTestData() {
  // Find an avatar with uploaded reference photos
  const avatars = await sql`
    SELECT
      a.id,
      a.name,
      a.user_id,
      u.telegram_user_id,
      (SELECT COUNT(*) FROM reference_photos WHERE avatar_id = a.id) as photo_count
    FROM avatars a
    JOIN users u ON a.user_id = u.id
    WHERE a.status IN ('ready', 'uploading', 'uploaded')
    ORDER BY a.created_at DESC
    LIMIT 5
  `;

  console.log('=== Available Avatars ===');
  console.table(avatars);

  // Get an avatar with photos
  const withPhotos = avatars.find(a => a.photo_count > 0);
  if (!withPhotos) {
    console.log('\n❌ No avatars with uploaded photos found');
    return null;
  }

  console.log('\n✅ Using avatar:', withPhotos.name, '(id:', withPhotos.id, ')');
  console.log('   Reference photos:', withPhotos.photo_count);

  // Get reference photos
  const photos = await sql`
    SELECT id, image_url
    FROM reference_photos
    WHERE avatar_id = ${withPhotos.id}
    LIMIT 5
  `;

  console.log('\n=== Reference Photos ===');
  photos.forEach((p, i) => console.log(`${i + 1}. ${p.image_url?.slice(0, 60)}...`));

  return {
    avatarId: withPhotos.id,
    userId: withPhotos.user_id,
    telegramUserId: withPhotos.telegram_user_id,
    referencePhotos: photos.map(p => p.image_url),
  };
}

async function testGeneration() {
  console.log('=== Full Generation Test ===\n');

  const testData = await getTestData();
  if (!testData) return;

  // Check for existing payments
  const payments = await sql`
    SELECT id, status, amount
    FROM payments
    WHERE user_id = ${testData.userId}
    ORDER BY created_at DESC
    LIMIT 3
  `;

  console.log('\n=== Payments ===');
  console.table(payments);

  const hasSucceededPayment = payments.some(p => p.status === 'succeeded');
  console.log('\n✅ Has succeeded payment:', hasSucceededPayment);

  console.log('\n=== Ready for API test ===');
  console.log('Avatar ID:', testData.avatarId);
  console.log('User ID:', testData.userId);
  console.log('Reference photos:', testData.referencePhotos.length);

  console.log('\n📋 To test generation API, run:');
  console.log(`curl -X POST http://localhost:3000/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{"avatarId": ${testData.avatarId}, "styleId": "professional", "tier": "starter"}'`);
}

testGeneration().catch(console.error);
