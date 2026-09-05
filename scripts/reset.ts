/**
 * Drops every object in the public schema and re-runs the migrations.
 * Development only — it refuses to touch a database whose URL does not look
 * local unless ALLOW_DESTRUCTIVE_RESET is set.
 */
import 'dotenv/config';
import pg from 'pg';
import { migrate } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
if (!isLocal && process.env.ALLOW_DESTRUCTIVE_RESET !== 'yes') {
  console.error(
    'Refusing to reset a non-local database. Set ALLOW_DESTRUCTIVE_RESET=yes if you really mean it.',
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await pool.end();

const applied = await migrate(url);
console.log(`Reset complete. Applied: ${applied.join(', ')}`);
