import { db } from '@/lib/db';
import { ok, route, parseJson, requireSession } from '@/lib/api';
import { updateInquirySchema } from '@/lib/validation';
import { getInquiryById, updateInquiry } from '@/lib/inquiries';
import { listAuditForEntity } from '@/lib/audit';
import { notFound } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** GET /api/staff/inquiries/:id — one request with its history. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession(req);
  const { id } = await ctx.params;
  const inquiry = await getInquiryById(db, id);
  if (!inquiry) throw notFound('Inquiry not found');
  const audit = await listAuditForEntity(db, 'inquiry', id);
  return ok({ inquiry, audit });
});

/** PATCH /api/staff/inquiries/:id — move it along, or add a note. */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req);
  const { id } = await ctx.params;
  const input = await parseJson(req, updateInquirySchema);
  return ok(await updateInquiry({ inquiryId: id, actorUserId: user.id, input }, db));
});
