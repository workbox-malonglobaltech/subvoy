/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleNameMapper: {
    '^../../../src/shared/(.*)$': '<rootDir>/../../src/shared/$1',
  },
  setupFiles: ['<rootDir>/src/tests/env.setup.ts'],
  setupFilesAfterEnv: [],
  clearMocks: true,
  // Raise from the default 5 000 ms — integration tests spin up a full Express
  // app and some workers start slowly under parallel load (12 suites at once).
  // In isolation, each test takes ~12 s; with parallel startup overhead, 30 s
  // gives ample headroom without masking real hangs.
  testTimeout: 30000,
};
