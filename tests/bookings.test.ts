import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { DB } from '@/lib/db';
import { testDb, resetDb, makeService, makeUnit, makeStaff } from './helpers';
import {
  createBooking,
  changeBookingStatus,
  updateBooking,
  computePrice,
  canTransition,
} from '@/lib/bookings';
import { countDays } from '@/lib/dates';
import { listAuditForEntity } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/ratelimit';
import { authenticate, hashPassword, createSessionToken, readSessionToken } from '@/lib/auth';

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

describe('pricing', () => {
  it('bills a car per day in the range', () => {
    expect(computePrice({ type: 'car', base_price_minor: 500_00 }, '2026-10-01', '2026-10-04')).toBe(1500_00);
  });

  it('bills a stay per night, so the check-out day is not charged', () => {
    expect(computePrice({ type: 'hotel', base_price_minor: 800_00 }, '2026-10-01', '2026-10-04')).toBe(2400_00);
    expect(countDays('2026-10-01', '2026-10-04')).toBe(3);
  });

  it('bills Fast Track as a flat fee regardless of the range', () => {
    expect(computePrice({ type: 'fasttrack', base_price_minor: 300_00 }, '2026-10-01', '2026-10-02')).toBe(300_00);
  });

  it('takes the price from the catalogue, never from the request', async () => {
    const service = await makeService(db, { basePriceMinor: 250_00 });
    const unit = await makeUnit(db, service.id);

    const booking = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-03', source: 'online' },
      db,
    );
    expect(Number(booking.price_minor)).toBe(500_00);
    expect(booking.price_overridden).toBe(false);
  });

  it('refuses a price override on a public booking', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);

    await expect(
      createBooking(
        {
          ...customer,
          unitId: unit.id,
          startDate: '2026-10-01',
          endDate: '2026-10-03',
          source: 'online',
          priceMinorOverride: 1,
        },
        db,
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('records a staff price override and flags the booking', async () => {
    const service = await makeService(db, { basePriceMinor: 250_00 });
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db, 'admin');

    const booking = await createBooking(
      {
        ...customer,
        unitId: unit.id,
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        source: 'staff_manual',
        createdByStaffId: staff.id,
        priceMinorOverride: 400_00,
      },
      db,
    );

    expect(Number(booking.price_minor)).toBe(400_00);
    expect(booking.price_overridden).toBe(true);

    const audit = await listAuditForEntity(db, 'booking', booking.id);
    expect(audit[0]!.details).toMatchObject({
      price_minor: 400_00,
      computed_price_minor: 500_00,
      price_overridden: true,
    });
  });
});

describe('booking rules', () => {
  it('requires a staff id on a manual booking', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);

    await expect(
      createBooking(
        { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-03', source: 'staff_manual' },
        db,
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('requires a flight time and a single day for Fast Track', async () => {
    const service = await makeService(db, { type: 'fasttrack' });
    const unit = await makeUnit(db, service.id);

    await expect(
      createBooking(
        { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-02', source: 'online' },
        db,
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });

    await expect(
      createBooking(
        {
          ...customer,
          unitId: unit.id,
          startDate: '2026-10-01',
          endDate: '2026-10-04',
          flightTime: '14:30',
          source: 'online',
        },
        db,
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });

    const ok = await createBooking(
      {
        ...customer,
        unitId: unit.id,
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        flightTime: '14:30',
        source: 'online',
      },
      db,
    );
    expect(ok.flight_time).toBe('14:30:00');
  });

  it('issues a unique, sequential reference', async () => {
    const service = await makeService(db);
    const a = await makeUnit(db, service.id, { identifier: 'A' });
    const b = await makeUnit(db, service.id, { identifier: 'B' });

    const first = await createBooking(
      { ...customer, unitId: a.id, startDate: '2026-10-01', endDate: '2026-10-02', source: 'online' },
      db,
    );
    const second = await createBooking(
      { ...customer, unitId: b.id, startDate: '2026-10-01', endDate: '2026-10-02', source: 'online' },
      db,
    );

    expect(first.reference).toMatch(/^AC-\d{8}$/);
    expect(second.reference).not.toBe(first.reference);
  });
});

describe('status transitions', () => {
  it('allows only the transitions in the state machine', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('pending', 'completed')).toBe(false);
    expect(canTransition('confirmed', 'completed')).toBe(true);
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
  });

  it('refuses to reopen a cancelled booking', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    const booking = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-03', source: 'online' },
      db,
    );
    await changeBookingStatus({ bookingId: booking.id, to: 'cancelled', actorUserId: staff.id }, db);

    await expect(
      changeBookingStatus({ bookingId: booking.id, to: 'confirmed', actorUserId: staff.id }, db),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('writes an audit entry naming the staff member for every change', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    const booking = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-03', source: 'online' },
      db,
    );
    await changeBookingStatus({ bookingId: booking.id, to: 'confirmed', actorUserId: staff.id, reason: 'Paid in cash' }, db);

    const audit = await listAuditForEntity(db, 'booking', booking.id);
    expect(audit.map((a) => a.action)).toEqual(['booking.status_changed', 'booking.created']);
    expect(audit[0]!.details).toMatchObject({ from: 'pending', to: 'confirmed', reason: 'Paid in cash' });
    expect(audit[0]!.actor_name).toBe('Test Staff');
  });
});

describe('editing a booking', () => {
  it('moves a booking to new dates that are free', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    const booking = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-03', source: 'online' },
      db,
    );

    const moved = await updateBooking(
      { bookingId: booking.id, actorUserId: staff.id, input: { startDate: '2026-10-10', endDate: '2026-10-12' } },
      db,
    );
    expect(moved.start_date).toBe('2026-10-10');
  });

  it('lets a booking overlap its own previous dates when extending', async () => {
    // A booking must not block its own move.
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    const booking = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-03', source: 'online' },
      db,
    );
    const extended = await updateBooking(
      { bookingId: booking.id, actorUserId: staff.id, input: { endDate: '2026-10-06' } },
      db,
    );
    expect(extended.end_date).toBe('2026-10-06');
  });

  it('refuses a move onto dates another booking holds', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    const first = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-03', source: 'online' },
      db,
    );
    await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-10', endDate: '2026-10-15', source: 'online' },
      db,
    );

    await expect(
      updateBooking(
        { bookingId: first.id, actorUserId: staff.id, input: { startDate: '2026-10-09', endDate: '2026-10-12' } },
        db,
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('refuses to edit a cancelled booking', async () => {
    const service = await makeService(db);
    const unit = await makeUnit(db, service.id);
    const staff = await makeStaff(db);

    const booking = await createBooking(
      { ...customer, unitId: unit.id, startDate: '2026-10-01', endDate: '2026-10-03', source: 'online' },
      db,
    );
    await changeBookingStatus({ bookingId: booking.id, to: 'cancelled', actorUserId: staff.id }, db);

    await expect(
      updateBooking({ bookingId: booking.id, actorUserId: staff.id, input: { notes: 'x' } }, db),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('rate limiting', () => {
  it('allows up to the limit then blocks', async () => {
    for (let i = 1; i <= 3; i += 1) {
      const r = await consumeRateLimit(db, 'test-key', 3, 3600);
      expect(r.allowed).toBe(true);
    }
    const blocked = await consumeRateLimit(db, 'test-key', 3, 3600);
    expect(blocked.allowed).toBe(false);
  });

  it('counts each key separately', async () => {
    await consumeRateLimit(db, 'key-a', 1, 3600);
    const other = await consumeRateLimit(db, 'key-b', 1, 3600);
    expect(other.allowed).toBe(true);
  });
});

describe('authentication', () => {
  it('accepts the right password and rejects the wrong one', async () => {
    await db
      .insertInto('users')
      .values({
        name: 'Admin',
        email: 'admin@example.com',
        password_hash: await hashPassword('correct-horse-battery'),
        role: 'admin',
      })
      .execute();

    expect(await authenticate(db, 'admin@example.com', 'correct-horse-battery')).toMatchObject({ role: 'admin' });
    expect(await authenticate(db, 'admin@example.com', 'wrong')).toBeNull();
    expect(await authenticate(db, 'nobody@example.com', 'correct-horse-battery')).toBeNull();
  });

  it('matches the email case-insensitively', async () => {
    await db
      .insertInto('users')
      .values({
        name: 'Admin',
        email: 'admin@example.com',
        password_hash: await hashPassword('correct-horse-battery'),
        role: 'admin',
      })
      .execute();
    expect(await authenticate(db, 'ADMIN@Example.com', 'correct-horse-battery')).not.toBeNull();
  });

  it('rejects a deactivated account', async () => {
    await db
      .insertInto('users')
      .values({
        name: 'Former Staff',
        email: 'gone@example.com',
        password_hash: await hashPassword('correct-horse-battery'),
        role: 'staff',
        active: false,
      })
      .execute();
    expect(await authenticate(db, 'gone@example.com', 'correct-horse-battery')).toBeNull();
  });

  it('round-trips a session token and rejects a tampered one', async () => {
    const user = { id: 'abc', name: 'A', email: 'a@b.com', role: 'staff' as const };
    const token = await createSessionToken(user);
    expect(await readSessionToken(token)).toMatchObject({ id: 'abc', role: 'staff' });
    expect(await readSessionToken(`${token}x`)).toBeNull();
    expect(await readSessionToken('not-a-token')).toBeNull();
  });
});
