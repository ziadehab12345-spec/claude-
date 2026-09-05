import { cookies } from 'next/headers';
import { SESSION_COOKIE, readSessionToken, type SessionUser } from './auth';

/** Reads the signed session cookie on the server. Returns null when signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}
