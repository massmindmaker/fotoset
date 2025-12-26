import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkReferences() {
  console.log('=== Reference Photos Analysis ===\n');

  try {
    // Get reference photos with URL length
    const refs = await sql`
      SELECT
        rp.avatar_id,
        rp.id,
        LENGTH(rp.image_url) as url_length,
        SUBSTRING(rp.image_url, 1, 100) as url_preview
      FROM reference_photos rp
      ORDER BY rp.avatar_id DESC, rp.id
      LIMIT 20
    `;

    console.log('Reference photos:');
    refs.forEach(r => {
      const isBase64 = r.url_preview.startsWith('data:');
      const isUrl = r.url_preview.startsWith('http');
      console.log(`  Avatar ${r.avatar_id}, Photo ${r.id}: ${r.url_length} chars, type: ${isBase64 ? 'BASE64' : isUrl ? 'URL' : 'OTHER'}`);
    });

    // Check for base64 encoded images (too large for Kie.ai)
    console.log('\n--- Base64 images check ---');
    const base64Count = await sql`
      SELECT COUNT(*) as count
      FROM reference_photos
      WHERE image_url LIKE 'data:%'
    `;
    console.log(`Base64 encoded images: ${base64Count[0].count}`);

    const urlCount = await sql`
      SELECT COUNT(*) as count
      FROM reference_photos
      WHERE image_url LIKE 'http%'
    `;
    console.log(`URL-based images: ${urlCount[0].count}`);

    // Check average size
    console.log('\n--- Image size stats ---');
    const stats = await sql`
      SELECT
        AVG(LENGTH(image_url)) as avg_length,
        MAX(LENGTH(image_url)) as max_length,
        MIN(LENGTH(image_url)) as min_length
      FROM reference_photos
    `;
    console.log(`Average URL length: ${Math.round(stats[0].avg_length)} chars`);
    console.log(`Max URL length: ${stats[0].max_length} chars`);
    console.log(`Min URL length: ${stats[0].min_length} chars`);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkReferences();
