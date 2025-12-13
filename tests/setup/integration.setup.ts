/**
 * Integration Test Setup
 *
 * Configures database connection, test data seeding, and cleanup
 */

import { sql } from '@neondatabase/serverless';

// Database connection for tests
let testDb: ReturnType<typeof sql>;

// Setup before all tests
beforeAll(async () => {
  // Initialize test database connection
  const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for integration tests');
  }

  testDb = sql(databaseUrl);

  // Run migrations (if needed)
  // await runMigrations(testDb);
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  if (testDb) {
    await testDb.end();
  }
});

// Reset database state before each test
beforeEach(async () => {
  // Truncate tables (preserving schema)
  await testDb`TRUNCATE TABLE generation_jobs, generated_photos, payments, avatars, users RESTART IDENTITY CASCADE`;

  // Seed with minimal test data if needed
  // await seedTestData(testDb);
});

// Helper function to seed test data
async function seedTestData(db: ReturnType<typeof sql>) {
  // Insert test users
  await db`
    INSERT INTO users (device_id, is_pro)
    VALUES
      ('test-device-1', false),
      ('test-device-2', true),
      ('test-device-3', false)
  `;

  // Insert test avatars
  await db`
    INSERT INTO avatars (user_id, name, status, thumbnail_url)
    VALUES
      (2, 'Test Avatar 1', 'ready', 'https://example.com/thumb1.jpg'),
      (2, 'Test Avatar 2', 'processing', null)
  `;
}

// Export database instance for tests
export { testDb };

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.GOOGLE_API_KEY = process.env.TEST_GOOGLE_API_KEY || 'test_mock_key';
process.env.TBANK_TERMINAL_KEY = process.env.TEST_TBANK_TERMINAL_KEY || 'test_terminal';
process.env.TBANK_PASSWORD = process.env.TEST_TBANK_PASSWORD || 'test_password';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
