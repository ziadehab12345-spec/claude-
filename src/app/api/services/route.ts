import { db } from '@/lib/db';
import { ok, route, parseQuery } from '@/lib/api';
import { listPublicServices } from '@/lib/services';
import { z } from 'zod';
import { serviceTypeSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ type: serviceTypeSchema.optional() });

/** GET /api/services — public catalogue, optionally filtered by type. */
export const GET = route(async (req: Request) => {
  const { type } = parseQuery(req, querySchema);
  return ok(await listPublicServices(db, type));
});
