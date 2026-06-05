/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['<rootDir>/src/tests/jest-transform.cjs', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      diagnostics: { ignoreCodes: ['TS151001'] },
    }],
  },
  moduleNameMapper: {
    // Stub CSS/SVG/image imports (not relevant in unit tests)
    '\\.(css|less|scss|sass)$': '<rootDir>/src/tests/__mocks__/fileMock.js',
    '\\.(svg|png|jpg|jpeg|gif|webp)$': '<rootDir>/src/tests/__mocks__/fileMock.js',
    // Map shared types (same pattern as the backend)
    '^../../../src/shared/(.*)$': '<rootDir>/../../src/shared/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  clearMocks: true,
  testTimeout: 10000,
};
