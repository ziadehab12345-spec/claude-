import { db } from '@/lib/db';
import { ok, route, parseJson, requireSession } from '@/lib/api';
import { statusChangeSchema } from '@/lib/validation';
import { changeBookingStatus } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

/**
 * POST /api/staff/bookings/:id/status — confirm, cancel or complete a booking.
 * Transitions are validated in the service layer; the change is audited.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req);
  const { id } = await ctx.params;
  const { status, reason } = await parseJson(req, statusChangeSchema);

  const booking = await changeBookingStatus(
    { bookingId: id, to: status, actorUserId: user.id, reason },
    db,
  );
  return ok(booking);
});
