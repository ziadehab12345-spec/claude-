import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { DB } from '@/lib/db';
import { testDb, resetDb, makeService, makeStaff } from './helpers';
import {
  createInquiry,
  updateInquiry,
  listInquiries,
  countInquiries,
  inquiryCountsByStatus,
  getInquiryById,
} from '@/lib/inquiries';
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

const guest = { customerName: 'Abu Abdullah', customerPhone: '+966501234567' };

describe('receiving a request', () => {
  it('records one with only a name and a phone number', async () => {
    // The office needs a way to call back. Everything else is optional, and
    // demanding more would cost real enquiries.
    const inquiry = await createInquiry(guest, db);

    expect(inquiry.reference).toMatch(/^AC-\d{7}$/);
    expect(inquiry.status).toBe('new');
    expect(inquiry.source).toBe('website');
    expect(inquiry.preferred_start).toBeNull();
    expect(inquiry.service_id).toBeNull();
  });

  it('keeps the service name as it stood, so the record survives a rename', async () => {
    const service = await makeService(db);
    const inquiry = await createInquiry({ ...guest, serviceId: service.id }, db);

    expect(inquiry.service_label).toContain(service.name_en);

    await db
      .updateTable('services')
      .set({ name_en: 'Renamed', name_ar: 'اسم جديد' })
      .where('id', '=', service.id)
      .execute();

    const after = await getInquiryById(db, inquiry.id);
    expect(after!.service_label).toContain('Test Service');
  });

  it('survives the service being deleted', async () => {
    const service = await makeService(db);
    const inquiry = await createInquiry({ ...guest, serviceId: service.id }, db);

    await db.deleteFrom('services').where('id', '=', service.id).execute();

    const after = await getInquiryById(db, inquiry.id);
    expect(after).toBeDefined();
    expect(after!.service_id).toBeNull();
    expect(after!.service_label).toContain('Test Service');
  });

  it('accepts optional travel details when the guest gives them', async () => {
    const inquiry = await createInquiry(
      {
        ...guest,
        preferredStart: '2026-11-01',
        preferredEnd: '2026-11-08',
        partySize: 5,
        country: 'Saudi Arabia',
        flightNumber: 'SV305',
        message: 'Arriving late at night.',
      },
      db,
    );

    expect(inquiry.preferred_start).toBe('2026-11-01');
    expect(inquiry.preferred_end).toBe('2026-11-08');
    expect(inquiry.party_size).toBe(5);
    expect(inquiry.flight_number).toBe('SV305');
  });

  it('allows the same dates on any number of requests', async () => {
    // This is not a booking system. Ten families may ask about the same week,
    // and the office decides what it can serve.
    const service = await makeService(db);
    for (let i = 0; i < 10; i += 1) {
      await createInquiry(
        {
          ...guest,
          customerName: `Guest ${i}`,
          serviceId: service.id,
          preferredStart: '2026-12-01',
          preferredEnd: '2026-12-05',
        },
        db,
      );
    }
    expect(await countInquiries(db)).toBe(10);
  });

  it('rejects an end date before the start date', async () => {
    await expect(
      createInquiry({ ...guest, preferredStart: '2026-11-10', preferredEnd: '2026-11-01' }, db),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('rejects a malformed date', async () => {
    await expect(
      createInquiry({ ...guest, preferredStart: '2026-13-45' }, db),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('rejects a service that does not exist', async () => {
    await expect(
      createInquiry({ ...guest, serviceId: '00000000-0000-0000-0000-000000000000' }, db),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('issues a unique reference to each request', async () => {
    const refs = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      refs.add((await createInquiry(guest, db)).reference);
    }
    expect(refs.size).toBe(5);
  });

  it('does not lose a request when several arrive at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        createInquiry({ ...guest, customerName: `Guest ${i}` }, db),
      ),
    );
    expect(new Set(results.map((r) => r.reference)).size).toBe(12);
    expect(await countInquiries(db)).toBe(12);
  });
});

describe('following a request up', () => {
  it('moves through the office workflow and records who did it', async () => {
    const staff = await makeStaff(db);
    const inquiry = await createInquiry(guest, db);

    const contacted = await updateInquiry(
      { inquiryId: inquiry.id, actorUserId: staff.id, input: { status: 'contacted' } },
      db,
    );
    expect(contacted.status).toBe('contacted');
    expect(contacted.handled_by_staff_id).toBe(staff.id);

    const confirmed = await updateInquiry(
      { inquiryId: inquiry.id, actorUserId: staff.id, input: { status: 'confirmed' } },
      db,
    );
    expect(confirmed.status).toBe('confirmed');
  });

  it('reopens a request closed by mistake', async () => {
    // A to-do list, not a state machine guarding money. Any status may follow
    // any other.
    const staff = await makeStaff(db);
    const inquiry = await createInquiry(guest, db);

    await updateInquiry({ inquiryId: inquiry.id, actorUserId: staff.id, input: { status: 'closed' } }, db);
    const reopened = await updateInquiry(
      { inquiryId: inquiry.id, actorUserId: staff.id, input: { status: 'new' } },
      db,
    );
    expect(reopened.status).toBe('new');
  });

  it('writes an audit entry naming the staff member for every change', async () => {
    const staff = await makeStaff(db);
    const inquiry = await createInquiry(guest, db);
    await updateInquiry(
      { inquiryId: inquiry.id, actorUserId: staff.id, input: { status: 'contacted' } },
      db,
    );

    const audit = await listAuditForEntity(db, 'inquiry', inquiry.id);
    expect(audit.map((a) => a.action)).toEqual(['inquiry.status_changed', 'inquiry.created']);
    expect(audit[0]!.actor_name).toBe('Test Staff');
    expect(audit[0]!.details).toMatchObject({ from: 'new', to: 'contacted' });
  });

  it('saves office notes without changing the status', async () => {
    const staff = await makeStaff(db);
    const inquiry = await createInquiry(guest, db);

    const noted = await updateInquiry(
      { inquiryId: inquiry.id, actorUserId: staff.id, input: { staffNotes: 'Called, no answer.' } },
      db,
    );
    expect(noted.staff_notes).toBe('Called, no answer.');
    expect(noted.status).toBe('new');
  });

  it('writes nothing when an update changes nothing', async () => {
    const staff = await makeStaff(db);
    const inquiry = await createInquiry(guest, db);
    await updateInquiry({ inquiryId: inquiry.id, actorUserId: staff.id, input: { status: 'new' } }, db);

    const audit = await listAuditForEntity(db, 'inquiry', inquiry.id);
    expect(audit).toHaveLength(1); // only the creation entry
  });

  it('rejects an update to a request that does not exist', async () => {
    const staff = await makeStaff(db);
    await expect(
      updateInquiry(
        { inquiryId: '00000000-0000-0000-0000-000000000000', actorUserId: staff.id, input: { status: 'closed' } },
        db,
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('the office inbox', () => {
  it('filters by status and counts each one', async () => {
    const staff = await makeStaff(db);
    const a = await createInquiry({ ...guest, customerName: 'A' }, db);
    await createInquiry({ ...guest, customerName: 'B' }, db);
    await updateInquiry({ inquiryId: a.id, actorUserId: staff.id, input: { status: 'confirmed' } }, db);

    expect(await countInquiries(db, { status: ['new'] })).toBe(1);
    expect(await countInquiries(db, { status: ['confirmed'] })).toBe(1);
    expect(await inquiryCountsByStatus(db)).toMatchObject({ new: 1, confirmed: 1, contacted: 0, closed: 0 });
  });

  it('searches by name, phone and reference', async () => {
    const inquiry = await createInquiry({ customerName: 'Umm Khaled', customerPhone: '+96590001111' }, db);
    await createInquiry({ customerName: 'Fahd Al-Otaibi', customerPhone: '+97455002222' }, db);

    expect(await listInquiries(db, { search: 'Khaled' })).toHaveLength(1);
    expect(await listInquiries(db, { search: '9744' })).toHaveLength(0);
    expect(await listInquiries(db, { search: '97455' })).toHaveLength(1);
    expect(await listInquiries(db, { search: inquiry.reference })).toHaveLength(1);
  });

  it('reports the same total that it lists', async () => {
    for (let i = 0; i < 7; i += 1) {
      await createInquiry({ ...guest, customerName: `Guest ${i}` }, db);
    }
    const filters = { search: 'Guest', limit: 3 };
    expect(await listInquiries(db, filters)).toHaveLength(3);
    expect(await countInquiries(db, filters)).toBe(7);
  });

  it('shows the newest request first', async () => {
    await createInquiry({ ...guest, customerName: 'First' }, db);
    await new Promise((r) => setTimeout(r, 10));
    await createInquiry({ ...guest, customerName: 'Second' }, db);

    const rows = await listInquiries(db);
    expect(rows[0]!.customer_name).toBe('Second');
  });
});

describe('rate limiting', () => {
  it('allows up to the limit then blocks', async () => {
    for (let i = 1; i <= 3; i += 1) {
      expect((await consumeRateLimit(db, 'k', 3, 3600)).allowed).toBe(true);
    }
    expect((await consumeRateLimit(db, 'k', 3, 3600)).allowed).toBe(false);
  });

  it('counts each key separately', async () => {
    await consumeRateLimit(db, 'key-a', 1, 3600);
    expect((await consumeRateLimit(db, 'key-b', 1, 3600)).allowed).toBe(true);
  });
});

describe('staff authentication', () => {
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
    expect(await authenticate(db, 'ADMIN@Example.com', 'correct-horse-battery')).not.toBeNull();
    expect(await authenticate(db, 'admin@example.com', 'wrong')).toBeNull();
    expect(await authenticate(db, 'nobody@example.com', 'correct-horse-battery')).toBeNull();
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
    const token = await createSessionToken({ id: 'abc', name: 'A', email: 'a@b.com', role: 'staff' });
    expect(await readSessionToken(token)).toMatchObject({ id: 'abc', role: 'staff' });
    expect(await readSessionToken(`${token}x`)).toBeNull();
  });
});
