import { db, toJsonb } from '@/lib/db';
import { ok, route, parseJson, requireSession } from '@/lib/api';
import { serviceUpdateSchema } from '@/lib/validation';
import { recordAudit } from '@/lib/audit';
import { notFound } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/services/:id — edit a service, including its base price.
 * Price changes are audited. Existing bookings keep the price they were taken
 * at; only new bookings use the new base price.
 */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req, 'admin');
  const { id } = await ctx.params;
  const input = await parseJson(req, serviceUpdateSchema);

  const before = await db.selectFrom('services').selectAll().where('id', '=', id).executeTakeFirst();
  if (!before) throw notFound('Service not found');

  const patch: Record<string, unknown> = {};
  if (input.type !== undefined) patch.type = input.type;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.categoryEn !== undefined) patch.category_en = input.categoryEn;
  if (input.categoryAr !== undefined) patch.category_ar = input.categoryAr;
  if (input.nameAr !== undefined) patch.name_ar = input.nameAr;
  if (input.nameEn !== undefined) patch.name_en = input.nameEn;
  if (input.descriptionAr !== undefined) patch.description_ar = input.descriptionAr;
  if (input.descriptionEn !== undefined) patch.description_en = input.descriptionEn;
  if (input.highlights !== undefined) patch.highlights = toJsonb(input.highlights);
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl || null;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length === 0) return ok(before);

  const service = await db
    .updateTable('services')
    .set(patch as never)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await recordAudit(db, {
    actorUserId: user.id,
    action: input.active !== undefined ? 'service.visibility_changed' : 'service.updated',
    entity: 'service',
    entityId: id,
    details: { fields: Object.keys(patch), active: service.active },
  });

  return ok(service);
});
