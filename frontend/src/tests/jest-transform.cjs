/**
 * Custom Jest transform: replaces Vite's import.meta.env.* references with
 * literal values before ts-jest sees them. Without this, ts-jest compiles
 * import.meta as-is into the CJS output, which Node then rejects at runtime
 * with "Cannot use 'import.meta' outside a module".
 *
 * Usage in jest.config.cjs:
 *   transform: {
 *     '^.+\\.tsx?$': ['<rootDir>/src/tests/jest-transform.cjs', {
 *       tsconfig: '<rootDir>/tsconfig.test.json',
 *       diagnostics: { ignoreCodes: ['TS151001'] },
 *     }]
 *   }
 */
const { TsJestTransformer } = require('ts-jest');

// Values substituted for import.meta.env.* in tests
const META_ENV = {
  DEV:                      'true',
  PROD:                     'false',
  MODE:                     '"test"',
  VITE_API_URL:             '""',
  VITE_SENTRY_DSN:          '""',
  VITE_PAYSTACK_PUBLIC_KEY: '""',
};

const transformer = new TsJestTransformer();

function replaceImportMeta(src) {
  let out = src;
  for (const [key, value] of Object.entries(META_ENV)) {
    // Use split/join to avoid regex escaping issues with the key names
    out = out.split(`import.meta.env.${key}`).join(value);
  }
  // Catch-all for any remaining import.meta.env.ANYTHING
  out = out.replace(/import\.meta\.env\.\w+/g, 'undefined');
  return out;
}

module.exports = {
  process(sourceText, sourcePath, options) {
    return transformer.process(replaceImportMeta(sourceText), sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    return transformer.getCacheKey(replaceImportMeta(sourceText), sourcePath, options);
  },
};
