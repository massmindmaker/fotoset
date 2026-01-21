import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

const query = process.argv[2]
if (!query) {
  console.error('Usage: node scripts/run-sql.mjs "SELECT ..."')
  process.exit(1)
}

try {
  const result = await sql.query(query)
  console.log(JSON.stringify(result, null, 2))
} catch (e) {
  console.error('Error:', e.message)
  process.exit(1)
}
