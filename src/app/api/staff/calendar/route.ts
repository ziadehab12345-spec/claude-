import { db } from '@/lib/db';
import { ok, route, parseQuery, requireSession } from '@/lib/api';
import { calendarQuerySchema } from '@/lib/validation';
import { buildAvailabilityCalendar } from '@/lib/availability';
import { eachDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';

/** GET /api/staff/calendar?from=&to=&serviceType= — the unit x date grid. */
export const GET = route(async (req: Request) => {
  await requireSession(req);
  const q = parseQuery(req, calendarQuerySchema);
  const rows = await buildAvailabilityCalendar(db, q);
  return ok({ from: q.from, to: q.to, dates: eachDate(q.from, q.to), rows });
});
