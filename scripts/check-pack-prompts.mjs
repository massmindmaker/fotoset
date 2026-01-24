import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const sql = neon(process.env.DATABASE_URL)

  // Check pack_prompts structure
  const packPrompts = await sql`
    SELECT id, pack_id, prompt, preview_url, position
    FROM pack_prompts
    WHERE pack_id = 1
    ORDER BY position
    LIMIT 5
  `

  console.log('Pack prompts (first 5):')
  for (const pp of packPrompts) {
    console.log(`  [${pp.id}] pos=${pp.position}, preview=${pp.preview_url ? 'YES' : 'NULL'}`)
    console.log(`      prompt: ${pp.prompt?.substring(0, 80)}...`)
  }

  // Check for prompt text matches
  console.log('\n\nLooking for matching saved_prompts with preview...')
  for (const pp of packPrompts) {
    const matches = await sql`
      SELECT id, name, preview_url
      FROM saved_prompts
      WHERE preview_url IS NOT NULL
        AND preview_url != ''
        AND prompt ILIKE ${pp.prompt.substring(0, 100) + '%'}
      LIMIT 1
    `
    if (matches.length > 0) {
      console.log(`  Pack prompt ${pp.id} matches saved_prompt ${matches[0].id}: ${matches[0].name}`)
      console.log(`      Preview URL: ${matches[0].preview_url}`)
    }
  }
}

main().catch(console.error)
