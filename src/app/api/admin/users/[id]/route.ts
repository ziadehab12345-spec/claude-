import { db } from '@/lib/db';
import { ok, route, parseJson, requireSession } from '@/lib/api';
import { updateUserSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { AppError, notFound } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/users/:id — rename, change role, reset password, deactivate.
 *
 * Accounts are deactivated, never deleted: bookings and audit entries point at
 * the staff member who took them and that history has to survive.
 */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireSession(req, 'admin');
  const { id } = await ctx.params;
  const input = await parseJson(req, updateUserSchema);

  const before = await db
    .selectFrom('users')
    .select(['id', 'name', 'email', 'role', 'active'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (!before) throw notFound('User not found');

  // An admin cannot lock themselves out or demote themselves, which would
  // leave the office with no way back into the dashboard.
  if (actor.id === id && input.active === false) {
    throw new AppError('conflict', 'You cannot deactivate your own account');
  }
  if (actor.id === id && input.role === 'staff') {
    throw new AppError('conflict', 'You cannot remove your own administrator access');
  }

  // Never allow the last active admin to be removed.
  if (before.role === 'admin' && (input.active === false || input.role === 'staff')) {
    const { count } = await db
      .selectFrom('users')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('role', '=', 'admin')
      .where('active', '=', true)
      .executeTakeFirstOrThrow();
    if (Number(count) <= 1) {
      throw new AppError('conflict', 'The last active administrator cannot be removed');
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.role !== undefined) patch.role = input.role;
  if (input.active !== undefined) patch.active = input.active;
  if (input.password !== undefined) patch.password_hash = await hashPassword(input.password);

  if (Object.keys(patch).length === 0) return ok(before);

  const user = await db
    .updateTable('users')
    .set(patch as never)
    .where('id', '=', id)
    .returning(['id', 'name', 'email', 'role', 'active'])
    .executeTakeFirstOrThrow();

  await recordAudit(db, {
    actorUserId: actor.id,
    action: input.password ? 'user.password_reset' : 'user.updated',
    entity: 'user',
    entityId: id,
    details: { fields: Object.keys(patch).filter((k) => k !== 'password_hash') },
  });

  return ok(user);
});
