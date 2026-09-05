import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST /api/auth/logout — clears the session cookie. */
export const POST = route(async () => {
  const res = NextResponse.json({ data: { ok: true } }, { status: 200 });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
