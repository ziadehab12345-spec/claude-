import 'dotenv/config';

/**
 * Tests run against a real Postgres database, never a mock.
 *
 * The whole point of this system is a database-level exclusion constraint. A
 * mocked or in-memory database would test the mock, not the guarantee, and
 * would happily pass while production double-books a Maybach.
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL is not set. See .env.example.');
}
process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ??= 'test-secret-that-is-definitely-long-enough-1234567890';
