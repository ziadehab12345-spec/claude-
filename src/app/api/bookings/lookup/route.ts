import { db } from '@/lib/db';
import { ok, route, parseQuery } from '@/lib/api';
import { z } from 'zod';
import { getBookingByReference } from '@/lib/bookings';
import { notFound } from '@/lib/errors';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  reference: z.string().trim().min(4).max(32),
  phone: z.string().trim().min(4).max(24),
});

/**
 * GET /api/bookings/lookup?reference=…&phone=…
 *
 * Lets a customer check their own booking without an account. The reference
 * alone is not enough — the phone number on the booking must match too, so a
 * guessed reference discloses nothing. Rate limited against brute force.
 */
export const GET = route(async (req: Request) => {
  const ip = clientIp(req.headers);
  await enforceRateLimit(db, `lookup:${ip}`, 20, 3600);

  const { reference, phone } = parseQuery(req, querySchema);
  const booking = await getBookingByReference(db, reference);

  const digits = (v: string) => v.replace(/\D/g, '');
  if (!booking || digits(booking.customer_phone) !== digits(phone)) {
    throw notFound('No booking found for that reference and phone number');
  }

  return ok({
    reference: booking.reference,
    status: booking.status,
    customerName: booking.customer_name,
    startDate: booking.start_date,
    endDate: booking.end_date,
    flightTime: booking.flight_time,
    serviceNameEn: booking.service_name_en,
    serviceNameAr: booking.service_name_ar,
    serviceType: booking.service_type,
    priceMinor: Number(booking.price_minor),
    currency: booking.currency,
    paymentStatus: booking.payment_status,
  });
});
