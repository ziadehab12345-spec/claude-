import { db } from '@/lib/db';
import { ok, route } from '@/lib/api';
import { getServiceBySlug } from '@/lib/services';
import { notFound } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** GET /api/services/:slug — one public service. */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const service = await getServiceBySlug(db, slug);
  if (!service) throw notFound('Service not found');
  return ok(service);
});
