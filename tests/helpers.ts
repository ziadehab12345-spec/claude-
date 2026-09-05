import { sql } from 'kysely';
import { createDb, type DB } from '@/lib/db';
import { migrate } from '../scripts/migrate';
import type { ServiceType } from '@/lib/schema';

let cached: DB | null = null;

export async function testDb(): Promise<DB> {
  if (cached) return cached;
  await migrate(process.env.TEST_DATABASE_URL!);
  cached = createDb(process.env.TEST_DATABASE_URL!);
  return cached;
}

export async function resetDb(db: DB): Promise<void> {
  await sql`TRUNCATE bookings, unit_blocks, units, services, audit_logs, rate_limits, users RESTART IDENTITY CASCADE`.execute(
    db,
  );
}

let slugCounter = 0;

export async function makeService(
  db: DB,
  opts: { type?: ServiceType; basePriceMinor?: number; active?: boolean } = {},
) {
  slugCounter += 1;
  return db
    .insertInto('services')
    .values({
      type: opts.type ?? 'car',
      slug: `test-service-${slugCounter}`,
      category_en: 'Test Category',
      category_ar: 'فئة اختبار',
      name_en: `Test Service ${slugCounter}`,
      name_ar: `خدمة ${slugCounter}`,
      base_price_minor: opts.basePriceMinor ?? 100_000,
      active: opts.active ?? true,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function makeUnit(
  db: DB,
  serviceId: string,
  opts: { identifier?: string; active?: boolean } = {},
) {
  return db
    .insertInto('units')
    .values({
      service_id: serviceId,
      identifier: opts.identifier ?? `UNIT-${Math.random().toString(36).slice(2, 10)}`,
      active: opts.active ?? true,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function makeStaff(db: DB, role: 'admin' | 'staff' = 'staff') {
  return db
    .insertInto('users')
    .values({
      name: 'Test Staff',
      email: `staff-${Math.random().toString(36).slice(2, 10)}@example.com`,
      password_hash: 'x',
      role,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
