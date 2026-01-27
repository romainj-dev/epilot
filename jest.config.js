const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  coverageProvider: 'v8',
  testEnvironment: 'jest-environment-node',
  setupFilesAfterEnv: [],
  moduleNameMapper: {
    // Map lambda-utils imports to the local package
    '^lambda-utils$': '<rootDir>/packages/lambda-utils/index.js',
    '^lambda-utils/(.*)$': '<rootDir>/packages/lambda-utils/$1',
  },
  // Amplify keeps a duplicate backend snapshot under amplify/#current-cloud-backend
  // which can trigger jest-haste-map naming collisions (duplicate package.json names).
  modulePathIgnorePatterns: ['<rootDir>/amplify/#current-cloud-backend/'],
  watchPathIgnorePatterns: ['<rootDir>/amplify/#current-cloud-backend/'],
  testMatch: [
    // Lambda unit tests
    '**/amplify/backend/function/**/*.unit.test.js',
  ],
  // Separate timeouts for unit vs integration tests (integration tests override via CLI)
  testTimeout: 10000,
  // Clear mocks between tests
  clearMocks: true,
  // Restore mocks after each test
  restoreMocks: true,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
