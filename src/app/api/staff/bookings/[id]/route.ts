import { db } from '@/lib/db';
import { ok, route, parseJson, requireSession } from '@/lib/api';
import { updateBookingSchema } from '@/lib/validation';
import { getBookingById, updateBooking } from '@/lib/bookings';
import { listAuditForEntity } from '@/lib/audit';
import { forbidden, notFound } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** GET /api/staff/bookings/:id — full booking detail plus its audit trail. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession(req);
  const { id } = await ctx.params;
  const booking = await getBookingById(db, id);
  if (!booking) throw notFound('Booking not found');
  const audit = await listAuditForEntity(db, 'booking', id);
  return ok({ booking, audit });
});

/** PATCH /api/staff/bookings/:id — edit customer details, dates, payment. */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req);
  const { id } = await ctx.params;
  const input = await parseJson(req, updateBookingSchema);

  // Pricing is an admin responsibility; staff record payment, not amounts.
  if (input.priceMinor !== undefined && user.role !== 'admin') {
    throw forbidden('Only an administrator can change a booking price');
  }

  const booking = await updateBooking({ bookingId: id, actorUserId: user.id, input }, db);
  return ok(booking);
});
