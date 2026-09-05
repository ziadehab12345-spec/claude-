/**
 * Hand-written Kysely database interface.
 *
 * Why hand-written and not an ORM: the core business rule of this platform is a
 * Postgres `EXCLUDE USING gist` constraint over a generated `daterange` column.
 * Prisma and most ORMs cannot express either, which means the schema they
 * generate would permanently drift from the schema the business depends on.
 * The schema is small enough that typing it by hand is cheaper than fighting
 * that drift. Keep this file in sync with db/migrations/*.sql.
 */
import type { ColumnType, Generated, Selectable, Insertable, Updateable } from 'kysely';

export type UserRole = 'admin' | 'staff';
export type ServiceType = 'car' | 'hotel' | 'apartment' | 'fasttrack';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type BookingSource = 'online' | 'staff_manual';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

/** Statuses that occupy a unit. Must match the WHERE clause of bookings_no_overlap. */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed'];

/** Dates are handled as 'YYYY-MM-DD' strings end to end. See src/lib/dates.ts. */
type DateString = ColumnType<string, string, string>;
/**
 * Timestamps are database-generated. The insert type allows `undefined`, which
 * already makes the column optional, so it must NOT be wrapped in `Generated`
 * as well — nesting the two makes Selectable resolve to the ColumnType itself
 * instead of Date.
 */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: Generated<string>;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  active: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ServicesTable {
  id: Generated<string>;
  type: ServiceType;
  slug: string;
  category: string;
  name_ar: string;
  name_en: string;
  description_ar: Generated<string>;
  description_en: Generated<string>;
  base_price_minor: string | number | bigint;
  currency: Generated<string>;
  image_url: string | null;
  sort_order: Generated<number>;
  active: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UnitsTable {
  id: Generated<string>;
  service_id: string;
  identifier: string;
  label_ar: Generated<string>;
  label_en: Generated<string>;
  attributes: Generated<Record<string, unknown>>;
  active: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BookingsTable {
  id: Generated<string>;
  reference: string;
  unit_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  start_date: DateString;
  end_date: DateString;
  /** Generated column — never written by the application. */
  occupancy: ColumnType<string, never, never>;
  flight_time: string | null;
  flight_number: string | null;
  status: Generated<BookingStatus>;
  source: BookingSource;
  price_minor: string | number | bigint;
  currency: Generated<string>;
  price_overridden: Generated<boolean>;
  payment_status: Generated<PaymentStatus>;
  payment_notes: Generated<string>;
  notes: Generated<string>;
  created_by_staff_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UnitBlocksTable {
  id: Generated<string>;
  unit_id: string;
  start_date: DateString;
  end_date: DateString;
  occupancy: ColumnType<string, never, never>;
  reason: Generated<string>;
  created_by_staff_id: string | null;
  created_at: Timestamp;
}

export interface AuditLogsTable {
  id: Generated<string>;
  actor_user_id: string | null;
  actor_label: Generated<string>;
  action: string;
  entity: string;
  entity_id: string;
  details: Generated<Record<string, unknown>>;
  created_at: Timestamp;
}

export interface RateLimitsTable {
  bucket_key: string;
  window_start: Timestamp;
  hits: Generated<number>;
}

export interface Database {
  users: UsersTable;
  services: ServicesTable;
  units: UnitsTable;
  bookings: BookingsTable;
  unit_blocks: UnitBlocksTable;
  audit_logs: AuditLogsTable;
  rate_limits: RateLimitsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type Service = Selectable<ServicesTable>;
export type NewService = Insertable<ServicesTable>;
export type ServiceUpdate = Updateable<ServicesTable>;
export type Unit = Selectable<UnitsTable>;
export type NewUnit = Insertable<UnitsTable>;
export type Booking = Selectable<BookingsTable>;
export type UnitBlock = Selectable<UnitBlocksTable>;
