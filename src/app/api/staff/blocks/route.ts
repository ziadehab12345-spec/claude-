import { db } from '@/lib/db';
import { created, ok, route, parseJson, parseQuery, requireSession } from '@/lib/api';
import { unitBlockSchema } from '@/lib/validation';
import { assertValidRange } from '@/lib/availability';
import { recordAudit } from '@/lib/audit';
import { isExclusionViolation, unavailable } from '@/lib/errors';
import { z } from 'zod';
import { sql } from 'kysely';

export const dynamic = 'force-dynamic';

const listQuery = z.object({ unitId: z.uuid().optional() });

/** GET /api/staff/blocks — current and future out-of-service periods. */
export const GET = route(async (req: Request) => {
  await requireSession(req);
  const { unitId } = parseQuery(req, listQuery);

  let q = db
    .selectFrom('unit_blocks')
    .innerJoin('units', 'units.id', 'unit_blocks.unit_id')
    .selectAll('unit_blocks')
    .select(['units.identifier as unit_identifier'])
    .where(sql<boolean>`unit_blocks.end_date >= current_date`)
    .orderBy('unit_blocks.start_date', 'asc');

  if (unitId) q = q.where('unit_blocks.unit_id', '=', unitId);
  return ok(await q.execute());
});

/**
 * POST /api/staff/blocks — take a unit out of service (maintenance, owner use,
 * allotment handed back). Blocked dates disappear from public availability.
 */
export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  const input = await parseJson(req, unitBlockSchema);
  assertValidRange({ startDate: input.startDate, endDate: input.endDate });

  try {
    const block = await db
      .insertInto('unit_blocks')
      .values({
        unit_id: input.unitId,
        start_date: input.startDate,
        end_date: input.endDate,
        reason: input.reason ?? '',
        created_by_staff_id: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await recordAudit(db, {
      actorUserId: user.id,
      action: 'unit_block.created',
      entity: 'unit_block',
      entityId: block.id,
      details: { unit_id: input.unitId, start_date: input.startDate, end_date: input.endDate },
    });

    return created(block);
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw unavailable('That unit already has a block overlapping those dates');
    }
    throw err;
  }
});
