/**
 * Session tokens — the half of authentication that must run on the Edge.
 *
 * src/middleware.ts runs in the Edge Runtime, which has Web Crypto but not
 * Node's `crypto`. This module therefore uses only `jose` and must never
 * import bcrypt or anything else that reaches for Node built-ins. Password
 * hashing lives in src/lib/auth.ts, which imports this one and not the reverse.
 *
 * Keeping the split is what stops every request dragging bcrypt into the Edge
 * bundle.
 */
// Imported from jose's subpaths rather than its barrel export: the barrel also
// pulls in JWE decryption, which reaches for CompressionStream and warns in the
// Edge Runtime. Only signing and verification are used here.
import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';
import type { UserRole } from './schema';

export const SESSION_COOKIE = 'ahl_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours — one working day

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
