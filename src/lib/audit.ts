import type { Queryable } from './db';

export interface AuditEntry {
  actorUserId?: string | null;
  actorLabel?: string;
  action: string;
  entity: 'inquiry' | 'service' | 'user';
  entityId: string;
  details?: Record<string, unknown>;
}

/**
 * Appends to the audit trail. Always call this inside the same transaction as
 * the change it describes, so the log can never claim something that was rolled
 * back.
 */
export async function recordAudit(db: Queryable, entry: AuditEntry): Promise<void> {
  await db
    .insertInto('audit_logs')
    .values({
      actor_user_id: entry.actorUserId ?? null,
      actor_label: entry.actorLabel ?? (entry.actorUserId ? 'staff' : 'public'),
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId,
      details: entry.details ?? {},
    })
    .execute();
}

export async function listAuditForEntity(
  db: Queryable,
  entity: string,
  entityId: string,
  limit = 100,
) {
  return db
    .selectFrom('audit_logs')
    .leftJoin('users', 'users.id', 'audit_logs.actor_user_id')
    .select([
      'audit_logs.id',
      'audit_logs.action',
      'audit_logs.details',
      'audit_logs.created_at',
      'audit_logs.actor_label',
      'users.name as actor_name',
    ])
    .where('audit_logs.entity', '=', entity)
    .where('audit_logs.entity_id', '=', entityId)
    .orderBy('audit_logs.created_at', 'desc')
    .limit(limit)
    .execute();
}
