import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { DB } from '@/lib/db';
import { testDb, resetDb, makeService, makeUnit, makeStaff } from './helpers';
import { createBooking, changeBookingStatus, updateBooking, computePrice } from '@/lib/bookings';
import { findAvailableUnits, checkUnitAvailability, buildAvailabilityCalendar } from '@/lib/availability';
import { AppError } from '@/lib/errors';

let db: DB;

beforeAll(async () => {
  db = await testDb();
});
beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await db.destroy();
});

const customer = { customerName: 'Test Customer', customerPhone: '+201222332929' };

describe('the no-double-booking guarantee', () => {
  it('refuses a booking that overlaps an existing pending booking', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);

    await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );

    await expect(
      createBooking(
        { ...customer, unitId: unit.id, startDate: '2026-10-04', endDate: '2026-10-08', source: 'online' },
        db,
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('refuses a booking fully contained inside an existing one', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-10', source: 'online' },
      db,
    );

    await expect(
      createBooking(
        { ...customer, unitId: unit.id, startDate: '2026-10-03', endDate: '2026-10-04', source: 'online' },
        db,
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('allows a booking that starts the day the previous one ends', async () => {
    // Half-open ranges: the check-out day is free for the next guest.
    const service = await makeService(db, { type: 'hotel' });
    const unit = await makeUnit(db, service.id);

    await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );
    const second = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-05', endDate: '2026-10-09', source: 'online' },
      db,
    );

    expect(second.start_date).toBe('2026-10-05');
  });

  it('allows the same dates on a different unit', async () => {
    const service = await makeService(db);
    const a = await makeUnit(db, service.id, { identifier: 'A' });
    const b = await makeUnit(db, service.id, { identifier: 'B' });

    await createBooking(
      { ...customer, unitId: a.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );
    const second = await createBooking(
      { ...customer, unitId: b.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );

    expect(second.unit_id).toBe(b.id);
  });

  it('frees the dates again once a booking is cancelled', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    const first = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );
    await changeBookingStatus(
      { bookingId: first.id, to: 'cancelled', actorUserId: staff.id },
      db,
    );

    const second = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );
    expect(second.id).not.toBe(first.id);
  });

  it('frees the dates once a booking is completed', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    const first = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );
    await changeBookingStatus({ bookingId: first.id, to: 'confirmed', actorUserId: staff.id }, db);
    await changeBookingStatus({ bookingId: first.id, to: 'completed', actorUserId: staff.id }, db);

    const second = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );
    expect(second.status).toBe('pending');
  });

  it('blocks a manual staff booking against an online one, and the reverse', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-11-01', endDate: '2026-11-03', source: 'online' },
      db,
    );

    await expect(
      createBooking(
        {
          ...customer,
          unitId: unit.id,
          startDate: '2026-11-02',
          endDate: '2026-11-04',
          source: 'staff_manual',
          createdByStaffId: staff.id,
        },
        db,
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('lets only one of many simultaneous requests win the same dates', async () => {
    // The real test of the guarantee: 12 concurrent transactions, same unit,
    // same dates. Exactly one may succeed.
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);

    const attempts = Array.from({ length: 12 }, (_, i) =>
      createBooking(
        {
          ...customer,
          customerName: `Racer ${i}`,
          unitId: unit.id,
          startDate: '2026-12-01',
          endDate: '2026-12-05',
          source: 'online',
        },
        db,
      ).then(
        () => 'ok' as const,
        () => 'rejected' as const,
      ),
    );

    const results = await Promise.all(attempts);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);

    const rows = await db
      .selectFrom('bookings')
      .selectAll()
      .where('unit_id', '=', unit.id)
      .where('status', 'in', ['pending', 'confirmed'])
      .execute();
    expect(rows).toHaveLength(1);
  });

  it('cannot be bypassed by writing straight to the database', async () => {
    // Proves the guarantee lives in Postgres, not in the service layer.
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);

    await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );

    await expect(
      db
        .insertInto('bookings')
        .values({
          reference: 'RAW-1',
          unit_id: unit.id,
          service_id: service.id,
          customer_name: 'Bypass',
          customer_phone: '+2',
          start_date: '2026-10-02',
          end_date: '2026-10-03',
          source: 'online',
          price_minor: 1,
        })
        .execute(),
    ).rejects.toMatchObject({ code: '23P01' });
  });
});

describe('finding available units', () => {
  it('hides a unit that is booked and shows it again outside those dates', async () => {
    const service = await makeService(db);
    const a = await makeUnit(db, service.id, { identifier: 'A' });
    await makeUnit(db, service.id, { identifier: 'B' });

    await createBooking(
      { ...customer, unitId: a.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );

    const during = await findAvailableUnits(db, {
      serviceId: service.id,
      startDate: '2026-10-02',
      endDate: '2026-10-03',
    });
    expect(during.map((u) => u.identifier)).toEqual(['B']);

    const after = await findAvailableUnits(db, {
      serviceId: service.id,
      startDate: '2026-10-06',
      endDate: '2026-10-08',
    });
    expect(after.map((u) => u.identifier)).toEqual(['A', 'B']);
  });

  it('hides inactive units and units of an inactive service', async () => {
    const service = await makeService(db);
    await makeUnit(db, service.id, { identifier: 'A', active: false });
    await makeUnit(db, service.id, { identifier: 'B' });

    const units = await findAvailableUnits(db, {
      serviceId: service.id,
      startDate: '2026-10-01',
      endDate: '2026-10-02',
    });
    expect(units.map((u) => u.identifier)).toEqual(['B']);

    await db.updateTable('services').set({ active: false }).where('id', '=', service.id).execute();
    const none = await findAvailableUnits(db, {
      serviceId: service.id,
      startDate: '2026-10-01',
      endDate: '2026-10-02',
    });
    expect(none).toHaveLength(0);
  });

  it('respects a unit block and refuses a booking over it', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    await db
      .insertInto('unit_blocks')
      .values({
        unit_id: unit.id,
        start_date: '2026-10-10',
        end_date: '2026-10-15',
        reason: 'Maintenance',
        created_by_staff_id: staff.id,
      })
      .execute();

    const units = await findAvailableUnits(db, {
      serviceId: service.id,
      startDate: '2026-10-12',
      endDate: '2026-10-13',
    });
    expect(units).toHaveLength(0);

    await expect(
      createBooking(
        { ...customer, unitId: unit.id, startDate: '2026-10-12', endDate: '2026-10-13', source: 'online' },
        db,
      ),
    ).rejects.toMatchObject({ code: 'unavailable', details: { reason: 'blocked' } });
  });

  it('reports why a specific unit is unavailable', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );

    const result = await checkUnitAvailability(db, {
      unitId: unit.id,
      startDate: '2026-10-02',
      endDate: '2026-10-03',
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('booking_conflict');
    expect(result.conflictingBookingIds).toHaveLength(1);
  });
});

describe('date validation', () => {
  it('rejects an end date on or before the start date', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);

    for (const [start, end] of [
      ['2026-10-05', '2026-10-05'],
      ['2026-10-05', '2026-10-01'],
    ] as const) {
      await expect(
        createBooking({ ...customer, unitId: unit.id, startDate: start, endDate: end, source: 'online' }, db),
      ).rejects.toBeInstanceOf(AppError);
    }
  });

  it('rejects a malformed or impossible date', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);

    for (const bad of ['2026-13-01', '2026-02-30', 'tomorrow', '01/10/2026']) {
      await expect(
        createBooking(
          { ...customer, unitId: unit.id, startDate: bad, endDate: '2026-12-01', source: 'online' },
          db,
        ),
      ).rejects.toMatchObject({ code: 'validation_error' });
    }
  });
});

describe('the dashboard calendar', () => {
  it('marks each day booked, blocked or available', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id, { identifier: 'CAR-1' });
    const staff = await makeStaff(db);

    await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-02', endDate: '2026-10-04', source: 'online' },
      db,
    );
    await db
      .insertInto('unit_blocks')
      .values({ unit_id: unit.id, start_date: '2026-10-06', end_date: '2026-10-07', created_by_staff_id: staff.id })
      .execute();

    const rows = await buildAvailabilityCalendar(db, { from: '2026-10-01', to: '2026-10-08' });
    const cells = rows[0]!.cells;

    expect(cells.map((c) => c.state)).toEqual([
      'available', // 01
      'booked',    // 02
      'booked',    // 03
      'available', // 04 — check-out day is free
      'available', // 05
      'blocked',   // 06
      'available', // 07
    ]);
    expect(cells[1]!.customerName).toBe('Test Customer');
  });
});

describe('unit blocks and bookings cannot contradict each other', () => {
  it('lets a block sit next to a booking without overlapping it', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-05', source: 'online' },
      db,
    );

    await db
      .insertInto('unit_blocks')
      .values({
        unit_id: unit.id,
        start_date: '2026-10-05',
        end_date: '2026-10-08',
        created_by_staff_id: staff.id,
      })
      .execute();

    const free = await findAvailableUnits(db, {
      serviceId: service.id,
      startDate: '2026-10-08',
      endDate: '2026-10-09',
    });
    expect(free).toHaveLength(1);
  });

  it('refuses two overlapping blocks on the same unit', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);

    await db
      .insertInto('unit_blocks')
      .values({ unit_id: unit.id, start_date: '2026-10-01', end_date: '2026-10-05' })
      .execute();

    await expect(
      db
        .insertInto('unit_blocks')
        .values({ unit_id: unit.id, start_date: '2026-10-04', end_date: '2026-10-06' })
        .execute(),
    ).rejects.toMatchObject({ code: '23P01' });
  });
});
