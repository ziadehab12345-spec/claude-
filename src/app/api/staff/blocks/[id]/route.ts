import { db } from '@/lib/db';
import { ok, route, requireSession } from '@/lib/api';
import { recordAudit } from '@/lib/audit';
import { notFound } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** DELETE /api/staff/blocks/:id — put a unit back into service. */
export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req);
  const { id } = await ctx.params;

  const deleted = await db
    .deleteFrom('unit_blocks')
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!deleted) throw notFound('Block not found');

  await recordAudit(db, {
    actorUserId: user.id,
    action: 'unit_block.deleted',
    entity: 'unit_block',
    entityId: id,
    details: { unit_id: deleted.unit_id, start_date: deleted.start_date, end_date: deleted.end_date },
  });

  return ok({ id });
});
