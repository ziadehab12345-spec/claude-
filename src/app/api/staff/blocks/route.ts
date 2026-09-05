import { db } from '@/lib/db';
import { created, ok, route, parseJson, parseQuery, requireSession } from '@/lib/api';
import { unitBlockSchema } from '@/lib/validation';
import { assertValidRange } from '@/lib/availability';
import { sql as ksql } from 'kysely';
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
 *
 * A block over dates that already hold a live booking is refused. Allowing it
 * would leave the unit both booked and out of service, and nothing downstream
 * could say which is true — the booking would still be honoured while the
 * calendar implied otherwise. Staff cancel or move the booking first.
 */
export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  const input = await parseJson(req, unitBlockSchema);
  assertValidRange({ startDate: input.startDate, endDate: input.endDate });

  const conflicts = await db
    .selectFrom('bookings')
    .select(['id', 'reference', 'start_date', 'end_date'])
    .where('unit_id', '=', input.unitId)
    .where('status', 'in', ['pending', 'confirmed'])
    .where(
      ksql<boolean>`bookings.occupancy && daterange(${input.startDate}::date, ${input.endDate}::date, '[)')`,
    )
    .execute();

  if (conflicts.length > 0) {
    throw unavailable(
      'That unit has bookings on those dates. Cancel or move them before taking it out of service.',
      { conflicts },
    );
  }

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
