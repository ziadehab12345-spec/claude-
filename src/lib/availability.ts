/**
 * Availability engine.
 *
 * This is the single deterministic answer to "can this unit be booked for these
 * dates". Every booking path — public website, staff dashboard, seed script,
 * anything added later — goes through here, and the database enforces the same
 * rule underneath via the bookings_no_overlap exclusion constraint.
 *
 * There is deliberately no AI, no heuristic and no client-side check involved.
 *
 * A unit is UNAVAILABLE for [start, end) if any of:
 *   - the unit is inactive, or its service is inactive
 *   - an existing booking on that unit with status pending|confirmed overlaps
 *   - a unit_block on that unit overlaps
 */
import { sql } from 'kysely';
import type { Queryable } from './db';
import type { ServiceType, Unit } from './schema';
import { countDays, isValidDateString } from './dates';
import { validationError } from './errors';

export interface DateRangeInput {
  startDate: string;
  endDate: string;
}

/** Longest bookable stretch accepted in one booking. Guards against typos and abuse. */
export const MAX_BOOKING_DAYS = 365;

/**
 * Validates a half-open range. Throws a validation error rather than returning
 * a boolean so that no caller can forget to check the result.
 */
export function assertValidRange({ startDate, endDate }: DateRangeInput): void {
  if (!isValidDateString(startDate)) throw validationError('start_date must be a valid YYYY-MM-DD date');
  if (!isValidDateString(endDate)) throw validationError('end_date must be a valid YYYY-MM-DD date');
  if (endDate <= startDate) throw validationError('end_date must be after start_date');
  if (countDays(startDate, endDate) > MAX_BOOKING_DAYS) {
    throw validationError(`A booking cannot exceed ${MAX_BOOKING_DAYS} days`);
  }
}

const range = (start: string, end: string) => sql<string>`daterange(${start}::date, ${end}::date, '[)')`;

/**
 * Units of a service that are free for the whole range.
 * Ordered by identifier so results are stable between calls.
 */
export async function findAvailableUnits(
  db: Queryable,
  params: { serviceId: string } & DateRangeInput,
): Promise<Unit[]> {
  assertValidRange(params);
  const { serviceId, startDate, endDate } = params;
  const occupied = range(startDate, endDate);

  return db
    .selectFrom('units')
    .innerJoin('services', 'services.id', 'units.service_id')
    .where('units.service_id', '=', serviceId)
    .where('units.active', '=', true)
    .where('services.active', '=', true)
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom('bookings')
            .select('bookings.id')
            .whereRef('bookings.unit_id', '=', 'units.id')
            .where('bookings.status', 'in', ['pending', 'confirmed'])
            .where(sql<boolean>`bookings.occupancy && ${occupied}`),
        ),
      ),
    )
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom('unit_blocks')
            .select('unit_blocks.id')
            .whereRef('unit_blocks.unit_id', '=', 'units.id')
            .where(sql<boolean>`unit_blocks.occupancy && ${occupied}`),
        ),
      ),
    )
    .selectAll('units')
    .orderBy('units.identifier', 'asc')
    .execute();
}

/** How many units of a service are free for the range. Drives "3 cars left". */
export async function countAvailableUnits(
  db: Queryable,
  params: { serviceId: string } & DateRangeInput,
): Promise<number> {
  return (await findAvailableUnits(db, params)).length;
}

export interface UnitAvailability {
  available: boolean;
  reason?: 'unit_inactive' | 'service_inactive' | 'booking_conflict' | 'blocked' | 'unit_not_found';
  conflictingBookingIds: string[];
}

/**
 * Whether one specific unit is free for the range.
 *
 * `excludeBookingId` lets a staff member move an existing booking's dates
 * without the booking colliding with itself.
 *
 * IMPORTANT: a true result here is not a reservation. It is only safe when read
 * inside the same transaction that writes the booking, and even then the
 * database constraint is what actually guarantees exclusivity. See
 * createBooking() in src/lib/bookings.ts.
 */
export async function checkUnitAvailability(
  db: Queryable,
  params: { unitId: string; excludeBookingId?: string } & DateRangeInput,
): Promise<UnitAvailability> {
  assertValidRange(params);
  const { unitId, startDate, endDate, excludeBookingId } = params;
  const occupied = range(startDate, endDate);

  const unit = await db
    .selectFrom('units')
    .innerJoin('services', 'services.id', 'units.service_id')
    .where('units.id', '=', unitId)
    .select(['units.id', 'units.active as unit_active', 'services.active as service_active'])
    .executeTakeFirst();

  if (!unit) return { available: false, reason: 'unit_not_found', conflictingBookingIds: [] };
  if (!unit.unit_active) return { available: false, reason: 'unit_inactive', conflictingBookingIds: [] };
  if (!unit.service_active) {
    return { available: false, reason: 'service_inactive', conflictingBookingIds: [] };
  }

  let conflicts = db
    .selectFrom('bookings')
    .select('bookings.id')
    .where('bookings.unit_id', '=', unitId)
    .where('bookings.status', 'in', ['pending', 'confirmed'])
    .where(sql<boolean>`bookings.occupancy && ${occupied}`);

  if (excludeBookingId) conflicts = conflicts.where('bookings.id', '!=', excludeBookingId);

  const conflictRows = await conflicts.execute();
  if (conflictRows.length > 0) {
    return {
      available: false,
      reason: 'booking_conflict',
      conflictingBookingIds: conflictRows.map((r) => r.id),
    };
  }

  const block = await db
    .selectFrom('unit_blocks')
    .select('unit_blocks.id')
    .where('unit_blocks.unit_id', '=', unitId)
    .where(sql<boolean>`unit_blocks.occupancy && ${occupied}`)
    .executeTakeFirst();

  if (block) return { available: false, reason: 'blocked', conflictingBookingIds: [] };

  return { available: true, conflictingBookingIds: [] };
}

/**
 * Locks the unit row FOR UPDATE, then checks availability.
 *
 * Two concurrent bookings for the same unit serialise on this lock, so the
 * loser sees the winner's row and gets a clean "unavailable" error instead of a
 * raw constraint violation. The constraint still backs this up; the lock only
 * improves the error message and avoids burning a transaction.
 */
export async function lockUnitAndCheck(
  db: Queryable,
  params: { unitId: string; excludeBookingId?: string } & DateRangeInput,
): Promise<UnitAvailability> {
  const locked = await db
    .selectFrom('units')
    .select('id')
    .where('id', '=', params.unitId)
    .forUpdate()
    .executeTakeFirst();

  if (!locked) return { available: false, reason: 'unit_not_found', conflictingBookingIds: [] };
  return checkUnitAvailability(db, params);
}

export type DayState = 'available' | 'booked' | 'blocked';

export interface CalendarCell {
  date: string;
  state: DayState;
  bookingId?: string;
  bookingReference?: string;
  bookingStatus?: string;
  customerName?: string;
}

export interface CalendarRow {
  unitId: string;
  identifier: string;
  labelEn: string;
  labelAr: string;
  serviceId: string;
  serviceNameEn: string;
  serviceNameAr: string;
  serviceType: ServiceType;
  cells: CalendarCell[];
}

/**
 * The dashboard availability grid: one row per unit, one cell per date in
 * [from, to). Built from two range queries rather than one query per day.
 */
export async function buildAvailabilityCalendar(
  db: Queryable,
  params: { from: string; to: string; serviceType?: ServiceType; serviceId?: string },
): Promise<CalendarRow[]> {
  assertValidRange({ startDate: params.from, endDate: params.to });
  const window = range(params.from, params.to);

  let unitsQuery = db
    .selectFrom('units')
    .innerJoin('services', 'services.id', 'units.service_id')
    .where('units.active', '=', true)
    .select([
      'units.id as unit_id',
      'units.identifier',
      'units.label_en',
      'units.label_ar',
      'services.id as service_id',
      'services.name_en as service_name_en',
      'services.name_ar as service_name_ar',
      'services.type as service_type',
      'services.sort_order',
    ])
    .orderBy('services.sort_order', 'asc')
    .orderBy('services.name_en', 'asc')
    .orderBy('units.identifier', 'asc');

  if (params.serviceType) unitsQuery = unitsQuery.where('services.type', '=', params.serviceType);
  if (params.serviceId) unitsQuery = unitsQuery.where('services.id', '=', params.serviceId);

  const units = await unitsQuery.execute();
  if (units.length === 0) return [];

  const unitIds = units.map((u) => u.unit_id);

  const bookings = await db
    .selectFrom('bookings')
    .select([
      'id',
      'reference',
      'unit_id',
      'start_date',
      'end_date',
      'status',
      'customer_name',
    ])
    .where('unit_id', 'in', unitIds)
    .where('status', 'in', ['pending', 'confirmed'])
    .where(sql<boolean>`bookings.occupancy && ${window}`)
    .execute();

  const blocks = await db
    .selectFrom('unit_blocks')
    .select(['id', 'unit_id', 'start_date', 'end_date', 'reason'])
    .where('unit_id', 'in', unitIds)
    .where(sql<boolean>`unit_blocks.occupancy && ${window}`)
    .execute();

  const { eachDate } = await import('./dates');
  const dates = eachDate(params.from, params.to);

  const bookingsByUnit = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const list = bookingsByUnit.get(b.unit_id) ?? [];
    list.push(b);
    bookingsByUnit.set(b.unit_id, list);
  }
  const blocksByUnit = new Map<string, typeof blocks>();
  for (const b of blocks) {
    const list = blocksByUnit.get(b.unit_id) ?? [];
    list.push(b);
    blocksByUnit.set(b.unit_id, list);
  }

  return units.map((u) => {
    const ub = bookingsByUnit.get(u.unit_id) ?? [];
    const bl = blocksByUnit.get(u.unit_id) ?? [];
    const cells: CalendarCell[] = dates.map((date) => {
      const booking = ub.find((b) => b.start_date <= date && date < b.end_date);
      if (booking) {
        return {
          date,
          state: 'booked',
          bookingId: booking.id,
          bookingReference: booking.reference,
          bookingStatus: booking.status,
          customerName: booking.customer_name,
        };
      }
      if (bl.some((b) => b.start_date <= date && date < b.end_date)) {
        return { date, state: 'blocked' };
      }
      return { date, state: 'available' };
    });

    return {
      unitId: u.unit_id,
      identifier: u.identifier,
      labelEn: u.label_en,
      labelAr: u.label_ar,
      serviceId: u.service_id,
      serviceNameEn: u.service_name_en,
      serviceNameAr: u.service_name_ar,
      serviceType: u.service_type,
      cells,
    };
  });
}
