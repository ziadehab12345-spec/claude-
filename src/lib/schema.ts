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
/** Where an inquiry is in the office's follow-up. */
export type InquiryStatus = 'new' | 'contacted' | 'confirmed' | 'closed';
export type InquirySource = 'website' | 'whatsapp' | 'phone' | 'staff_manual';

export const INQUIRY_STATUSES: readonly InquiryStatus[] = ['new', 'contacted', 'confirmed', 'closed'];
export const INQUIRY_SOURCES: readonly InquirySource[] = ['website', 'whatsapp', 'phone', 'staff_manual'];

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

/** One bullet in a service's inclusions list. */
export interface ServiceHighlight {
  ar: string;
  en: string;
}

export interface ServicesTable {
  id: Generated<string>;
  type: ServiceType;
  slug: string;
  category_en: string;
  category_ar: string;
  name_ar: string;
  name_en: string;
  description_ar: Generated<string>;
  description_en: Generated<string>;
  /** Bullet list of inclusions: [{ ar, en }, …]. See migration 0002. */
  highlights: Generated<ServiceHighlight[]>;
  image_url: string | null;
  sort_order: Generated<number>;
  active: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InquiriesTable {
  id: Generated<string>;
  reference: string;
  service_id: string | null;
  service_label: Generated<string>;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  country: string | null;
  preferred_start: DateString | null;
  preferred_end: DateString | null;
  party_size: number | null;
  flight_number: string | null;
  message: Generated<string>;
  status: Generated<InquiryStatus>;
  source: Generated<InquirySource>;
  staff_notes: Generated<string>;
  handled_by_staff_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
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
  inquiries: InquiriesTable;
  audit_logs: AuditLogsTable;
  rate_limits: RateLimitsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type Service = Selectable<ServicesTable>;
export type NewService = Insertable<ServicesTable>;
export type ServiceUpdate = Updateable<ServicesTable>;
export type Inquiry = Selectable<InquiriesTable>;
export type NewInquiry = Insertable<InquiriesTable>;
