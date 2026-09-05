import { db } from '@/lib/db';
import { ok, created, route, parseJson, parseQuery, requireSession } from '@/lib/api';
import { inquiryListQuerySchema, staffInquirySchema } from '@/lib/validation';
import { createInquiry, listInquiries, countInquiries, inquiryCountsByStatus } from '@/lib/inquiries';
import type { InquiryStatus } from '@/lib/schema';

export const dynamic = 'force-dynamic';

/** GET /api/staff/inquiries — the office inbox. */
export const GET = route(async (req: Request) => {
  await requireSession(req);
  const q = parseQuery(req, inquiryListQuerySchema);

  const filters = {
    status: q.status
      ? (q.status.split(',').map((s) => s.trim()).filter(Boolean) as InquiryStatus[])
      : undefined,
    serviceId: q.serviceId,
    search: q.search,
    from: q.from,
    to: q.to,
    limit: q.limit ?? 50,
    offset: q.offset ?? 0,
  };

  const [inquiries, total, counts] = await Promise.all([
    listInquiries(db, filters),
    countInquiries(db, filters),
    inquiryCountsByStatus(db),
  ]);

  return ok({ inquiries, total, counts, limit: filters.limit, offset: filters.offset });
});

/** POST /api/staff/inquiries — log a request that arrived by phone or WhatsApp. */
export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  const input = await parseJson(req, staffInquirySchema);

  const inquiry = await createInquiry(
    {
      serviceId: input.serviceId ?? null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      country: input.country ?? null,
      preferredStart: input.preferredStart || null,
      preferredEnd: input.preferredEnd || null,
      partySize: input.partySize ?? null,
      flightNumber: input.flightNumber ?? null,
      message: input.message ?? '',
      source: input.source ?? 'phone',
      staffNotes: input.staffNotes,
      handledByStaffId: user.id,
    },
    db,
  );

  return created(inquiry);
});
