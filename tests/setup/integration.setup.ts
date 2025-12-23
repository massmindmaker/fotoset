/**
 * Integration Test Setup
 *
 * Configures database connection and environment for tests
 * NOTE: Each test file manages its own data cleanup
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Database connection for tests
let testDb: NeonQueryFunction<false, false>;

// Setup before all tests
beforeAll(async () => {
  // Initialize test database connection
  const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for integration tests');
  }

  testDb = neon(databaseUrl);

  console.log('[Test Setup] Database connection initialized');
});

// Cleanup after all tests
afterAll(async () => {
  // neon serverless doesn't need explicit close
  // Connection is closed automatically after each query
  console.log('[Test Setup] Test suite completed');
});

// Export database instance for tests
export { testDb };

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.GOOGLE_API_KEY = process.env.TEST_GOOGLE_API_KEY || 'test_mock_key';
process.env.TBANK_TERMINAL_KEY = process.env.TEST_TBANK_TERMINAL_KEY || 'test_terminal';
process.env.TBANK_PASSWORD = process.env.TEST_TBANK_PASSWORD || 'test_password';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
