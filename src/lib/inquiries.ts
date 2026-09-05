/**
 * Inquiries — the record of every request the office receives.
 *
 * This is deliberately not a booking system. Nothing here reserves anything,
 * checks a calendar or holds a date. The office confirms availability itself
 * and replies by phone or WhatsApp. The only job of this module is to make
 * sure a request that arrives is never lost, and that the office can see what
 * it still owes a reply to.
 */
import type { Queryable, DB } from './db';
import { db as defaultDb } from './db';
import type { Database, Inquiry, InquirySource, InquiryStatus } from './schema';
import { sql } from 'kysely';
import type { Expression, ExpressionBuilder, SqlBool } from 'kysely';
import { recordAudit } from './audit';
import { isValidDateString } from './dates';
import { notFound, validationError } from './errors';

/** AC-<2-digit year><5 digits>, e.g. AC-2600042. */
async function nextReference(db: Queryable): Promise<string> {
  const { rows } = await sql<{ n: string }>`SELECT nextval('inquiry_reference_seq') AS n`.execute(db);
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric' })
    .format(new Date())
    .slice(2, 4);
  return `AC-${year}${String(Number(rows[0]!.n)).padStart(5, '0')}`;
}

export interface CreateInquiryInput {
  serviceId?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  country?: string | null;
  preferredStart?: string | null;
  preferredEnd?: string | null;
  partySize?: number | null;
  flightNumber?: string | null;
  message?: string;
  source?: InquirySource;
  /** Set when a staff member logs a request that arrived by phone. */
  handledByStaffId?: string | null;
  staffNotes?: string;
}

export async function createInquiry(
  input: CreateInquiryInput,
  db: DB = defaultDb,
): Promise<Inquiry> {
  const { preferredStart, preferredEnd } = input;

  if (preferredStart && !isValidDateString(preferredStart)) {
    throw validationError('preferred_start must be a valid YYYY-MM-DD date');
  }
  if (preferredEnd && !isValidDateString(preferredEnd)) {
    throw validationError('preferred_end must be a valid YYYY-MM-DD date');
  }
  if (preferredStart && preferredEnd && preferredEnd < preferredStart) {
    throw validationError('The end date cannot be before the start date');
  }

  return db.transaction().execute(async (trx) => {
    // Snapshot the service name so the record still reads correctly if the
    // catalogue is renamed or the service is removed later.
    let serviceLabel = '';
    if (input.serviceId) {
      const service = await trx
        .selectFrom('services')
        .select(['name_en', 'name_ar'])
        .where('id', '=', input.serviceId)
        .executeTakeFirst();
      if (!service) throw notFound('That service does not exist');
      serviceLabel = `${service.name_en} — ${service.name_ar}`;
    }

    const reference = await nextReference(trx);

    const inquiry = await trx
      .insertInto('inquiries')
      .values({
        reference,
        service_id: input.serviceId ?? null,
        service_label: serviceLabel,
        customer_name: input.customerName.trim(),
        customer_phone: input.customerPhone.trim(),
        customer_email: input.customerEmail?.trim() || null,
        country: input.country?.trim() || null,
        preferred_start: preferredStart || null,
        preferred_end: preferredEnd || null,
        party_size: input.partySize ?? null,
        flight_number: input.flightNumber?.trim() || null,
        message: input.message?.trim() ?? '',
        source: input.source ?? 'website',
        staff_notes: input.staffNotes ?? '',
        handled_by_staff_id: input.handledByStaffId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await recordAudit(trx, {
      actorUserId: input.handledByStaffId ?? null,
      actorLabel: input.handledByStaffId ? 'staff' : 'public',
      action: 'inquiry.created',
      entity: 'inquiry',
      entityId: inquiry.id,
      details: { reference, source: inquiry.source, service_label: serviceLabel },
    });

    return inquiry;
  });
}

export interface ListInquiriesFilters {
  status?: InquiryStatus[];
  serviceId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/**
 * The filter set as one expression, so the list and the count can never drift
 * apart and report different totals for the same view.
 */
function whereFilters(filters: ListInquiriesFilters) {
  return (eb: ExpressionBuilder<Database, 'inquiries'>) => {
    const clauses: Expression<SqlBool>[] = [];

    if (filters.status?.length) clauses.push(eb('inquiries.status', 'in', filters.status));
    if (filters.serviceId) clauses.push(eb('inquiries.service_id', '=', filters.serviceId));
    if (filters.from) clauses.push(eb('inquiries.created_at', '>=', new Date(filters.from)));
    if (filters.to) clauses.push(eb('inquiries.created_at', '<', new Date(filters.to)));

    if (filters.search) {
      const term = `%${filters.search.trim()}%`;
      clauses.push(
        eb.or([
          eb('inquiries.customer_name', 'ilike', term),
          eb('inquiries.customer_phone', 'ilike', term),
          eb('inquiries.reference', 'ilike', term),
          eb('inquiries.customer_email', 'ilike', term),
        ]),
      );
    }

    return eb.and(clauses);
  };
}

export async function listInquiries(db: Queryable, filters: ListInquiriesFilters = {}) {
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  let q = db
    .selectFrom('inquiries')
    .leftJoin('services', 'services.id', 'inquiries.service_id')
    .leftJoin('users', 'users.id', 'inquiries.handled_by_staff_id')
    .selectAll('inquiries')
    .select([
      'services.name_en as service_name_en',
      'services.name_ar as service_name_ar',
      'services.type as service_type',
      'users.name as handled_by_name',
    ]);

  return q
    .where(whereFilters(filters))
    .orderBy('inquiries.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();
}

export async function countInquiries(db: Queryable, filters: ListInquiriesFilters = {}) {
  const row = await db
    .selectFrom('inquiries')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where(whereFilters(filters))
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

/** Counts per status, for the dashboard header. */
export async function inquiryCountsByStatus(db: Queryable): Promise<Record<InquiryStatus, number>> {
  const rows = await db
    .selectFrom('inquiries')
    .select(({ fn }) => ['status', fn.countAll<number>().as('count')])
    .groupBy('status')
    .execute();

  const out: Record<InquiryStatus, number> = { new: 0, contacted: 0, confirmed: 0, closed: 0 };
  for (const r of rows) out[r.status] = Number(r.count);
  return out;
}

export async function getInquiryById(db: Queryable, id: string) {
  return db
    .selectFrom('inquiries')
    .leftJoin('services', 'services.id', 'inquiries.service_id')
    .leftJoin('users', 'users.id', 'inquiries.handled_by_staff_id')
    .selectAll('inquiries')
    .select([
      'services.name_en as service_name_en',
      'services.name_ar as service_name_ar',
      'services.slug as service_slug',
      'users.name as handled_by_name',
    ])
    .where('inquiries.id', '=', id)
    .executeTakeFirst();
}

export interface UpdateInquiryInput {
  status?: InquiryStatus;
  staffNotes?: string;
}

/**
 * Staff update: move an inquiry along the follow-up, or add a note.
 *
 * Any status may follow any other. This is a to-do list, not a state machine
 * guarding money or inventory: an inquiry closed by mistake should be
 * reopenable in one click.
 */
export async function updateInquiry(
  params: { inquiryId: string; actorUserId: string; input: UpdateInquiryInput },
  db: DB = defaultDb,
): Promise<Inquiry> {
  const { inquiryId, actorUserId, input } = params;

  return db.transaction().execute(async (trx) => {
    const before = await trx
      .selectFrom('inquiries')
      .selectAll()
      .where('id', '=', inquiryId)
      .forUpdate()
      .executeTakeFirst();

    if (!before) throw notFound('Inquiry not found');

    const patch: Record<string, unknown> = {};
    if (input.status !== undefined && input.status !== before.status) {
      patch.status = input.status;
      // Whoever moves it off "new" is the person following it up.
      patch.handled_by_staff_id = actorUserId;
    }
    if (input.staffNotes !== undefined && input.staffNotes !== before.staff_notes) {
      patch.staff_notes = input.staffNotes;
    }

    if (Object.keys(patch).length === 0) return before;

    const updated = await trx
      .updateTable('inquiries')
      .set(patch as never)
      .where('id', '=', inquiryId)
      .returningAll()
      .executeTakeFirstOrThrow();

    await recordAudit(trx, {
      actorUserId,
      actorLabel: 'staff',
      action: patch.status ? 'inquiry.status_changed' : 'inquiry.note_added',
      entity: 'inquiry',
      entityId: inquiryId,
      details: patch.status ? { from: before.status, to: patch.status } : { note_updated: true },
    });

    return updated;
  });
}
