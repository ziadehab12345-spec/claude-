import { ok, route, requireSession } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/auth/me — the signed-in staff member, re-checked against the DB. */
export const GET = route(async (req: Request) => ok(await requireSession(req)));
