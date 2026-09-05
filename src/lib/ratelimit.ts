import { sql } from 'kysely';
import type { Queryable } from './db';
import { rateLimited } from './errors';

/**
 * Fixed-window rate limiter backed by Postgres.
 *
 * In-memory limiting is useless on Vercel because each serverless instance has
 * its own memory, so an attacker gets N times the allowance. The database is
 * already the shared source of truth, so the counter lives there.
 */
export interface RateLimitResult {
  allowed: boolean;
  hits: number;
  limit: number;
  resetsAt: Date;
}

export async function consumeRateLimit(
  db: Queryable,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const row = await db
    .insertInto('rate_limits')
    .values({ bucket_key: key, window_start: windowStart, hits: 1 })
    .onConflict((oc) =>
      oc.columns(['bucket_key', 'window_start']).doUpdateSet({
        hits: sql<number>`rate_limits.hits + 1`,
      }),
    )
    .returning('hits')
    .executeTakeFirstOrThrow();

  return {
    allowed: row.hits <= limit,
    hits: row.hits,
    limit,
    resetsAt: new Date(windowStart.getTime() + windowMs),
  };
}

export async function enforceRateLimit(
  db: Queryable,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const result = await consumeRateLimit(db, key, limit, windowSeconds);
  if (!result.allowed) throw rateLimited();
}

/** Housekeeping: drop windows older than a day. Safe to call from any request. */
export async function pruneRateLimits(db: Queryable): Promise<void> {
  await db
    .deleteFrom('rate_limits')
    .where('window_start', '<', sql<Date>`now() - interval '1 day'`)
    .execute();
}

/**
 * Best-effort client IP from proxy headers.
 *
 * These headers are only trustworthy behind a proxy that overwrites them —
 * Vercel and most managed platforms do. On a self-hosted deployment, make sure
 * the reverse proxy sets x-forwarded-for rather than passing a client value
 * through, or the limit can be evaded by forging the header.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? 'unknown';
}
