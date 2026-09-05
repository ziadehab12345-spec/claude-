import { Kysely, PostgresDialect, sql } from 'kysely';
import type { Transaction } from 'kysely';
import pg from 'pg';
import type { Database } from './schema';

/**
 * node-postgres type parsers.
 *
 * DATE (1082) would otherwise come back as a JS Date interpreted in the
 * server's local timezone, which shifts calendar dates by a day whenever the
 * server is not in Cairo. We keep the raw 'YYYY-MM-DD' string instead.
 * INT8 (20) would come back as a string; money is bounded well inside
 * Number.MAX_SAFE_INTEGER so a number is safe and far easier to work with.
 */
pg.types.setTypeParser(1082, (value: string) => value);
pg.types.setTypeParser(20, (value: string) => Number(value));
// NUMERIC stays a string on purpose — nothing in this schema uses it for money.

declare global {
  // eslint-disable-next-line no-var
  var __ahlDb: Kysely<Database> | undefined;
  // eslint-disable-next-line no-var
  var __ahlPool: pg.Pool | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill it in.',
    );
  }
  return url;
}

export function createDb(url: string = connectionString()): Kysely<Database> {
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: true } : undefined,
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

/**
 * Shared instance. Cached on globalThis so Next.js hot reload does not open a
 * new pool on every edit.
 */
export const db: Kysely<Database> =
  globalThis.__ahlDb ?? (globalThis.__ahlDb = createDb());

/**
 * Wraps a value for a jsonb column.
 *
 * node-postgres serialises a JS array as a Postgres array literal, not as
 * JSON, so passing one straight into a jsonb column fails at the database.
 * Stringifying first is what makes it land as JSON. Reads come back already
 * parsed, so this is only needed on the way in.
 */
export function toJsonb(value: unknown): string {
  return JSON.stringify(value);
}

export { sql };
export type DB = Kysely<Database>;
/**
 * Anything you can run a query on: the root instance or an open transaction.
 * Every function that touches the database takes one of these so it can be
 * composed into a caller's transaction.
 */
export type Queryable = Kysely<Database> | Transaction<Database>;
