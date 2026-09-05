import { db, toJsonb } from '@/lib/db';
import { created, ok, route, parseJson, parseQuery, requireSession } from '@/lib/api';
import { unitSchema } from '@/lib/validation';
import { recordAudit } from '@/lib/audit';
import { AppError, isUniqueViolation } from '@/lib/errors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const listQuery = z.object({ serviceId: z.uuid().optional() });

/** GET /api/admin/units — inventory list, optionally scoped to one service. */
export const GET = route(async (req: Request) => {
  await requireSession(req);
  const { serviceId } = parseQuery(req, listQuery);

  let q = db
    .selectFrom('units')
    .innerJoin('services', 'services.id', 'units.service_id')
    .selectAll('units')
    .select(['services.name_en as service_name_en', 'services.type as service_type'])
    .orderBy('services.name_en', 'asc')
    .orderBy('units.identifier', 'asc');

  if (serviceId) q = q.where('units.service_id', '=', serviceId);
  return ok(await q.execute());
});

/** POST /api/admin/units — add a car, room, apartment or Fast Track rep slot. */
export const POST = route(async (req: Request) => {
  const user = await requireSession(req, 'admin');
  const input = await parseJson(req, unitSchema);

  try {
    const unit = await db
      .insertInto('units')
      .values({
        service_id: input.serviceId,
        identifier: input.identifier,
        label_ar: input.labelAr ?? '',
        label_en: input.labelEn ?? '',
        attributes: toJsonb(input.attributes ?? {}) as never,
        active: input.active ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await recordAudit(db, {
      actorUserId: user.id,
      action: 'unit.created',
      entity: 'unit',
      entityId: unit.id,
      details: { service_id: input.serviceId, identifier: input.identifier },
    });

    return created(unit);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError('conflict', 'That service already has a unit with this identifier');
    }
    throw err;
  }
});
