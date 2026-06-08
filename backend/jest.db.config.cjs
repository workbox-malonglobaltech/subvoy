/**
 * Real-database integration tests. These connect to an actual Postgres (via
 * DATABASE_URL) and run the genuine SQL/migrations — unlike the default suite,
 * which mocks the pool. Run with `npm run test:db` against a migrated DB.
 *
 * CI provides a Postgres service container; there is no local DB on dev machines,
 * so these are validated in CI, not in the default `npm test`.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests/db'],
  testMatch: ['**/*.db.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleNameMapper: {
    '^../../../src/shared/(.*)$': '<rootDir>/../../src/shared/$1',
  },
  setupFiles: ['<rootDir>/src/tests/env.setup.ts'],
  testTimeout: 30000,
};
