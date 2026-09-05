/**
 * HTTP plumbing shared by every route handler: uniform JSON envelopes, one
 * place that turns an error into a status code, and the auth guards.
 */
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { AppError } from './errors';
import { db } from './db';
import { readSessionToken, SESSION_COOKIE, type SessionUser } from './session-token';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/**
 * Turns anything thrown inside a handler into a response.
 * Unexpected errors are logged server-side and reported generically, so an
 * internal message or SQL fragment never reaches a customer.
 */
export function handleError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return fail(err.code, err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return fail('validation_error', 'Some fields need attention', 400, flattenZod(err));
  }
  console.error('[api] unhandled error', err);
  return fail('internal_error', 'Something went wrong. Please try again.', 500);
}

export function flattenZod(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Wraps a handler so no route has to repeat the try/catch. */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      return handleError(err);
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError('validation_error', 'Request body must be valid JSON');
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return schema.parse(params);
}

/** Session from the request cookie. Route handlers use this, not middleware. */
export async function sessionFromRequest(req: Request): Promise<SessionUser | null> {
  const cookie = req.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  return readSessionToken(decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)));
}

/**
 * Authenticates the request AND re-checks the account against the database.
 *
 * The JWT alone is not enough: an admin who deactivates a staff member or
 * demotes them expects that to take effect immediately, not whenever the token
 * happens to expire. Every protected route pays one indexed lookup for that.
 */
export async function requireSession(req: Request, role?: 'admin'): Promise<SessionUser> {
  const session = await sessionFromRequest(req);
  if (!session) throw new AppError('unauthenticated', 'Sign in required');

  const user = await db
    .selectFrom('users')
    .select(['id', 'name', 'email', 'role', 'active'])
    .where('id', '=', session.id)
    .executeTakeFirst();

  if (!user || !user.active) {
    throw new AppError('unauthenticated', 'Your session is no longer valid. Please sign in again.');
  }
  if (role === 'admin' && user.role !== 'admin') {
    throw new AppError('forbidden', 'This action is restricted to administrators');
  }

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
