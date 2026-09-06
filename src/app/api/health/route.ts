import { NextResponse } from 'next/server';
import { sql } from 'kysely';
import { db } from '@/lib/db';
import { checkEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — is this deployment actually able to serve?
 *
 * Checks the database round-trip rather than just returning 200, because the
 * app booting says nothing about whether it can reach Postgres. Point an
 * uptime monitor at this, not at the homepage.
 *
 * Deliberately terse: it reports which env vars are wrong by name but never
 * their values, and returns no schema or version detail.
 */
export async function GET() {
  const envProblems = checkEnv().map((p) => `${p.variable} ${p.problem}`);

  let database: 'ok' | 'unreachable' = 'unreachable';
  let latencyMs: number | null = null;

  try {
    const started = Date.now();
    await sql`SELECT 1`.execute(db);
    latencyMs = Date.now() - started;
    database = 'ok';
  } catch {
    // The reason is logged by the driver; it must not reach the response.
  }

  const healthy = database === 'ok' && envProblems.length === 0;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      database,
      latencyMs,
      env: envProblems.length === 0 ? 'ok' : envProblems,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
