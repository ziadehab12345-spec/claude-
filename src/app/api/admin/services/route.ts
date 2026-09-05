import { db, toJsonb } from '@/lib/db';
import { created, ok, route, parseJson, requireSession } from '@/lib/api';
import { serviceSchema } from '@/lib/validation';
import { listAllServices } from '@/lib/services';
import { recordAudit } from '@/lib/audit';
import { AppError, isUniqueViolation } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** GET /api/admin/services — full catalogue including inactive services. */
export const GET = route(async (req: Request) => {
  await requireSession(req);
  return ok(await listAllServices(db));
});

/** POST /api/admin/services — create a bookable service. Admin only. */
export const POST = route(async (req: Request) => {
  const user = await requireSession(req, 'admin');
  const input = await parseJson(req, serviceSchema);

  try {
    const service = await db
      .insertInto('services')
      .values({
        type: input.type,
        slug: input.slug,
        category_en: input.categoryEn,
        category_ar: input.categoryAr,
        name_ar: input.nameAr,
        name_en: input.nameEn,
        description_ar: input.descriptionAr ?? '',
        description_en: input.descriptionEn ?? '',
        highlights: toJsonb(input.highlights ?? []) as never,
        image_url: input.imageUrl || null,
        sort_order: input.sortOrder ?? 0,
        active: input.active ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await recordAudit(db, {
      actorUserId: user.id,
      action: 'service.created',
      entity: 'service',
      entityId: service.id,
      details: { slug: service.slug, type: service.type },
    });

    return created(service);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError('conflict', 'A service with that slug already exists');
    }
    throw err;
  }
});
