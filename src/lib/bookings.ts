/**
 * Booking service layer.
 *
 * Every booking, from any channel, is created here. There is no second path.
 */
import { sql } from 'kysely';
import type { Queryable, DB } from './db';
import { db as defaultDb } from './db';
import type { Booking, BookingSource, BookingStatus, PaymentStatus, Service } from './schema';
import { assertValidRange, lockUnitAndCheck } from './availability';
import { countDays, todayInCairo } from './dates';
import { recordAudit } from './audit';
import {
  AppError,
  isExclusionViolation,
  notFound,
  unavailable,
  validationError,
} from './errors';

/**
 * Allowed status transitions.
 *
 * `cancelled` and `completed` are terminal on purpose. Re-opening a cancelled
 * booking is not a state change — the dates were released the moment it was
 * cancelled and may already belong to someone else. Staff create a new booking
 * instead, which goes through the availability check like everything else.
 */
export const STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  cancelled: [],
  completed: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Price for a range, from the service's base price.
 *
 * Cars and stays bill per day/night in the range. Fast Track is a flat fee per
 * service regardless of the one-day range it occupies.
 */
export function computePrice(service: Pick<Service, 'type' | 'base_price_minor'>, startDate: string, endDate: string): number {
  const base = Number(service.base_price_minor);
  if (service.type === 'fasttrack') return base;
  return base * countDays(startDate, endDate);
}

/** AC-<2-digit year><6-digit sequence>, e.g. AC-26000042. */
async function nextReference(db: Queryable): Promise<string> {
  const { rows } = await sql<{ n: string }>`SELECT nextval('booking_reference_seq') AS n`.execute(db);
  const n = Number(rows[0]!.n);
  const year = todayInCairo().slice(2, 4);
  return `AC-${year}${String(n).padStart(6, '0')}`;
}

export interface CreateBookingInput {
  unitId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  startDate: string;
  endDate: string;
  flightTime?: string | null;
  flightNumber?: string | null;
  source: BookingSource;
  notes?: string;
  /** Staff only. Overrides the computed price; recorded in the audit trail. */
  priceMinorOverride?: number | null;
  createdByStaffId?: string | null;
  /** Staff only. A manual booking may be created already confirmed. */
  status?: Extract<BookingStatus, 'pending' | 'confirmed'>;
  paymentStatus?: PaymentStatus;
  paymentNotes?: string;
}

/**
 * Creates a booking.
 *
 * Concurrency: the whole thing runs in one transaction that locks the unit row
 * before checking availability, so two simultaneous requests for the same unit
 * serialise. If the check somehow passes anyway, the bookings_no_overlap
 * exclusion constraint rejects the insert and we translate 23P01 into the same
 * "unavailable" error the caller would have got from the check. Double-booking
 * is impossible in both orderings.
 */
export async function createBooking(
  input: CreateBookingInput,
  db: DB = defaultDb,
): Promise<Booking> {
  assertValidRange({ startDate: input.startDate, endDate: input.endDate });

  if (input.source === 'staff_manual' && !input.createdByStaffId) {
    throw validationError('A manual booking must record the staff member who created it');
  }
  if (input.source === 'online' && input.priceMinorOverride != null) {
    throw validationError('Price overrides are a staff action');
  }

  return db.transaction().execute(async (trx) => {
    const unit = await trx
      .selectFrom('units')
      .innerJoin('services', 'services.id', 'units.service_id')
      .where('units.id', '=', input.unitId)
      .select([
        'units.id as unit_id',
        'services.id as service_id',
        'services.type as service_type',
        'services.base_price_minor',
        'services.currency',
      ])
      .executeTakeFirst();

    if (!unit) throw notFound('That unit does not exist');

    if (unit.service_type === 'fasttrack') {
      if (countDays(input.startDate, input.endDate) !== 1) {
        throw validationError('A Fast Track booking covers exactly one day');
      }
      if (!input.flightTime) {
        throw validationError('flight_time is required for a Fast Track booking');
      }
    }

    const availability = await lockUnitAndCheck(trx, {
      unitId: input.unitId,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    if (!availability.available) {
      throw unavailable(unavailableMessage(availability.reason), { reason: availability.reason });
    }

    const computed = computePrice(
      { type: unit.service_type, base_price_minor: unit.base_price_minor },
      input.startDate,
      input.endDate,
    );
    const overridden = input.priceMinorOverride != null && input.priceMinorOverride !== computed;
    const price = input.priceMinorOverride ?? computed;
    if (price < 0) throw validationError('Price cannot be negative');

    const reference = await nextReference(trx);

    let booking: Booking;
    try {
      booking = await trx
        .insertInto('bookings')
        .values({
          reference,
          unit_id: input.unitId,
          service_id: unit.service_id,
          customer_name: input.customerName.trim(),
          customer_phone: input.customerPhone.trim(),
          customer_email: input.customerEmail?.trim() || null,
          start_date: input.startDate,
          end_date: input.endDate,
          flight_time: input.flightTime ?? null,
          flight_number: input.flightNumber?.trim() || null,
          status: input.status ?? 'pending',
          source: input.source,
          price_minor: price,
          currency: unit.currency,
          price_overridden: overridden,
          payment_status: input.paymentStatus ?? 'unpaid',
          payment_notes: input.paymentNotes ?? '',
          notes: input.notes ?? '',
          created_by_staff_id: input.createdByStaffId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      // Last line of defence. Reached only if two transactions raced past the
      // row lock; the database refused the overlap and we report it cleanly.
      if (isExclusionViolation(err)) {
        throw unavailable('Those dates were just taken. Please choose different dates.', {
          reason: 'booking_conflict',
        });
      }
      throw err;
    }

    await recordAudit(trx, {
      actorUserId: input.createdByStaffId ?? null,
      actorLabel: input.source === 'online' ? 'public' : 'staff',
      action: 'booking.created',
      entity: 'booking',
      entityId: booking.id,
      details: {
        reference: booking.reference,
        source: input.source,
        status: booking.status,
        unit_id: input.unitId,
        start_date: input.startDate,
        end_date: input.endDate,
        price_minor: price,
        computed_price_minor: computed,
        price_overridden: overridden,
      },
    });

    return booking;
  });
}

function unavailableMessage(reason: string | undefined): string {
  switch (reason) {
    case 'booking_conflict':
      return 'That unit is already booked for those dates';
    case 'blocked':
      return 'That unit is out of service for those dates';
    case 'unit_inactive':
    case 'service_inactive':
      return 'That unit is not currently bookable';
    case 'unit_not_found':
      return 'That unit does not exist';
    default:
      return 'That unit is not available for those dates';
  }
}

export async function getBookingById(db: Queryable, id: string) {
  return db
    .selectFrom('bookings')
    .innerJoin('units', 'units.id', 'bookings.unit_id')
    .innerJoin('services', 'services.id', 'bookings.service_id')
    .where('bookings.id', '=', id)
    .selectAll('bookings')
    .select([
      'units.identifier as unit_identifier',
      'units.label_en as unit_label_en',
      'units.label_ar as unit_label_ar',
      'services.type as service_type',
      'services.name_en as service_name_en',
      'services.name_ar as service_name_ar',
      'services.slug as service_slug',
    ])
    .executeTakeFirst();
}

export async function getBookingByReference(db: Queryable, reference: string) {
  return db
    .selectFrom('bookings')
    .innerJoin('units', 'units.id', 'bookings.unit_id')
    .innerJoin('services', 'services.id', 'bookings.service_id')
    .where('bookings.reference', '=', reference.trim().toUpperCase())
    .selectAll('bookings')
    .select([
      'units.identifier as unit_identifier',
      'services.type as service_type',
      'services.name_en as service_name_en',
      'services.name_ar as service_name_ar',
    ])
    .executeTakeFirst();
}

export interface ListBookingsFilters {
  status?: BookingStatus[];
  serviceType?: string;
  serviceId?: string;
  paymentStatus?: PaymentStatus[];
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listBookings(db: Queryable, filters: ListBookingsFilters = {}) {
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  let q = db
    .selectFrom('bookings')
    .innerJoin('units', 'units.id', 'bookings.unit_id')
    .innerJoin('services', 'services.id', 'bookings.service_id')
    .selectAll('bookings')
    .select([
      'units.identifier as unit_identifier',
      'services.type as service_type',
      'services.name_en as service_name_en',
      'services.name_ar as service_name_ar',
    ]);

  if (filters.status?.length) q = q.where('bookings.status', 'in', filters.status);
  if (filters.paymentStatus?.length) q = q.where('bookings.payment_status', 'in', filters.paymentStatus);
  if (filters.serviceType) q = q.where('services.type', '=', filters.serviceType as never);
  if (filters.serviceId) q = q.where('bookings.service_id', '=', filters.serviceId);
  // Overlap, not containment: a stay spanning the window should appear in it.
  if (filters.from) q = q.where('bookings.end_date', '>', filters.from);
  if (filters.to) q = q.where('bookings.start_date', '<', filters.to);
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    q = q.where((eb) =>
      eb.or([
        eb('bookings.customer_name', 'ilike', term),
        eb('bookings.customer_phone', 'ilike', term),
        eb('bookings.reference', 'ilike', term),
        eb('bookings.customer_email', 'ilike', term),
      ]),
    );
  }

  const rows = await q
    .orderBy('bookings.start_date', 'desc')
    .orderBy('bookings.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  return rows;
}

export async function countBookings(db: Queryable, filters: ListBookingsFilters = {}) {
  let q = db
    .selectFrom('bookings')
    .innerJoin('services', 'services.id', 'bookings.service_id')
    .select(({ fn }) => fn.countAll<number>().as('count'));

  if (filters.status?.length) q = q.where('bookings.status', 'in', filters.status);
  if (filters.paymentStatus?.length) q = q.where('bookings.payment_status', 'in', filters.paymentStatus);
  if (filters.serviceType) q = q.where('services.type', '=', filters.serviceType as never);
  if (filters.serviceId) q = q.where('bookings.service_id', '=', filters.serviceId);
  if (filters.from) q = q.where('bookings.end_date', '>', filters.from);
  if (filters.to) q = q.where('bookings.start_date', '<', filters.to);

  const row = await q.executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function changeBookingStatus(
  params: { bookingId: string; to: BookingStatus; actorUserId: string; reason?: string },
  db: DB = defaultDb,
): Promise<Booking> {
  return db.transaction().execute(async (trx) => {
    const current = await trx
      .selectFrom('bookings')
      .selectAll()
      .where('id', '=', params.bookingId)
      .forUpdate()
      .executeTakeFirst();

    if (!current) throw notFound('Booking not found');
    if (current.status === params.to) return current;

    if (!canTransition(current.status, params.to)) {
      throw new AppError(
        'conflict',
        `A ${current.status} booking cannot be changed to ${params.to}`,
        { from: current.status, to: params.to, allowed: STATUS_TRANSITIONS[current.status] },
      );
    }

    const updated = await trx
      .updateTable('bookings')
      .set({ status: params.to })
      .where('id', '=', params.bookingId)
      .returningAll()
      .executeTakeFirstOrThrow();

    await recordAudit(trx, {
      actorUserId: params.actorUserId,
      actorLabel: 'staff',
      action: 'booking.status_changed',
      entity: 'booking',
      entityId: params.bookingId,
      details: { from: current.status, to: params.to, reason: params.reason ?? '' },
    });

    return updated;
  });
}

export interface UpdateBookingInput {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  priceMinor?: number;
  paymentStatus?: PaymentStatus;
  paymentNotes?: string;
  notes?: string;
  flightTime?: string | null;
  flightNumber?: string | null;
  startDate?: string;
  endDate?: string;
  unitId?: string;
}

/**
 * Staff edit of an existing booking.
 *
 * If dates or unit change, the move is re-checked against the availability
 * engine excluding the booking itself, so a booking never blocks its own move.
 */
export async function updateBooking(
  params: { bookingId: string; actorUserId: string; input: UpdateBookingInput },
  db: DB = defaultDb,
): Promise<Booking> {
  const { bookingId, actorUserId, input } = params;

  return db.transaction().execute(async (trx) => {
    const current = await trx
      .selectFrom('bookings')
      .selectAll()
      .where('id', '=', bookingId)
      .forUpdate()
      .executeTakeFirst();

    if (!current) throw notFound('Booking not found');
    if (current.status === 'cancelled' || current.status === 'completed') {
      throw new AppError('conflict', `A ${current.status} booking can no longer be edited`);
    }

    const nextUnitId = input.unitId ?? current.unit_id;
    const nextStart = input.startDate ?? current.start_date;
    const nextEnd = input.endDate ?? current.end_date;
    const rangeChanged =
      nextUnitId !== current.unit_id ||
      nextStart !== current.start_date ||
      nextEnd !== current.end_date;

    if (rangeChanged) {
      assertValidRange({ startDate: nextStart, endDate: nextEnd });
      const availability = await lockUnitAndCheck(trx, {
        unitId: nextUnitId,
        startDate: nextStart,
        endDate: nextEnd,
        excludeBookingId: bookingId,
      });
      if (!availability.available) {
        throw unavailable(unavailableMessage(availability.reason), { reason: availability.reason });
      }
    }

    // updated_at is set by the bookings_set_updated_at trigger.
    const patch: Record<string, unknown> = {};
    if (input.customerName !== undefined) patch.customer_name = input.customerName.trim();
    if (input.customerPhone !== undefined) patch.customer_phone = input.customerPhone.trim();
    if (input.customerEmail !== undefined) patch.customer_email = input.customerEmail?.trim() || null;
    if (input.paymentStatus !== undefined) patch.payment_status = input.paymentStatus;
    if (input.paymentNotes !== undefined) patch.payment_notes = input.paymentNotes;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.flightTime !== undefined) patch.flight_time = input.flightTime;
    if (input.flightNumber !== undefined) patch.flight_number = input.flightNumber;
    if (rangeChanged) {
      patch.unit_id = nextUnitId;
      patch.start_date = nextStart;
      patch.end_date = nextEnd;
      if (nextUnitId !== current.unit_id) {
        const unit = await trx
          .selectFrom('units')
          .select('service_id')
          .where('id', '=', nextUnitId)
          .executeTakeFirstOrThrow();
        patch.service_id = unit.service_id;
      }
    }
    if (input.priceMinor !== undefined) {
      if (input.priceMinor < 0) throw validationError('Price cannot be negative');
      patch.price_minor = input.priceMinor;
      patch.price_overridden = true;
    }

    // Nothing to change: return the row as it stands rather than emitting an
    // UPDATE with an empty SET list.
    if (Object.keys(patch).length === 0) return current;

    let updated: Booking;
    try {
      updated = await trx
        .updateTable('bookings')
        .set(patch as never)
        .where('id', '=', bookingId)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw unavailable('Those dates were just taken. Please choose different dates.', {
          reason: 'booking_conflict',
        });
      }
      throw err;
    }

    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(patch)) {
      const before = (current as Record<string, unknown>)[key];
      const after = (updated as Record<string, unknown>)[key];
      if (String(before) !== String(after)) changed[key] = { from: before, to: after };
    }

    if (Object.keys(changed).length > 0) {
      await recordAudit(trx, {
        actorUserId,
        actorLabel: 'staff',
        action: input.priceMinor !== undefined ? 'booking.price_overridden' : 'booking.updated',
        entity: 'booking',
        entityId: bookingId,
        details: { changed },
      });
    }

    return updated;
  });
}
