// Set NODE_ENV=test before any module loads so that:
//   1. index.ts skips app.listen() (prevents EADDRINUSE across test suites)
//   2. Rate limiters are skipped (prevents 429s in integration tests)
process.env.NODE_ENV = 'test';
