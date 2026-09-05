import { db } from '@/lib/db';
import { created, ok, route, parseJson, requireSession } from '@/lib/api';
import { createUserSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { AppError, isUniqueViolation } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** GET /api/admin/users — staff accounts. Password hashes are never returned. */
export const GET = route(async (req: Request) => {
  await requireSession(req, 'admin');
  return ok(
    await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'role', 'active', 'created_at'])
      .orderBy('created_at', 'asc')
      .execute(),
  );
});

/** POST /api/admin/users — create a staff or admin account. */
export const POST = route(async (req: Request) => {
  const actor = await requireSession(req, 'admin');
  const input = await parseJson(req, createUserSchema);

  try {
    const user = await db
      .insertInto('users')
      .values({
        name: input.name,
        email: input.email.trim().toLowerCase(),
        password_hash: await hashPassword(input.password),
        role: input.role,
      })
      .returning(['id', 'name', 'email', 'role', 'active', 'created_at'])
      .executeTakeFirstOrThrow();

    await recordAudit(db, {
      actorUserId: actor.id,
      action: 'user.created',
      entity: 'user',
      entityId: user.id,
      details: { email: user.email, role: user.role },
    });

    return created(user);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError('conflict', 'An account with that email already exists');
    }
    throw err;
  }
});
