/**
 * Minimal forward-only migration runner.
 * Applies every db/migrations/*.sql not yet recorded in schema_migrations,
 * in filename order, each inside its own transaction.
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

export async function migrate(connectionString: string): Promise<string[]> {
  const pool = new pg.Pool({ connectionString });
  const applied: string[] = [];
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const sqlText = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sqlText);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`, { cause: err });
      } finally {
        client.release();
      }
    }
    return applied;
  } finally {
    await pool.end();
  }
}

const isDirectRun = process.argv[1]?.endsWith('migrate.ts');
if (isDirectRun) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  migrate(url)
    .then((applied) => {
      console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Already up to date.');
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
