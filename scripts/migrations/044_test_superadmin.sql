-- Migration 044: Test Superadmin User
-- Created: 2026-01-17
-- Purpose: Create a test superadmin account for development/testing
--
-- Credentials:
--   Email: test@admin.local
--   Password: TestAdmin123!
--
-- NOTE: This migration should only be run in development/staging environments.
--       DO NOT run in production or change the password to something secure.

-- Password hash for 'TestAdmin123!' using bcrypt with cost 12
-- Generated using: bcrypt.hash('TestAdmin123!', 12)
INSERT INTO admin_users (
  email,
  password_hash,
  first_name,
  last_name,
  role,
  is_active
)
VALUES (
  'test@admin.local',
  '$2b$12$DA3cGC.Tod4B9e8HRPh8EO1ozLAodSY/abE8eXLTfRMTLoXq5YXGS',
  'Test',
  'Superadmin',
  'super_admin',
  true
)
ON CONFLICT (email) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = true,
  updated_at = NOW();

-- Add comment for documentation
COMMENT ON TABLE admin_users IS 'Admin panel users with email/password auth. Test superadmin: test@admin.local / TestAdmin123!';
