import { db } from '@/lib/db';
import { ok, route, parseJson, requireSession } from '@/lib/api';
import { unitUpdateSchema } from '@/lib/validation';
import { recordAudit } from '@/lib/audit';
import { notFound } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/units/:id — edit or retire a unit.
 *
 * Units are never deleted: a booking references its unit, and the history has
 * to stay readable. Setting active=false removes it from availability while
 * leaving past bookings intact.
 */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req, 'admin');
  const { id } = await ctx.params;
  const input = await parseJson(req, unitUpdateSchema);

  const before = await db.selectFrom('units').selectAll().where('id', '=', id).executeTakeFirst();
  if (!before) throw notFound('Unit not found');

  const patch: Record<string, unknown> = {};
  if (input.identifier !== undefined) patch.identifier = input.identifier;
  if (input.labelAr !== undefined) patch.label_ar = input.labelAr;
  if (input.labelEn !== undefined) patch.label_en = input.labelEn;
  if (input.attributes !== undefined) patch.attributes = input.attributes;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length === 0) return ok(before);

  const unit = await db
    .updateTable('units')
    .set(patch as never)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await recordAudit(db, {
    actorUserId: user.id,
    action: 'unit.updated',
    entity: 'unit',
    entityId: id,
    details: { fields: Object.keys(patch) },
  });

  return ok(unit);
});
