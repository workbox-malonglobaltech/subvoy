// Set NODE_ENV=test before any module loads so that:
//   1. index.ts skips app.listen() (prevents EADDRINUSE across test suites)
//   2. Rate limiters are skipped (prevents 429s in integration tests)
process.env.NODE_ENV = 'test';

// Exercise the wallet/autopay feature in tests regardless of the deploy flag —
// the gating itself is a thin 404/hidden layer; the feature logic stays covered.
process.env.FEATURE_WALLET = 'true';
