import type { Queryable } from './db';
import type { ServiceType } from './schema';

/** Public catalogue: active services only, with their live unit count. */
export async function listPublicServices(db: Queryable, type?: ServiceType) {
  let q = db
    .selectFrom('services')
    .leftJoin('units', (join) =>
      join.onRef('units.service_id', '=', 'services.id').on('units.active', '=', true),
    )
    .where('services.active', '=', true)
    .groupBy('services.id')
    .select(({ fn }) => [
      'services.id',
      'services.type',
      'services.slug',
      'services.category',
      'services.name_ar',
      'services.name_en',
      'services.description_ar',
      'services.description_en',
      'services.base_price_minor',
      'services.currency',
      'services.image_url',
      'services.sort_order',
      fn.count<number>('units.id').as('unit_count'),
    ])
    .orderBy('services.sort_order', 'asc')
    .orderBy('services.name_en', 'asc');

  if (type) q = q.where('services.type', '=', type);
  const rows = await q.execute();
  return rows.map((r) => ({ ...r, unit_count: Number(r.unit_count) }));
}

export async function getServiceBySlug(db: Queryable, slug: string) {
  return db
    .selectFrom('services')
    .selectAll()
    .where('slug', '=', slug)
    .where('active', '=', true)
    .executeTakeFirst();
}

export async function listAllServices(db: Queryable) {
  return db
    .selectFrom('services')
    .leftJoin('units', 'units.service_id', 'services.id')
    .groupBy('services.id')
    .selectAll('services')
    .select(({ fn }) => fn.count<number>('units.id').as('unit_count'))
    .orderBy('services.type', 'asc')
    .orderBy('services.sort_order', 'asc')
    .execute();
}
