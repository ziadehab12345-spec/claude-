import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { route, parseJson } from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import { authenticate, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** POST /api/auth/login — staff/admin sign in. */
export const POST = route(async (req: Request) => {
  const ip = clientIp(req.headers);
  await enforceRateLimit(db, `login:${ip}`, 10, 900);

  const { email, password } = await parseJson(req, loginSchema);
  const user = await authenticate(db, email, password);

  if (!user) {
    // Deliberately identical for a wrong password, an unknown email and a
    // deactivated account, so the endpoint cannot enumerate staff.
    throw new AppError('unauthenticated', 'Incorrect email or password');
  }

  const token = await createSessionToken(user);
  const res = NextResponse.json({ data: { user } }, { status: 200 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);

  await recordAudit(db, {
    actorUserId: user.id,
    actorLabel: 'staff',
    action: 'auth.login',
    entity: 'user',
    entityId: user.id,
    details: { ip },
  });

  return res;
});
