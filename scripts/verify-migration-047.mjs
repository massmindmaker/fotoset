#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';

const url = 'postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(url);

console.log('=== VERIFYING MIGRATION 047 ===\n');

// Check photo_packs columns
const packCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'photo_packs' AND column_name IN ('owner_type', 'partner_user_id', 'moderation_status') ORDER BY column_name`;
console.log('✅ photo_packs columns:', packCols.map(c => c.column_name).join(', '));

// Check pack_prompts table exists
const packPromptsExists = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pack_prompts')`;
console.log('✅ pack_prompts table exists:', packPromptsExists[0].exists);

// Check users.active_pack_id
const userActivePackCol = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'active_pack_id')`;
console.log('✅ users.active_pack_id exists:', userActivePackCol[0].exists);

// Check generation_jobs.pack_id
const genJobPackCol = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generation_jobs' AND column_name = 'pack_id')`;
console.log('✅ generation_jobs.pack_id exists:', genJobPackCol[0].exists);

// Check kie_tasks.pack_prompt_id
const kiePromptCol = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kie_tasks' AND column_name = 'pack_prompt_id')`;
console.log('✅ kie_tasks.pack_prompt_id exists:', kiePromptCol[0].exists);

console.log('\n✅ Migration 047 verification complete!');
