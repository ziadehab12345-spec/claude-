import { db } from '@/lib/db';
import { ok, route, parseQuery } from '@/lib/api';
import { availabilityQuerySchema } from '@/lib/validation';
import { findAvailableUnits } from '@/lib/availability';
import { computePrice } from '@/lib/bookings';
import { notFound, validationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/availability?serviceSlug=…&startDate=…&endDate=…
 *
 * Returns only the units that are genuinely free for the whole range, plus the
 * price for that range. The public site never filters availability client-side.
 */
export const GET = route(async (req: Request) => {
  const q = parseQuery(req, availabilityQuerySchema);
  if (!q.serviceId && !q.serviceSlug) {
    throw validationError('Provide either serviceId or serviceSlug');
  }

  const service = await db
    .selectFrom('services')
    .selectAll()
    .$if(!!q.serviceId, (qb) => qb.where('id', '=', q.serviceId!))
    .$if(!q.serviceId, (qb) => qb.where('slug', '=', q.serviceSlug!))
    .where('active', '=', true)
    .executeTakeFirst();

  if (!service) throw notFound('Service not found');

  const units = await findAvailableUnits(db, {
    serviceId: service.id,
    startDate: q.startDate,
    endDate: q.endDate,
  });

  return ok({
    service: {
      id: service.id,
      slug: service.slug,
      type: service.type,
      name_en: service.name_en,
      name_ar: service.name_ar,
      base_price_minor: Number(service.base_price_minor),
      currency: service.currency,
    },
    startDate: q.startDate,
    endDate: q.endDate,
    priceMinor: computePrice(service, q.startDate, q.endDate),
    availableCount: units.length,
    units: units.map((u) => ({
      id: u.id,
      identifier: u.identifier,
      label_en: u.label_en,
      label_ar: u.label_ar,
      attributes: u.attributes,
    })),
  });
});
