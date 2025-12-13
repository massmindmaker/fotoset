/** @type {import('jest').Config} */
const config = {
  displayName: 'integration',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.test.ts'],

  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        moduleResolution: 'node',
      },
    }],
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
  },

  setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.ts'],

  collectCoverageFrom: [
    'app/api/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/tests/**',
  ],

  // Integration tests run sequentially to avoid DB conflicts
  maxWorkers: 1,

  testTimeout: 30000, // 30 seconds for DB operations

  verbose: true,

  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

module.exports = config;
