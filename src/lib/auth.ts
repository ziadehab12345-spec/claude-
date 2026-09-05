/**
 * Staff/admin authentication.
 *
 * Customers have no accounts in v1 — a public booking is tied to the name,
 * phone and email typed at checkout. Only the dashboard is behind a login.
 *
 * Sessions are stateless JWTs in an httpOnly, SameSite=Lax cookie, signed with
 * AUTH_SECRET. The user base is a handful of people, so there is no reason for
 * a session table or an external identity provider.
 */
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { Queryable } from './db';
import type { UserRole } from './schema';
import { forbidden, unauthenticated } from './errors';

export const SESSION_COOKIE = 'ahl_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours — one working day
const BCRYPT_ROUNDS = 12;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      'AUTH_SECRET must be set to at least 32 characters. Generate one with: openssl rand -base64 48',
    );
  }
  return new TextEncoder().encode(value);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (!payload.sub || (payload.role !== 'admin' && payload.role !== 'staff')) return null;
    return {
      id: payload.sub,
      name: String(payload.name ?? ''),
      email: String(payload.email ?? ''),
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
} as const;

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
