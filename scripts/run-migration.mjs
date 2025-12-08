import { neon } from "@neondatabase/serverless"
import { readFileSync } from "fs"

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Z4kGOoWgLj0D@ep-damp-resonance-a4kycta6-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

const sql = neon(DATABASE_URL)

async function runMigration() {
  console.log("Running migration 002_add_favorites...")

  try {
    // Create photo_favorites table
    await sql`
      CREATE TABLE IF NOT EXISTS photo_favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        photo_id INTEGER NOT NULL REFERENCES generated_photos(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, photo_id)
      )
    `
    console.log("✓ Created photo_favorites table")

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_photo_favorites_user_id ON photo_favorites(user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_photo_favorites_photo_id ON photo_favorites(photo_id)`
    console.log("✓ Created indexes for photo_favorites")

    // Create shared_galleries table
    await sql`
      CREATE TABLE IF NOT EXISTS shared_galleries (
        id SERIAL PRIMARY KEY,
        share_token VARCHAR(64) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        avatar_id INTEGER REFERENCES avatars(id) ON DELETE CASCADE,
        photo_ids INTEGER[] NOT NULL DEFAULT '{}',
        title VARCHAR(255),
        expires_at TIMESTAMP NOT NULL,
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log("✓ Created shared_galleries table")

    // Create indexes for shared_galleries
    await sql`CREATE INDEX IF NOT EXISTS idx_shared_galleries_token ON shared_galleries(share_token)`
    await sql`CREATE INDEX IF NOT EXISTS idx_shared_galleries_expires ON shared_galleries(expires_at)`
    console.log("✓ Created indexes for shared_galleries")

    // Add download_count column
    try {
      await sql`ALTER TABLE generated_photos ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0`
      console.log("✓ Added download_count column")
    } catch (e) {
      console.log("- download_count column already exists or skipped")
    }

    // Add share_count column
    try {
      await sql`ALTER TABLE generated_photos ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0`
      console.log("✓ Added share_count column")
    } catch (e) {
      console.log("- share_count column already exists or skipped")
    }

    // Add tier columns to payments
    try {
      await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS tier_id VARCHAR(50)`
      await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS photo_count INTEGER`
      console.log("✓ Added tier columns to payments")
    } catch (e) {
      console.log("- tier columns already exist or skipped")
    }

    console.log("\n✅ Migration completed successfully!")

  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  }
}

runMigration()
