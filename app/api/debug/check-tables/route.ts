/**
 * Debug endpoint to check table structure
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    // Check tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%referral%' OR table_name LIKE '%partner%')
      ORDER BY table_name
    `

    // Check referral_codes columns
    let codeColumns: any[] = []
    try {
      codeColumns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'referral_codes'
        ORDER BY ordinal_position
      `
    } catch (e) {
      codeColumns = [{ error: 'Table not found' }]
    }

    // Check referral_codes constraints
    let constraints: any[] = []
    try {
      constraints = await sql`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'referral_codes'
      `
    } catch (e) {
      constraints = []
    }

    return NextResponse.json({
      tables: tables.map(t => t.table_name),
      referral_codes_columns: codeColumns,
      referral_codes_constraints: constraints
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
