import { db } from '@/lib/db';
import { created, route, parseJson } from '@/lib/api';
import { publicBookingSchema } from '@/lib/validation';
import { createBooking } from '@/lib/bookings';
import { clientIp, enforceRateLimit, pruneRateLimits } from '@/lib/ratelimit';
import { validationError } from '@/lib/errors';
import { todayInCairo } from '@/lib/dates';

export const dynamic = 'force-dynamic';

/** A single IP may submit this many public bookings per hour. */
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 3600;

/**
 * POST /api/bookings — public booking submission.
 *
 * Creates a `pending` booking. Price comes from the service's base price, never
 * from the request: a customer cannot set their own price. Staff review and
 * confirm from the dashboard.
 */
export const POST = route(async (req: Request) => {
  const ip = clientIp(req.headers);
  await enforceRateLimit(db, `booking:${ip}`, RATE_LIMIT, RATE_WINDOW_SECONDS);

  const input = await parseJson(req, publicBookingSchema);

  // A customer cannot book the past. Staff can, from the dashboard, to record a
  // booking that was taken by phone days ago.
  if (input.startDate < todayInCairo()) {
    throw validationError('Bookings must start today or later');
  }

  const booking = await createBooking(
    {
      unitId: input.unitId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      flightTime: input.flightTime ?? null,
      flightNumber: input.flightNumber ?? null,
      notes: input.notes ?? '',
      source: 'online',
    },
    db,
  );

  void pruneRateLimits(db).catch(() => {});

  // The customer gets back only what they need to follow up on their booking.
  return created({
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    startDate: booking.start_date,
    endDate: booking.end_date,
    priceMinor: Number(booking.price_minor),
    currency: booking.currency,
  });
});
