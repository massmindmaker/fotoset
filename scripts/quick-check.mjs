import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });
config({ path: '.env.prod' });

const sql = neon(process.env.DATABASE_URL);

// Recent payments
const payments = await sql`
  SELECT p.id, p.user_id, p.amount, p.status, p.generation_consumed, p.created_at,
         u.telegram_user_id, u.telegram_username
  FROM payments p
  JOIN users u ON p.user_id = u.id
  ORDER BY p.created_at DESC
  LIMIT 5
`;

console.log('=== ПОСЛЕДНИЕ ПЛАТЕЖИ ===');
payments.forEach(p => {
  console.log(`Payment #${p.id}: user ${p.telegram_username || p.telegram_user_id}, ${p.amount} RUB, status=${p.status}, consumed=${p.generation_consumed}`);
});

// Recent jobs
const jobs = await sql`
  SELECT id, avatar_id, status, error_message, created_at
  FROM generation_jobs
  ORDER BY created_at DESC
  LIMIT 5
`;

console.log('\n=== ПОСЛЕДНИЕ JOBS ===');
jobs.forEach(j => {
  console.log(`Job #${j.id}: avatar ${j.avatar_id}, status=${j.status}, error=${j.error_message || 'none'}`);
});

// Check for unconsumed payments (refund candidates)
const unconsumed = await sql`
  SELECT p.id, p.user_id, p.amount, u.telegram_user_id
  FROM payments p
  JOIN users u ON p.user_id = u.id
  WHERE p.status = 'succeeded' AND p.generation_consumed = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM generation_jobs gj
    WHERE gj.payment_id = p.id AND gj.status IN ('completed', 'processing')
  )
  ORDER BY p.created_at DESC
  LIMIT 5
`;

if (unconsumed.length > 0) {
  console.log('\n=== ПЛАТЕЖИ БЕЗ ГЕНЕРАЦИИ (кандидаты на рефанд) ===');
  unconsumed.forEach(p => {
    console.log(`Payment #${p.id}: user ${p.telegram_user_id}, ${p.amount} RUB - CONSUMED но нет успешной генерации!`);
  });
}
