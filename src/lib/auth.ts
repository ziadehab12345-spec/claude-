/**
 * Staff/admin password authentication.
 *
 * Customers have no accounts in v1 — a booking is tied to the name, phone and
 * email typed at checkout. Only the dashboard is behind a login.
 *
 * This module needs Node's crypto through bcrypt, so it must never be imported
 * from Edge code. The token half lives in ./session-token, which the middleware
 * imports instead.
 */
import bcrypt from 'bcryptjs';
import type { Queryable } from './db';
import { forbidden, unauthenticated } from './errors';
import type { SessionUser } from './session-token';

export {
  SESSION_COOKIE,
  createSessionToken,
  readSessionToken,
  sessionCookieOptions,
  type SessionUser,
} from './session-token';

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Authenticates an email/password pair.
 *
 * A missing user and a wrong password return the same result and take roughly
 * the same time, so the endpoint cannot be used to enumerate staff accounts.
 */
export async function authenticate(
  db: Queryable,
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', email.trim().toLowerCase())
    .executeTakeFirst();

  // Compare against a dummy hash when there is no user so both paths cost the
  // same, then reject.
  const hash = user?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await verifyPassword(password, hash);

  if (!user || !ok || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) throw unauthenticated();
  return user;
}

export function requireAdmin(user: SessionUser | null): SessionUser {
  const u = requireUser(user);
  if (u.role !== 'admin') throw forbidden('This action is restricted to administrators');
  return u;
}
