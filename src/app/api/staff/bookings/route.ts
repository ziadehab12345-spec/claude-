import { db } from '@/lib/db';
import { ok, created, route, parseJson, parseQuery, requireSession } from '@/lib/api';
import { bookingListQuerySchema, staffBookingSchema } from '@/lib/validation';
import { createBooking, listBookings, countBookings } from '@/lib/bookings';
import type { BookingStatus, PaymentStatus } from '@/lib/schema';

export const dynamic = 'force-dynamic';

const csv = <T extends string>(v: string | undefined): T[] | undefined =>
  v ? (v.split(',').map((s) => s.trim()).filter(Boolean) as T[]) : undefined;

/** GET /api/staff/bookings — filtered bookings list for the dashboard. */
export const GET = route(async (req: Request) => {
  await requireSession(req);
  const q = parseQuery(req, bookingListQuerySchema);

  const filters = {
    status: csv<BookingStatus>(q.status),
    paymentStatus: csv<PaymentStatus>(q.paymentStatus),
    serviceType: q.serviceType,
    serviceId: q.serviceId,
    from: q.from,
    to: q.to,
    search: q.search,
    limit: q.limit ?? 50,
    offset: q.offset ?? 0,
  };

  const [rows, total] = await Promise.all([
    listBookings(db, filters),
    countBookings(db, filters),
  ]);

  return ok({ bookings: rows, total, limit: filters.limit, offset: filters.offset });
});

/**
 * POST /api/staff/bookings — manual entry for a booking taken by phone or
 * WhatsApp. Goes through exactly the same availability engine and the same
 * database constraint as a public booking. There is no bypass.
 */
export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  const input = await parseJson(req, staffBookingSchema);

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
      source: 'staff_manual',
      createdByStaffId: user.id,
      status: input.status ?? 'confirmed',
      paymentStatus: input.paymentStatus,
      paymentNotes: input.paymentNotes,
      // Only an admin may set a price other than the catalogue price.
      priceMinorOverride: user.role === 'admin' ? (input.priceMinorOverride ?? null) : null,
    },
    db,
  );

  return created(booking);
});
